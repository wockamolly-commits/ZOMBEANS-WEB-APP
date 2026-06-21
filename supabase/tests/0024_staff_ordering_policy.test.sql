begin;

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  created_at,
  raw_app_meta_data,
  raw_user_meta_data,
  updated_at
)
values (
  '24000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'staff-ordering-test@zombeans.local',
  '',
  now(),
  '{}',
  '{}',
  now()
);

insert into profiles (id, role, display_name, is_active)
values (
  '24000000-0000-0000-0000-000000000001',
  'staff',
  'Ordering Policy Test Staff',
  true
);

select set_config(
  'request.jwt.claim.sub',
  '24000000-0000-0000-0000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'enforce_operations_ordering_policy_trigger'
      and not tgisinternal
  ) then
    raise exception 'TEST FAILED: staff ordering trigger missing';
  end if;

  if to_regprocedure('operations_place_order(jsonb,boolean)') is not null then
    raise exception 'TEST FAILED: staff ordering RPC exists';
  end if;

  if has_function_privilege(
    'anon',
    'super_admin_place_order(jsonb, boolean)',
    'EXECUTE'
  ) then
    raise exception 'TEST FAILED: Super Admin order RPC exposed to anon';
  end if;

  if not has_function_privilege(
    'authenticated',
    'super_admin_place_order(jsonb, boolean)',
    'EXECUTE'
  ) then
    raise exception 'TEST FAILED: Super Admin order RPC grant missing';
  end if;

  raise notice 'PASS: staff ordering restriction and Super Admin exemption';
end
$$;

do $$
declare
  v_item record;
begin
  select mi.slug, iv.label
  into v_item
  from menu_items mi
  join item_variations iv on iv.item_id = mi.id
  where mi.is_active and iv.is_active
  limit 1;

  perform place_order(jsonb_build_object(
    'service_mode', 'pickup',
    'customer_name', 'Policy Test Staff',
    'customer_phone', '09186056360',
    'pickup_time', (now() + interval '1 hour')::text,
    'payment_method', 'cash',
    'lines', jsonb_build_array(jsonb_build_object(
      'item_slug', v_item.slug,
      'variation_label', v_item.label,
      'qty', 1
    ))
  ));

  raise exception 'TEST FAILED: staff account placed a webstore order';
exception
  when sqlstate 'P0001' then
    if sqlerrm <> 'STAFF_ORDERING_FORBIDDEN' then
      raise exception
        'TEST FAILED: expected STAFF_ORDERING_FORBIDDEN, got %',
        sqlerrm;
    end if;
    raise notice 'PASS: staff order transaction rejected';
end
$$;

rollback;
