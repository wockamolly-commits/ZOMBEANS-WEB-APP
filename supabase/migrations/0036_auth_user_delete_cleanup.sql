-- A staff account can also have customer-owned rows because every auth.users
-- row gets a customer profile. Orders keep sales history, so detach user_id
-- instead of blocking auth deletion.

alter table orders
  drop constraint if exists orders_user_id_fkey,
  add constraint orders_user_id_fkey
    foreign key (user_id) references auth.users(id)
    on delete set null;

create or replace function delete_operations_profile(p_profile_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role user_role;
begin
  -- Direct auth-owned customer references can exist even after the operations
  -- profile has already been deleted. Clean these first for stuck Auth users.
  update orders
  set user_id = null
  where user_id = p_profile_id;

  delete from customer_addresses
  where user_id = p_profile_id;

  delete from customer_profiles
  where id = p_profile_id;

  select role
  into v_role
  from profiles
  where id = p_profile_id
  for update;

  if not found then
    return true;
  end if;

  if v_role = 'admin' then
    raise exception 'SUPER_ADMIN_DELETE_FORBIDDEN' using errcode = 'P0001';
  end if;

  update orders
  set accepted_by_profile_id = null
  where accepted_by_profile_id = p_profile_id;

  update orders
  set placed_by_profile_id = null
  where placed_by_profile_id = p_profile_id;

  update order_status_events
  set actor_profile_id = null
  where actor_profile_id = p_profile_id;

  update payments
  set recorded_by_profile_id = null
  where recorded_by_profile_id = p_profile_id;

  update audit_logs
  set actor_profile_id = null
  where actor_profile_id = p_profile_id;

  update staff_invitations
  set
    invited_by_profile_id = case
      when invited_by_profile_id = p_profile_id then null
      else invited_by_profile_id
    end,
    accepted_by_profile_id = case
      when accepted_by_profile_id = p_profile_id then null
      else accepted_by_profile_id
    end,
    status = case
      when accepted_by_profile_id = p_profile_id and status in ('pending', 'accepted')
        then 'revoked'
      else status
    end,
    revoked_at = case
      when accepted_by_profile_id = p_profile_id and status in ('pending', 'accepted')
        then coalesce(revoked_at, now())
      else revoked_at
    end
  where invited_by_profile_id = p_profile_id
     or accepted_by_profile_id = p_profile_id;

  delete from rider_assignments
  where rider_profile_id = p_profile_id;

  delete from riders
  where profile_id = p_profile_id;

  if to_regclass('public.staff_passkey_challenges') is not null then
    execute 'delete from public.staff_passkey_challenges where profile_id = $1'
    using p_profile_id;
  end if;

  if to_regclass('public.staff_passkeys') is not null then
    execute 'delete from public.staff_passkeys where profile_id = $1'
    using p_profile_id;
  end if;

  delete from profiles
  where id = p_profile_id;

  return true;
end;
$$;

revoke all on function delete_operations_profile(uuid) from public;
revoke all on function delete_operations_profile(uuid) from anon;
revoke all on function delete_operations_profile(uuid) from authenticated;
grant execute on function delete_operations_profile(uuid) to service_role;
