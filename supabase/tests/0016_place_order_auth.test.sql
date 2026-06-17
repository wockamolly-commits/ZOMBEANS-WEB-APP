-- supabase/tests/0016_place_order_auth.test.sql
-- Run AFTER 0016 is applied. Wrapped in a rolled-back transaction so it
-- leaves no data behind. auth.uid() is null here (no JWT claims set), so
-- this exercises the guest path + the delivery guard.
begin;

-- (A) Unauthenticated delivery must be rejected with AUTH_REQUIRED.
do $$
begin
  perform place_order(jsonb_build_object(
    'service_mode','delivery',
    'customer_name','Guest',
    'customer_phone','09186056360',
    'lines', jsonb_build_array(jsonb_build_object(
      'item_slug','x','variation_label','y','qty',1)),
    'delivery', jsonb_build_object('tier','tier-2','street','S')
  ));
  raise exception 'TEST FAILED: delivery without auth was allowed';
exception
  when sqlstate 'P0001' then
    if sqlerrm <> 'AUTH_REQUIRED' then
      raise exception 'TEST FAILED: expected AUTH_REQUIRED, got %', sqlerrm;
    end if;
    raise notice 'PASS A: unauthenticated delivery rejected (AUTH_REQUIRED)';
end $$;

-- (B) Guest pickup still succeeds and stores user_id = null.
do $$
declare v jsonb; v_code text;
begin
  v := place_order(jsonb_build_object(
    'service_mode','pickup',
    'customer_name','Guest',
    'customer_phone','09186056360',
    'pickup_time', (now() + interval '1 hour')::text,
    'lines', jsonb_build_array(jsonb_build_object(
      'item_slug', (select slug from menu_items where is_active limit 1),
      'variation_label', (select iv.label from item_variations iv
        join menu_items mi on mi.id = iv.item_id
        where mi.is_active and iv.is_active limit 1),
      'qty',1))
  ));
  v_code := v->>'short_code';
  if (select user_id from orders where short_code = v_code) is not null then
    raise exception 'TEST FAILED: guest order has non-null user_id';
  end if;
  raise notice 'PASS B: guest pickup stored with user_id null';
end $$;

rollback;
