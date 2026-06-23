-- Explicit job roles for operations accounts. The existing user_role enum
-- remains the broad auth/RLS account class; staff_role is the assigned job.
create type staff_role as enum ('cashier', 'rider');

alter table profiles
  add column staff_role staff_role;

update profiles
set staff_role = case
  when role = 'staff' then 'cashier'::staff_role
  when role = 'rider' then 'rider'::staff_role
  else null
end;

alter table profiles
  add constraint profiles_staff_role_matches_account_check check (
    (role = 'admin' and staff_role is null)
    or (role = 'staff' and staff_role = 'cashier')
    or (role = 'rider' and staff_role = 'rider')
  );

create index profiles_staff_role_idx on profiles(staff_role);

alter table staff_invitations
  add column staff_role staff_role not null default 'cashier';

alter table staff_invitations
  drop constraint if exists staff_invitations_staff_only_check;

alter table staff_invitations
  add constraint staff_invitations_assignable_role_check check (
    (role = 'staff' and staff_role = 'cashier')
    or (role = 'rider' and staff_role = 'rider')
  );

-- Claim the exact assigned job role from the invitation. Only cashier
-- invitations are currently created by the app, but this function is ready
-- for rider invitations once that feature is enabled.
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
