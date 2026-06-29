-- Preset rejection reasons are stored in orders.rejected_reason and surfaced
-- to customers through get_order_by_code. The staff RPC also queues a customer
-- notification when contact information is available.

create or replace function staff_set_order_status(
  p_order_id uuid,
  p_to       order_status,
  p_reason   text default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_from order_status;
  v_mode service_mode;
  v_payment_method payment_method;
  v_short_code text;
  v_customer_email text;
  v_customer_phone text;
begin
  if not exists (
    select 1 from profiles
    where id = v_uid and role in ('staff','admin') and is_active
  ) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select status, service_mode, short_code, customer_email, customer_phone
  into v_from, v_mode, v_short_code, v_customer_email, v_customer_phone
  from orders
  where id = p_order_id
  for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;

  if not (
       (v_from = 'pending'          and p_to in ('accepted','rejected','cancelled'))
    or (v_from = 'accepted'         and p_to in ('preparing','cancelled'))
    or (v_from = 'preparing'        and p_to in ('ready','cancelled'))
    or (v_from = 'ready'            and p_to in ('out_for_delivery','completed'))
    or (v_from = 'out_for_delivery' and p_to = 'completed')
  ) then
    raise exception 'INVALID_TRANSITION:%->%', v_from, p_to using errcode = 'P0001';
  end if;

  if v_from = 'ready' and p_to = 'completed' and v_mode = 'delivery' then
    raise exception 'DELIVERY_NEEDS_OFD' using errcode = 'P0001';
  end if;
  if p_to = 'out_for_delivery' and v_mode <> 'delivery' then
    raise exception 'OFD_DELIVERY_ONLY' using errcode = 'P0001';
  end if;
  if p_to = 'out_for_delivery' and not exists (
    select 1
    from rider_assignments ra
    join profiles p on p.id = ra.rider_profile_id
    join riders r on r.profile_id = p.id
    where ra.order_id = p_order_id
      and p.role = 'rider'
      and p.is_active
      and r.is_available
  ) then
    raise exception 'NO_RIDER_ASSIGNED' using errcode = 'P0001';
  end if;

  if p_to = 'completed' and v_mode = 'delivery' then
    select method
    into v_payment_method
    from payments
    where order_id = p_order_id
    for update;

    if not found then
      raise exception 'PAYMENT_NOT_FOUND' using errcode = 'P0001';
    end if;

    if v_payment_method = 'cash' then
      raise exception 'CASH_DELIVERY_RIDER_ONLY' using errcode = 'P0001';
    end if;
  end if;

  update orders set
    status                 = p_to,
    accepted_at            = case when p_to = 'accepted'  then now() else accepted_at end,
    accepted_by_profile_id = case when p_to = 'accepted'  then v_uid else accepted_by_profile_id end,
    ready_at               = case when p_to = 'ready'     then now() else ready_at end,
    completed_at           = case when p_to = 'completed' then now() else completed_at end,
    rejected_at            = case when p_to in ('rejected','cancelled') then now()    else rejected_at end,
    rejected_reason        = case when p_to in ('rejected','cancelled') then nullif(trim(p_reason), '') else rejected_reason end
  where id = p_order_id;

  if p_to = 'cancelled' then
    insert into audit_logs (actor_profile_id, action, target_table, target_id, diff)
    select
      v_uid,
      'rider_assignment.removed',
      'rider_assignments',
      p_order_id::text,
      jsonb_build_object(
        'from_rider_profile_id', rider_profile_id,
        'to_rider_profile_id', null,
        'reason', 'order_cancelled'
      )
    from rider_assignments
    where order_id = p_order_id;

    delete from rider_assignments where order_id = p_order_id;
  end if;

  insert into order_status_events (order_id, from_status, to_status, actor_profile_id, reason)
  values (p_order_id, v_from, p_to, v_uid, nullif(trim(p_reason), ''));

  if p_to = 'rejected' and coalesce(v_customer_email, v_customer_phone) is not null then
    insert into notifications (channel, target, template, payload)
    values (
      case when v_customer_email is not null then 'email' else 'sms' end,
      coalesce(v_customer_email, v_customer_phone),
      'order_rejected',
      jsonb_build_object(
        'order_id', p_order_id,
        'short_code', v_short_code,
        'reason', nullif(trim(p_reason), ''),
        'status', p_to
      )
    );
  end if;
end;
$$;

grant execute on function staff_set_order_status(uuid, order_status, text) to authenticated;

create or replace function get_order_by_code(p_code text)
returns jsonb
language plpgsql
stable security definer set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_payload jsonb;
begin
  select * into v_order from orders where short_code = upper(p_code);
  if not found then return null; end if;

  v_payload := jsonb_build_object(
    'short_code', v_order.short_code,
    'status', v_order.status,
    'service_mode', v_order.service_mode,
    'customer_name', v_order.customer_name,
    'subtotal_cents', v_order.subtotal_cents,
    'delivery_fee_cents', v_order.delivery_fee_cents,
    'total_cents', v_order.total_cents,
    'placed_at', v_order.placed_at,
    'accepted_at', v_order.accepted_at,
    'ready_at', v_order.ready_at,
    'completed_at', v_order.completed_at,
    'pickup_time', v_order.pickup_time,
    'rejected_reason', v_order.rejected_reason,
    'delivery_address', (
      select jsonb_build_object(
        'street', da.street,
        'barangay', da.barangay,
        'city', da.city,
        'landmark', da.landmark,
        'delivery_notes', da.delivery_notes,
        'lat', da.lat,
        'lng', da.lng,
        'google_place_id', da.google_place_id,
        'detected_lat', da.detected_lat,
        'detected_lng', da.detected_lng,
        'detected_address', da.detected_address
      )
      from delivery_addresses da
      where da.order_id = v_order.id
    ),
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', oi.item_name_snapshot,
        'variation', oi.variation_label_snapshot,
        'qty', oi.qty,
        'unit_price_cents', oi.unit_price_cents,
        'line_total_cents', oi.line_total_cents,
        'options', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'group', oio.group_name_snapshot,
            'name', oio.name_snapshot,
            'price_delta_cents', oio.price_delta_cents,
            'quantity', oio.quantity
          ) order by oio.group_name_snapshot, oio.name_snapshot), '[]'::jsonb)
          from order_item_options oio
          where oio.order_item_id = oi.id
        )
      ) order by oi.id), '[]'::jsonb)
      from order_items oi where oi.order_id = v_order.id
    )
  );
  return v_payload;
end;
$$;

grant execute on function get_order_by_code(text) to anon, authenticated;
