begin;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'staff_role'
  ) then
    raise exception 'TEST FAILED: staff_role enum missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'staff_role'
  ) then
    raise exception 'TEST FAILED: profiles.staff_role missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'staff_invitations'
      and column_name = 'staff_role'
  ) then
    raise exception 'TEST FAILED: staff_invitations.staff_role missing';
  end if;

  raise notice 'PASS: explicit staff roles are stored on invitations and profiles';
end
$$;

rollback;
