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
  '38000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'manual-payment-stage-test@zombeans.local',
  '',
  now(),
  '{}',
  '{}',
  now()
);

insert into profiles (id, role, staff_role, display_name, is_active)
values (
  '38000000-0000-0000-0000-000000000001',
  'staff',
  'cashier',
  'Manual Payment Stage Test Staff',
  true
);

select set_config(
  'request.jwt.claim.sub',
  '38000000-0000-0000-0000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
  v_pending_order_id uuid := gen_random_uuid();
  v_accepted_order_id uuid := gen_random_uuid();
  v_preparing_order_id uuid := gen_random_uuid();
  v_preparing_gcash_order_id uuid := gen_random_uuid();
  v_ready_order_id uuid := gen_random_uuid();
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
      v_pending_order_id,
      'MPSTG1',
      'pending',
      'pickup',
      'Pending Payment Stage Test',
      10000,
      10000
    ),
    (
      v_accepted_order_id,
      'MPSTG2',
      'accepted',
      'pickup',
      'Accepted Payment Stage Test',
      10000,
      10000
    ),
    (
      v_preparing_order_id,
      'MPSTG3',
      'preparing',
      'pickup',
      'Preparing Payment Stage Test',
      10000,
      10000
    ),
    (
      v_preparing_gcash_order_id,
      'MPSTG4',
      'preparing',
      'pickup',
      'Preparing GCash Payment Stage Test',
      10000,
      10000
    ),
    (
      v_ready_order_id,
      'MPSTG5',
      'ready',
      'pickup',
      'Ready Payment Stage Test',
      10000,
      10000
    );

  insert into payments (order_id, method, status, amount_cents)
  values
    (v_pending_order_id, 'cash', 'pending', 10000),
    (v_accepted_order_id, 'cash', 'pending', 10000),
    (v_preparing_order_id, 'cash', 'pending', 10000),
    (v_preparing_gcash_order_id, 'gcash', 'paid', 10000),
    (v_ready_order_id, 'cash', 'pending', 10000);

  begin
    perform staff_record_payment(v_pending_order_id, null);
    raise exception 'TEST FAILED: pending order payment was recorded';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'PAYMENT_STAGE_LOCKED' then
        raise exception
          'TEST FAILED: expected PAYMENT_STAGE_LOCKED for pending, got %',
          sqlerrm;
      end if;
  end;

  begin
    perform staff_record_payment(v_accepted_order_id, null);
    raise exception 'TEST FAILED: accepted order payment was recorded';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'PAYMENT_STAGE_LOCKED' then
        raise exception
          'TEST FAILED: expected PAYMENT_STAGE_LOCKED for accepted, got %',
          sqlerrm;
      end if;
  end;

  begin
    perform staff_record_payment(v_preparing_order_id, null);
    raise exception 'TEST FAILED: preparing order payment was recorded';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'PAYMENT_STAGE_LOCKED' then
        raise exception
          'TEST FAILED: expected PAYMENT_STAGE_LOCKED for preparing, got %',
          sqlerrm;
      end if;
  end;

  perform staff_record_payment(v_preparing_gcash_order_id, 'verified');

  if not exists (
    select 1
    from payments
    where order_id = v_preparing_gcash_order_id
      and status = 'paid'
      and reference = 'verified'
  ) then
    raise exception 'TEST FAILED: already-paid non-cash payment behavior was changed';
  end if;

  perform staff_record_payment(v_ready_order_id, 'counter');

  if not exists (
    select 1
    from payments
    where order_id = v_ready_order_id
      and status = 'paid'
      and reference = 'counter'
  ) then
    raise exception 'TEST FAILED: ready order payment was not recorded';
  end if;

  raise notice 'PASS: manual payment confirmation is stage-gated';
end
$$;

rollback;
