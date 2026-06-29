-- Rider app core: active riders can authenticate, read their assigned delivery
-- details, and mark pickup/delivery progress without staff dashboard access.

create or replace function resolve_active_operations_email(p_email text)
returns table (
  id uuid,
  role user_role,
  display_name text,
  email text
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select p.id, p.role, p.display_name, u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(u.email) = lower(trim(p_email))
    and p.is_active
    and p.role in ('staff', 'admin', 'rider')
  limit 1
$$;

revoke all on function resolve_active_operations_email(text) from public;
revoke all on function resolve_active_operations_email(text) from anon;
revoke all on function resolve_active_operations_email(text) from authenticated;
grant execute on function resolve_active_operations_email(text) to service_role;

create or replace function claim_pending_staff_invitation()
returns user_role
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_invite staff_invitations%rowtype;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  select email into v_email from auth.users where id = v_uid;
  if v_email is null then
    raise exception 'VERIFIED_EMAIL_REQUIRED' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from profiles where id = v_uid and role = 'admin'
  ) then
    return 'admin'::user_role;
  end if;

  select *
  into v_invite
  from staff_invitations
  where lower(email) = lower(v_email)
    and status = 'pending'
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;

  if not found then return null; end if;

  insert into profiles (id, role, staff_role, display_name, is_active)
  values (
    v_uid,
    v_invite.role,
    v_invite.staff_role,
    v_invite.display_name,
    true
  )
  on conflict (id) do update
    set role = excluded.role,
        staff_role = excluded.staff_role,
        display_name = excluded.display_name,
        is_active = true;

  if v_invite.role = 'rider' then
    insert into riders (profile_id, is_available)
    values (v_uid, true)
    on conflict (profile_id) do update
      set is_available = true;
  end if;

  update staff_invitations
  set status = 'accepted',
      accepted_by_profile_id = v_uid,
      accepted_at = now()
  where id = v_invite.id;

  insert into audit_logs (
    actor_profile_id,
    action,
    target_table,
    target_id,
    diff
  )
  values (
    v_uid,
    'staff_invitation.accepted',
    'profiles',
    v_uid::text,
    jsonb_build_object(
      'invitation_id', v_invite.id,
      'role', v_invite.role,
      'staff_role', v_invite.staff_role,
      'invited_by_profile_id', v_invite.invited_by_profile_id
    )
  );

  return v_invite.role;
end;
$$;

revoke all on function claim_pending_staff_invitation() from public;
revoke all on function claim_pending_staff_invitation() from anon;
grant execute on function claim_pending_staff_invitation() to authenticated;

create policy "rider read assigned order items"
  on order_items for select
  using (
    current_role_kind() = 'rider'
    and exists (
      select 1
      from rider_assignments ra
      where ra.order_id = order_items.order_id
        and ra.rider_profile_id = auth.uid()
    )
  );

create policy "rider read assigned order item options"
  on order_item_options for select
  using (
    current_role_kind() = 'rider'
    and exists (
      select 1
      from order_items oi
      join rider_assignments ra on ra.order_id = oi.order_id
      where oi.id = order_item_options.order_item_id
        and ra.rider_profile_id = auth.uid()
    )
  );

create policy "rider read assigned delivery addresses"
  on delivery_addresses for select
  using (
    current_role_kind() = 'rider'
    and exists (
      select 1
      from rider_assignments ra
      where ra.order_id = delivery_addresses.order_id
        and ra.rider_profile_id = auth.uid()
    )
  );

create policy "rider read assigned payments"
  on payments for select
  using (
    current_role_kind() = 'rider'
    and exists (
      select 1
      from rider_assignments ra
      where ra.order_id = payments.order_id
        and ra.rider_profile_id = auth.uid()
    )
  );

create or replace function assert_active_rider()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not exists (
    select 1
    from profiles p
    join riders r on r.profile_id = p.id
    where p.id = v_uid
      and p.role = 'rider'
      and p.is_active
      and r.is_available
  ) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  return v_uid;
end;
$$;

revoke all on function assert_active_rider() from public;
revoke all on function assert_active_rider() from anon;
revoke all on function assert_active_rider() from authenticated;

create or replace function rider_mark_picked_up(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := assert_active_rider();
  v_status order_status;
  v_mode service_mode;
begin
  select o.status, o.service_mode
  into v_status, v_mode
  from orders o
  join rider_assignments ra on ra.order_id = o.id
  where o.id = p_order_id
    and ra.rider_profile_id = v_uid
  for update of o, ra;

  if not found then
    raise exception 'ORDER_NOT_ASSIGNED' using errcode = 'P0001';
  end if;
  if v_mode <> 'delivery' then
    raise exception 'DELIVERY_ONLY' using errcode = 'P0001';
  end if;
  if v_status not in ('ready', 'out_for_delivery') then
    raise exception 'INVALID_TRANSITION:%', v_status using errcode = 'P0001';
  end if;

  update rider_assignments
  set picked_up_at = coalesce(picked_up_at, now())
  where order_id = p_order_id
    and rider_profile_id = v_uid;

  if v_status = 'ready' then
    update orders
    set status = 'out_for_delivery'
    where id = p_order_id;

    insert into order_status_events (
      order_id,
      from_status,
      to_status,
      actor_profile_id
    )
    values (p_order_id, 'ready', 'out_for_delivery', v_uid);
  end if;

  insert into audit_logs (actor_profile_id, action, target_table, target_id)
  values (v_uid, 'rider_assignment.picked_up', 'rider_assignments', p_order_id::text);
end;
$$;

create or replace function rider_mark_delivered(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := assert_active_rider();
  v_status order_status;
  v_mode service_mode;
  v_payment_method payment_method;
  v_payment_status payment_status;
begin
  select o.status, o.service_mode
  into v_status, v_mode
  from orders o
  join rider_assignments ra on ra.order_id = o.id
  where o.id = p_order_id
    and ra.rider_profile_id = v_uid
  for update of o, ra;

  if not found then
    raise exception 'ORDER_NOT_ASSIGNED' using errcode = 'P0001';
  end if;
  if v_mode <> 'delivery' then
    raise exception 'DELIVERY_ONLY' using errcode = 'P0001';
  end if;
  if v_status <> 'out_for_delivery' then
    raise exception 'INVALID_TRANSITION:%', v_status using errcode = 'P0001';
  end if;

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

  update rider_assignments
  set picked_up_at = coalesce(picked_up_at, now()),
      delivered_at = coalesce(delivered_at, now())
  where order_id = p_order_id
    and rider_profile_id = v_uid;

  update orders
  set status = 'completed',
      completed_at = now()
  where id = p_order_id;

  insert into order_status_events (
    order_id,
    from_status,
    to_status,
    actor_profile_id
  )
  values (p_order_id, 'out_for_delivery', 'completed', v_uid);

  if v_payment_method = 'cash' and v_payment_status <> 'paid' then
    update payments
    set status = 'paid',
        paid_at = now(),
        recorded_by_profile_id = v_uid
    where order_id = p_order_id;
  end if;

  insert into audit_logs (actor_profile_id, action, target_table, target_id)
  values (v_uid, 'rider_assignment.delivered', 'rider_assignments', p_order_id::text);
end;
$$;

revoke all on function rider_mark_picked_up(uuid) from public;
revoke all on function rider_mark_picked_up(uuid) from anon;
grant execute on function rider_mark_picked_up(uuid) to authenticated;

revoke all on function rider_mark_delivered(uuid) from public;
revoke all on function rider_mark_delivered(uuid) from anon;
grant execute on function rider_mark_delivered(uuid) to authenticated;
