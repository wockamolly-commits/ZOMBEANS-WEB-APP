begin;

do $$
begin
  if exists (
    select 1
    from pg_trigger
    where tgname in (
      'prevent_own_order_status_change_trigger',
      'prevent_own_order_payment_change_trigger',
      'prevent_own_order_rider_assignment_trigger'
    )
      and not tgisinternal
  ) then
    raise exception 'TEST FAILED: self-processing restriction remains';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'require_provider_for_online_payment_trigger'
      and not tgisinternal
  ) then
    raise exception 'TEST FAILED: online payment safeguard missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'audit_manual_payment_change_trigger'
      and not tgisinternal
  ) then
    raise exception 'TEST FAILED: payment audit trigger missing';
  end if;

  if has_function_privilege(
    'anon',
    'super_admin_place_order(jsonb, boolean)',
    'EXECUTE'
  ) then
    raise exception 'TEST FAILED: Super Admin order RPC exposed to anon';
  end if;

  if to_regprocedure('operations_place_order(jsonb,boolean)') is not null then
    raise exception 'TEST FAILED: staff ordering RPC still exists';
  end if;

  raise notice 'PASS: cashier processing and payment safeguards';
end
$$;

rollback;
