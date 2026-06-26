begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  created_at, raw_app_meta_data, raw_user_meta_data, updated_at
)
values
  (
    '41000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'perm-override-self@zombeans.local', '',
    now(), '{}', '{}', now()
  ),
  (
    '41000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'perm-override-other@zombeans.local', '',
    now(), '{}', '{}', now()
  );

insert into profiles (id, role, staff_role, display_name, is_active)
values
  ('41000000-0000-0000-0000-000000000001', 'staff', 'cashier', 'Override Self', true),
  ('41000000-0000-0000-0000-000000000002', 'staff', 'cashier', 'Override Other', true);

insert into staff_permission_overrides (profile_id, permission, granted, updated_by)
values
  ('41000000-0000-0000-0000-000000000001', 'menu:configure', true,
   '41000000-0000-0000-0000-000000000001'),
  ('41000000-0000-0000-0000-000000000002', 'menu:configure', true,
   '41000000-0000-0000-0000-000000000002');

select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
  v_self_count integer;
  v_other_count integer;
begin
  set local role authenticated;

  select count(*) into v_self_count
  from staff_permission_overrides
  where profile_id = '41000000-0000-0000-0000-000000000001';

  select count(*) into v_other_count
  from staff_permission_overrides
  where profile_id = '41000000-0000-0000-0000-000000000002';

  reset role;

  if v_self_count <> 1 then
    raise exception 'TEST FAILED: user could not read their own override (got %)', v_self_count;
  end if;

  if v_other_count <> 0 then
    raise exception 'TEST FAILED: RLS leaked another profile''s overrides (got %)', v_other_count;
  end if;

  raise notice 'PASS: staff_permission_overrides self-select RLS holds';
end
$$;

rollback;
