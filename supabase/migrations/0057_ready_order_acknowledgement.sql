-- Persist customer acknowledgement for dine-in ready orders so the tracking
-- page and looping ready alarm remain acknowledged after refreshes.

alter table orders
  add column if not exists ready_acknowledged_at timestamptz;

create or replace function customer_acknowledge_ready_order(p_code text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_acknowledged_at timestamptz;
begin
  if v_code = '' then
    return null;
  end if;

  update orders
  set ready_acknowledged_at = coalesce(ready_acknowledged_at, now())
  where short_code = v_code
    and service_mode = 'dine_in'
    and status = 'ready'
  returning ready_acknowledged_at into v_acknowledged_at;

  if v_acknowledged_at is not null then
    return v_acknowledged_at;
  end if;

  select ready_acknowledged_at
  into v_acknowledged_at
  from orders
  where short_code = v_code
    and service_mode = 'dine_in';

  return v_acknowledged_at;
end;
$$;

revoke all on function customer_acknowledge_ready_order(text) from public;
grant execute on function customer_acknowledge_ready_order(text) to anon, authenticated;

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
    'ready_acknowledged_at', v_order.ready_acknowledged_at,
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
