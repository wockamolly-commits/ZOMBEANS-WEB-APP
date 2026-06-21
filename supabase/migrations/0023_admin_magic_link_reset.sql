-- Reset operations authentication to one Super Admin plus invite-only staff.
-- Authentication is Supabase email OTP; authorization remains database-backed.

-- Preserve the oldest admin as the primary Super Admin and demote any legacy
-- additional admins before enforcing the one-account invariant.
with ranked_admins as (
  select id, row_number() over (order by created_at, id) as position
  from profiles
  where role = 'admin'
)
update profiles
set role = 'staff'
where id in (select id from ranked_admins where position > 1);

create unique index profiles_single_super_admin_idx
  on profiles ((role))
  where role = 'admin';

-- Legacy admin invitations must never create another Super Admin.
update staff_invitations
set status = 'revoked',
    revoked_at = coalesce(revoked_at, now())
where status = 'pending' and role = 'admin';

update staff_invitations set role = 'staff' where role = 'admin';
alter table staff_invitations
  drop constraint if exists staff_invitations_role_check;
alter table staff_invitations
  add constraint staff_invitations_staff_only_check check (role = 'staff');

drop function if exists accept_staff_invitation(text);
alter table staff_invitations drop column if exists token_hash;

with ranked_pending as (
  select
    id,
    row_number() over (
      partition by lower(email)
      order by created_at desc, id
    ) as position
  from staff_invitations
  where status = 'pending'
)
update staff_invitations
set status = 'revoked',
    revoked_at = coalesce(revoked_at, now())
where id in (select id from ranked_pending where position > 1);

create unique index staff_invitations_one_pending_email_idx
  on staff_invitations (lower(email))
  where status = 'pending';

-- Revoked profiles lose database access immediately even if an authentication
-- cookie remains valid in their browser.
create or replace function current_role_kind()
returns user_role
language sql stable security definer set search_path = public
as $$
  select role
  from profiles
  where id = auth.uid() and is_active
$$;

-- The verified auth.users email is the invitation credential. Claiming is
-- atomic, email-bound, single-use, and rejects expired invitations.
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

  insert into profiles (id, role, display_name, is_active)
  values (v_uid, 'staff', v_invite.display_name, true)
  on conflict (id) do update
    set role = 'staff',
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
      'role', 'staff',
      'invited_by_profile_id', v_invite.invited_by_profile_id
    )
  );

  return 'staff'::user_role;
end;
$$;

revoke all on function claim_pending_staff_invitation() from public;
revoke all on function claim_pending_staff_invitation() from anon;
grant execute on function claim_pending_staff_invitation() to authenticated;

-- Passkeys are intentionally retired. Staff and customers now share the email
-- OTP mechanism while retaining separate authorization and redirect handling.
drop function if exists consume_staff_passkey_challenge(text, text);
drop table if exists staff_passkey_challenges;
drop table if exists staff_passkeys;
