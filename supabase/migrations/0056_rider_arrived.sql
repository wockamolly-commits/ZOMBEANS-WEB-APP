-- "Rider outside" arrival ping. This is a sub-state of out_for_delivery, not a
-- new order status: the order stays out_for_delivery while the rider waits at
-- the door. We persist the moment on rider_assignments.arrived_at so the
-- customer tracking timeline survives refreshes, and expose it through
-- get_order_by_code as a rider_arrived flag.

alter table rider_assignments
  add column if not exists arrived_at timestamptz;

alter table rider_assignments
  add column if not exists customer_ring_at timestamptz;

create or replace function rider_mark_arrived(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := assert_active_rider();
  v_status order_status;
  v_mode service_mode;
begin
  select o.status, o.service_mode
  into v_status, v_mode
  from orders o
  join rider_assignments ra on ra.order_id = o.id
  where o.id = p_order_id
    and ra.rider_profile_id = v_uid
  for update of o, ra;

  if not found then
    raise exception 'ORDER_NOT_ASSIGNED' using errcode = 'P0001';
  end if;
  if v_mode <> 'delivery' then
    raise exception 'DELIVERY_ONLY' using errcode = 'P0001';
  end if;
  if v_status <> 'out_for_delivery' then
    raise exception 'INVALID_TRANSITION:%', v_status using errcode = 'P0001';
  end if;

  update rider_assignments
  set arrived_at = coalesce(arrived_at, now()),
      customer_ring_at = now()
  where order_id = p_order_id
    and rider_profile_id = v_uid;

  insert into audit_logs (actor_profile_id, action, target_table, target_id)
  values (v_uid, 'rider_assignment.arrived', 'rider_assignments', p_order_id::text);
end;
$$;

revoke all on function rider_mark_arrived(uuid) from public;
revoke all on function rider_mark_arrived(uuid) from anon;
grant execute on function rider_mark_arrived(uuid) to authenticated;

-- Re-publish get_order_by_code with the rider_arrived flag so the customer
-- tracking timeline can light up the "Rider outside" step.
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
    'rider_arrived', exists (
      select 1
      from rider_assignments ra
      where ra.order_id = v_order.id
        and ra.arrived_at is not null
    ),
    'rider_ring_at', (
      select max(ra.customer_ring_at)
      from rider_assignments ra
      where ra.order_id = v_order.id
    ),
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
