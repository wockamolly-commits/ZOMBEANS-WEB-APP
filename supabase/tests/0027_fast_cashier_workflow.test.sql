begin;

do $$
begin
  if has_function_privilege(
    'anon',
    'cashier_advance_order(uuid)',
    'EXECUTE'
  ) then
    raise exception 'TEST FAILED: anon can advance orders';
  end if;

  if not has_function_privilege(
    'authenticated',
    'cashier_advance_order(uuid)',
    'EXECUTE'
  ) then
    raise exception 'TEST FAILED: cashier advance grant missing';
  end if;

  raise notice 'PASS: fast cashier workflow privileges';
end
$$;

rollback;
