begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  created_at, raw_app_meta_data, raw_user_meta_data, updated_at
)
values
  (
    '42000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'option-avail-cashier@zombeans.local', '',
    now(), '{}', '{}', now()
  );

insert into profiles (id, role, staff_role, display_name, is_active)
values
  ('42000000-0000-0000-0000-000000000001', 'staff', 'cashier', 'Option Avail Cashier', true);

-- Seed option group and an inactive option as a privileged role (bypasses RLS).
insert into menu_option_groups (id, name, is_active, sort_order)
values ('42000000-0000-0000-0000-000000000010', 'Test Group 42', true, 999);

insert into menu_options (id, group_id, name, price_delta_cents, is_active, sort_order)
values ('42000000-0000-0000-0000-000000000020', '42000000-0000-0000-0000-000000000010',
        'Test Option 42', 0, false, 999);

select set_config('request.jwt.claim.sub', '42000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
  v_inactive_count integer;
  v_updated_count  integer;
begin
  set local role authenticated;

  -- Assert 1: cashier can SELECT the inactive option (migration 0042 drops the
  -- admin-only write policy whose USING clause previously hid inactive rows).
  select count(*) into v_inactive_count
  from menu_options
  where id = '42000000-0000-0000-0000-000000000020'
    and is_active = false;

  -- Assert 2: cashier can UPDATE is_active to true.
  update menu_options
  set is_active = true
  where id = '42000000-0000-0000-0000-000000000020';

  select count(*) into v_updated_count
  from menu_options
  where id = '42000000-0000-0000-0000-000000000020'
    and is_active = true;

  reset role;

  if v_inactive_count <> 1 then
    raise exception 'TEST FAILED: cashier could not read inactive option (got %)', v_inactive_count;
  end if;

  if v_updated_count <> 1 then
    raise exception 'TEST FAILED: cashier write was blocked or change not visible (got %)', v_updated_count;
  end if;

  raise notice 'PASS: cashier can read inactive options and toggle availability under RLS';
end
$$;

rollback;
