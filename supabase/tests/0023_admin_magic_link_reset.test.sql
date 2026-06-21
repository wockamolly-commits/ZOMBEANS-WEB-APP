begin;

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where indexname = 'profiles_single_super_admin_idx'
  ) then
    raise exception 'TEST FAILED: single Super Admin index missing';
  end if;

  if has_function_privilege(
    'anon',
    'claim_pending_staff_invitation()',
    'EXECUTE'
  ) then
    raise exception 'TEST FAILED: anon can claim staff invitation';
  end if;

  if not has_function_privilege(
    'authenticated',
    'claim_pending_staff_invitation()',
    'EXECUTE'
  ) then
    raise exception 'TEST FAILED: authenticated cannot claim invitation';
  end if;

  raise notice 'PASS: admin magic-link reset privileges and constraints';
end
$$;

rollback;
