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
values
  (
    '50000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'cash-delivery-staff@zombeans.local',
    '',
    now(),
    '{}',
    '{}',
    now()
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'cash-delivery-rider@zombeans.local',
    '',
    now(),
    '{}',
    '{}',
    now()
  );

insert into profiles (id, role, staff_role, display_name, is_active)
values
  (
    '50000000-0000-0000-0000-000000000001',
    'staff',
    'cashier',
    'Cash Delivery Staff',
    true
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    'rider',
    'rider',
    'Cash Delivery Rider',
    true
  );

insert into riders (profile_id, is_available)
values ('50000000-0000-0000-0000-000000000002', true);

select set_config(
  'request.jwt.claim.sub',
  '50000000-0000-0000-0000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
  v_payment_order_id uuid := gen_random_uuid();
  v_advance_order_id uuid := gen_random_uuid();
  v_status_order_id uuid := gen_random_uuid();
  v_rider_order_id uuid := gen_random_uuid();
begin
  insert into orders (
    id,
    short_code,
    status,
    service_mode,
    customer_name,
    subtotal_cents,
    total_cents
  )
  values
    (
      v_payment_order_id,
      'CDR501',
      'out_for_delivery',
      'delivery',
      'Cash Delivery Payment Guard',
      10000,
      10000
    ),
    (
      v_advance_order_id,
      'CDR502',
      'out_for_delivery',
      'delivery',
      'Cash Delivery Advance Guard',
      10000,
      10000
    ),
    (
      v_status_order_id,
      'CDR503',
      'out_for_delivery',
      'delivery',
      'Cash Delivery Status Guard',
      10000,
      10000
    ),
    (
      v_rider_order_id,
      'CDR504',
      'out_for_delivery',
      'delivery',
      'Cash Delivery Rider Success',
      10000,
      10000
    );

  insert into payments (order_id, method, status, amount_cents)
  values
    (v_payment_order_id, 'cash', 'pending', 10000),
    (v_advance_order_id, 'cash', 'pending', 10000),
    (v_status_order_id, 'cash', 'pending', 10000),
    (v_rider_order_id, 'cash', 'pending', 10000);

  insert into rider_assignments (order_id, rider_profile_id, assigned_at, picked_up_at)
  values
    (
      v_payment_order_id,
      '50000000-0000-0000-0000-000000000002',
      now(),
      now()
    ),
    (
      v_advance_order_id,
      '50000000-0000-0000-0000-000000000002',
      now(),
      now()
    ),
    (
      v_status_order_id,
      '50000000-0000-0000-0000-000000000002',
      now(),
      now()
    ),
    (
      v_rider_order_id,
      '50000000-0000-0000-0000-000000000002',
      now(),
      now()
    );

  begin
    perform staff_record_payment(v_payment_order_id, 'cash-collected');
    raise exception 'TEST FAILED: staff recorded cash delivery payment';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'CASH_DELIVERY_RIDER_ONLY' then
        raise exception
          'TEST FAILED: expected CASH_DELIVERY_RIDER_ONLY for payment, got %',
          sqlerrm;
      end if;
  end;

  begin
    perform cashier_advance_order(v_advance_order_id);
    raise exception 'TEST FAILED: staff advanced cash delivery to completed';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'CASH_DELIVERY_RIDER_ONLY' then
        raise exception
          'TEST FAILED: expected CASH_DELIVERY_RIDER_ONLY for advance, got %',
          sqlerrm;
      end if;
  end;

  begin
    perform staff_set_order_status(v_status_order_id, 'completed', null);
    raise exception 'TEST FAILED: staff marked cash delivery completed';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'CASH_DELIVERY_RIDER_ONLY' then
        raise exception
          'TEST FAILED: expected CASH_DELIVERY_RIDER_ONLY for completion, got %',
          sqlerrm;
      end if;
  end;

  perform set_config(
    'request.jwt.claim.sub',
    '50000000-0000-0000-0000-000000000002',
    true
  );

  perform rider_mark_delivered(v_rider_order_id);

  if not exists (
    select 1
    from orders o
    join payments p on p.order_id = o.id
    join rider_assignments ra on ra.order_id = o.id
    where o.id = v_rider_order_id
      and o.status = 'completed'
      and p.status = 'paid'
      and p.recorded_by_profile_id = '50000000-0000-0000-0000-000000000002'
      and ra.delivered_at is not null
  ) then
    raise exception 'TEST FAILED: assigned rider did not complete and collect cash';
  end if;

  raise notice 'PASS: cash delivery payment and delivery confirmation are rider-only';
end
$$;

rollback;
