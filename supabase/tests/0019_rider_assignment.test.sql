-- supabase/tests/0019_rider_assignment.test.sql
-- Run after migration 0019. The transaction is rolled back completely.
begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'staff-test@zombeans.local', '', now(), '{}', '{}', now(), now()),
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rider-test@zombeans.local', '', now(), '{}', '{}', now(), now()),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rider-off@zombeans.local', '', now(), '{}', '{}', now(), now());

insert into profiles (id, role, display_name, is_active) values
  ('10000000-0000-0000-0000-000000000001', 'staff', 'Test Staff', true),
  ('20000000-0000-0000-0000-000000000001', 'rider', 'Ready Rider', true),
  ('20000000-0000-0000-0000-000000000002', 'rider', 'Unavailable Rider', true);

insert into riders (profile_id, vehicle_type, is_available) values
  ('20000000-0000-0000-0000-000000000001', 'motorcycle', true),
  ('20000000-0000-0000-0000-000000000002', 'motorcycle', false);

insert into orders (
  id, short_code, status, service_mode, customer_name,
  subtotal_cents, delivery_fee_cents, total_cents
) values
  ('30000000-0000-0000-0000-000000000001', 'ZB-RIDE1', 'accepted', 'delivery', 'Delivery One', 10000, 3000, 13000),
  ('30000000-0000-0000-0000-000000000002', 'ZB-RIDE2', 'ready', 'delivery', 'Delivery Two', 10000, 3000, 13000),
  ('30000000-0000-0000-0000-000000000003', 'ZB-PICK1', 'accepted', 'pickup', 'Pickup One', 10000, 0, 10000);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- A: active staff can assign an active, available rider and an audit row is written.
select staff_assign_rider(
  '30000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001'
);
do $$
begin
  if not exists (
    select 1 from rider_assignments
    where order_id = '30000000-0000-0000-0000-000000000001'
      and rider_profile_id = '20000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'TEST FAILED A: assignment was not created';
  end if;
  if not exists (
    select 1 from audit_logs
    where target_id = '30000000-0000-0000-0000-000000000001'
      and action = 'rider_assignment.created'
  ) then
    raise exception 'TEST FAILED A: audit row was not created';
  end if;
end $$;

-- B: unavailable riders are rejected.
do $$
begin
  perform staff_assign_rider(
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002'
  );
  raise exception 'TEST FAILED B: unavailable rider was assigned';
exception when sqlstate 'P0001' then
  if sqlerrm <> 'RIDER_UNAVAILABLE' then raise; end if;
end $$;

-- C: non-delivery orders reject rider assignment.
do $$
begin
  perform staff_assign_rider(
    '30000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000001'
  );
  raise exception 'TEST FAILED C: pickup order accepted a rider';
exception when sqlstate 'P0001' then
  if sqlerrm <> 'DELIVERY_ONLY' then raise; end if;
end $$;

-- D: dispatch requires an active, available assigned rider.
do $$
begin
  perform staff_set_order_status(
    '30000000-0000-0000-0000-000000000002', 'out_for_delivery', null
  );
  raise exception 'TEST FAILED D: dispatch without rider was allowed';
exception when sqlstate 'P0001' then
  if sqlerrm <> 'NO_RIDER_ASSIGNED' then raise; end if;
end $$;

-- E: assignment can be removed before dispatch.
select staff_assign_rider('30000000-0000-0000-0000-000000000001', null);
do $$
begin
  if exists (
    select 1 from rider_assignments
    where order_id = '30000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'TEST FAILED E: assignment was not removed';
  end if;
end $$;

-- F: an assigned ready delivery can move out for delivery.
select staff_assign_rider(
  '30000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000001'
);
select staff_set_order_status(
  '30000000-0000-0000-0000-000000000002', 'out_for_delivery', null
);
do $$
begin
  if (select status from orders where id = '30000000-0000-0000-0000-000000000002') <> 'out_for_delivery' then
    raise exception 'TEST FAILED F: assigned delivery did not dispatch';
  end if;
end $$;

-- G: a rider account cannot call the staff assignment RPC.
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
do $$
begin
  perform staff_assign_rider(
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001'
  );
  raise exception 'TEST FAILED G: rider account used staff assignment RPC';
exception when sqlstate 'P0001' then
  if sqlerrm <> 'FORBIDDEN' then raise; end if;
end $$;

rollback;