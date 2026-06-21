-- Peak-hour cashier workflow:
-- pending -> preparing -> ready -> completed
-- The legacy accepted state remains supported but no longer needs its own click.
-- Completing a cash order marks its payment paid in the same transaction.

create or replace function cashier_advance_order(p_order_id uuid)
returns order_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_from order_status;
  v_to order_status;
  v_mode service_mode;
  v_payment_method payment_method;
  v_payment_status payment_status;
begin
  if not exists (
    select 1
    from profiles
    where id = v_uid
      and role in ('staff', 'admin')
      and is_active
  ) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select status, service_mode
  into v_from, v_mode
  from orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;

  v_to := case v_from
    when 'pending' then 'preparing'::order_status
    when 'accepted' then 'preparing'::order_status
    when 'preparing' then 'ready'::order_status
    when 'ready' then case
      when v_mode = 'delivery' then 'out_for_delivery'::order_status
      else 'completed'::order_status
    end
    when 'out_for_delivery' then 'completed'::order_status
    else null
  end;

  if v_to is null then
    raise exception 'INVALID_TRANSITION:%', v_from using errcode = 'P0001';
  end if;

  if v_to = 'out_for_delivery' and not exists (
    select 1
    from rider_assignments ra
    join profiles p on p.id = ra.rider_profile_id
    join riders r on r.profile_id = p.id
    where ra.order_id = p_order_id
      and p.role = 'rider'
      and p.is_active
      and r.is_available
  ) then
    raise exception 'NO_RIDER_ASSIGNED' using errcode = 'P0001';
  end if;

  if v_to = 'completed' then
    select method, status
    into v_payment_method, v_payment_status
    from payments
    where order_id = p_order_id
    for update;

    if not found then
      raise exception 'PAYMENT_NOT_FOUND' using errcode = 'P0001';
    end if;

    if v_payment_method <> 'cash' and v_payment_status <> 'paid' then
      raise exception 'PAYMENT_REQUIRED' using errcode = 'P0001';
    end if;
  end if;

  update orders
  set status = v_to,
      accepted_at = case
        when v_from in ('pending', 'accepted')
          then coalesce(accepted_at, now())
        else accepted_at
      end,
      accepted_by_profile_id = case
        when v_from in ('pending', 'accepted')
          then coalesce(accepted_by_profile_id, v_uid)
        else accepted_by_profile_id
      end,
      ready_at = case when v_to = 'ready' then now() else ready_at end,
      completed_at = case
        when v_to = 'completed' then now()
        else completed_at
      end
  where id = p_order_id;

  if v_from = 'pending' then
    insert into order_status_events (
      order_id,
      from_status,
      to_status,
      actor_profile_id,
      reason
    )
    values (
      p_order_id,
      'pending',
      'accepted',
      v_uid,
      'Automatically accepted when preparation started'
    );

    insert into order_status_events (
      order_id,
      from_status,
      to_status,
      actor_profile_id
    )
    values (p_order_id, 'accepted', 'preparing', v_uid);
  else
    insert into order_status_events (
      order_id,
      from_status,
      to_status,
      actor_profile_id
    )
    values (p_order_id, v_from, v_to, v_uid);
  end if;

  if v_to = 'completed' and v_payment_method = 'cash'
    and v_payment_status <> 'paid'
  then
    update payments
    set status = 'paid',
        paid_at = now(),
        recorded_by_profile_id = v_uid
    where order_id = p_order_id;
  end if;

  return v_to;
end;
$$;

revoke all on function cashier_advance_order(uuid) from public;
revoke all on function cashier_advance_order(uuid) from anon;
grant execute on function cashier_advance_order(uuid) to authenticated;
