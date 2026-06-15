-- Customer-facing RPCs (SECURITY DEFINER). Direct table writes from
-- the anon client are blocked by RLS; these functions are the only
-- legitimate path.

-- Short code: 6 chars from a 32-char alphabet (no 0/O/1/I/L)
create or replace function generate_short_code()
returns text
language plpgsql
as $$
declare
  alphabet text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  result text := 'ZB-';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end;
$$;

-- Read own order by short code (no auth required). Returns the order
-- row plus its items as a JSON blob.
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
  if not found then
    return null;
  end if;
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
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', oi.item_name_snapshot,
        'variation', oi.variation_label_snapshot,
        'qty', oi.qty,
        'unit_price_cents', oi.unit_price_cents,
        'line_total_cents', oi.line_total_cents
      )), '[]'::jsonb)
      from order_items oi where oi.order_id = v_order.id
    )
  );
  return v_payload;
end;
$$;

-- Note: place_order() is intentionally not implemented in this
-- migration. It's a larger function with pricing + validation +
-- inventory checks; we add it in 0010 once the menu seed is in.
