-- supabase/migrations/0019_rider_assignment.sql
-- Phase 2 (Admin Dashboard) — secure rider assignment for delivery orders.

-- Inactive operational accounts must lose RLS access immediately, not only UI
-- access. Customer accounts have no profiles row and continue to resolve null.
create or replace function current_role_kind()
returns user_role
language sql stable security definer set search_path = public
as $$
  select role from profiles where id = auth.uid() and is_active
$$;
-- Staff need read access to the rider roster and current assignments. Direct
-- writes remain unavailable; assignment changes go through the RPC below.
create policy "staff read riders" on riders for select
  using (current_role_kind() in ('staff','admin'));

create policy "staff read rider assignments" on rider_assignments for select
  using (current_role_kind() in ('staff','admin'));

-- Assign, reassign, or unassign a rider before dispatch. Passing null removes
-- the current assignment. Every effective change is recorded in audit_logs.
create or replace function staff_assign_rider(
  p_order_id        uuid,
  p_rider_profile_id uuid default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status order_status;
  v_mode service_mode;
  v_previous uuid;
begin
  if not exists (
    select 1 from profiles
    where id = v_uid and role in ('staff','admin') and is_active
  ) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select status, service_mode into v_status, v_mode
    from orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_mode <> 'delivery' then
    raise exception 'DELIVERY_ONLY' using errcode = 'P0001';
  end if;

  if v_status not in ('accepted','preparing','ready') then
    raise exception 'ASSIGNMENT_LOCKED' using errcode = 'P0001';
  end if;

  select rider_profile_id into v_previous
    from rider_assignments where order_id = p_order_id for update;

  if p_rider_profile_id is null then
    if v_previous is null then
      return;
    end if;

    delete from rider_assignments where order_id = p_order_id;

    insert into audit_logs (actor_profile_id, action, target_table, target_id, diff)
    values (
      v_uid,
      'rider_assignment.removed',
      'rider_assignments',
      p_order_id::text,
      jsonb_build_object('from_rider_profile_id', v_previous, 'to_rider_profile_id', null)
    );
    return;
  end if;

  perform 1
  from profiles p
  join riders r on r.profile_id = p.id
  where p.id = p_rider_profile_id
    and p.role = 'rider'
    and p.is_active
    and r.is_available
  for update of r;
  if not found then
    raise exception 'RIDER_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if v_previous = p_rider_profile_id then
    return;
  end if;

  insert into rider_assignments (
    order_id, rider_profile_id, assigned_at, picked_up_at, delivered_at
  ) values (
    p_order_id, p_rider_profile_id, now(), null, null
  )
  on conflict (order_id) do update set
    rider_profile_id = excluded.rider_profile_id,
    assigned_at = excluded.assigned_at,
    picked_up_at = null,
    delivered_at = null;

  insert into audit_logs (actor_profile_id, action, target_table, target_id, diff)
  values (
    v_uid,
    case when v_previous is null
      then 'rider_assignment.created'
      else 'rider_assignment.changed'
    end,
    'rider_assignments',
    p_order_id::text,
    jsonb_build_object(
      'from_rider_profile_id', v_previous,
      'to_rider_profile_id', p_rider_profile_id
    )
  );
end;
$$;

-- Harden dispatch: a delivery cannot leave the ready column without an
-- assigned rider. This replaces the 0018 function while preserving its
-- existing transition and audit behavior.
create or replace function staff_set_order_status(
  p_order_id uuid,
  p_to       order_status,
  p_reason   text default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_from order_status;
  v_mode service_mode;
begin
  if not exists (
    select 1 from profiles
    where id = v_uid and role in ('staff','admin') and is_active
  ) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select status, service_mode into v_from, v_mode
    from orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;

  if not (
       (v_from = 'pending'          and p_to in ('accepted','rejected','cancelled'))
    or (v_from = 'accepted'         and p_to in ('preparing','cancelled'))
    or (v_from = 'preparing'        and p_to in ('ready','cancelled'))
    or (v_from = 'ready'            and p_to in ('out_for_delivery','completed'))
    or (v_from = 'out_for_delivery' and p_to = 'completed')
  ) then
    raise exception 'INVALID_TRANSITION:%->%', v_from, p_to using errcode = 'P0001';
  end if;

  if v_from = 'ready' and p_to = 'completed' and v_mode = 'delivery' then
    raise exception 'DELIVERY_NEEDS_OFD' using errcode = 'P0001';
  end if;
  if p_to = 'out_for_delivery' and v_mode <> 'delivery' then
    raise exception 'OFD_DELIVERY_ONLY' using errcode = 'P0001';
  end if;
  if p_to = 'out_for_delivery' and not exists (
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

  update orders set
    status                 = p_to,
    accepted_at            = case when p_to = 'accepted'  then now() else accepted_at end,
    accepted_by_profile_id = case when p_to = 'accepted'  then v_uid else accepted_by_profile_id end,
    ready_at               = case when p_to = 'ready'     then now() else ready_at end,
    completed_at           = case when p_to = 'completed' then now() else completed_at end,
    rejected_at            = case when p_to in ('rejected','cancelled') then now()    else rejected_at end,
    rejected_reason        = case when p_to in ('rejected','cancelled') then p_reason else rejected_reason end
  where id = p_order_id;

  if p_to = 'cancelled' then
    insert into audit_logs (actor_profile_id, action, target_table, target_id, diff)
    select
      v_uid,
      'rider_assignment.removed',
      'rider_assignments',
      p_order_id::text,
      jsonb_build_object(
        'from_rider_profile_id', rider_profile_id,
        'to_rider_profile_id', null,
        'reason', 'order_cancelled'
      )
    from rider_assignments
    where order_id = p_order_id;

    delete from rider_assignments where order_id = p_order_id;
  end if;

  insert into order_status_events (order_id, from_status, to_status, actor_profile_id, reason)
  values (p_order_id, v_from, p_to, v_uid, p_reason);
end;
$$;

grant execute on function staff_assign_rider(uuid, uuid) to authenticated;