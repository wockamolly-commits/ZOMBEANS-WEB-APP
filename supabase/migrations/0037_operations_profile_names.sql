-- Operations users can now maintain both a display name and full profile name.
alter table profiles
  add column if not exists full_name text,
  add column if not exists updated_at timestamptz not null default now();

update profiles
set full_name = display_name
where full_name is null;

drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- Keep accepted staff profiles initialized with a full name. The app lets each
-- operations user edit their own names after activation.
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

  insert into profiles (id, role, staff_role, display_name, full_name, is_active)
  values (
    v_uid,
    v_invite.role,
    v_invite.staff_role,
    v_invite.display_name,
    v_invite.display_name,
    true
  )
  on conflict (id) do update
    set role = excluded.role,
        staff_role = excluded.staff_role,
        display_name = excluded.display_name,
        full_name = coalesce(profiles.full_name, excluded.full_name),
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
