-- Super Admin-managed staff invitations. The existing admin role is the Super Admin authority.
create table staff_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  display_name text not null,
  role user_role not null default 'staff' check (role in ('staff', 'admin')),
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invited_by_profile_id uuid not null references profiles(id),
  accepted_by_profile_id uuid references profiles(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index staff_invitations_email_idx on staff_invitations(lower(email));
create index staff_invitations_status_expiry_idx on staff_invitations(status, expires_at);
alter table staff_invitations enable row level security;
grant select, insert, update, delete on staff_invitations to service_role;

create or replace function accept_staff_invitation(p_token_hash text)
returns user_role language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_invite staff_invitations%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = 'P0001'; end if;
  select email into v_email from auth.users where id = v_uid;
  select * into v_invite from staff_invitations where token_hash = p_token_hash for update;
  if not found or v_invite.status <> 'pending' or v_invite.expires_at <= now() then
    raise exception 'INVITE_INVALID_OR_EXPIRED' using errcode = 'P0001';
  end if;
  if lower(v_invite.email) <> lower(coalesce(v_email, '')) then
    raise exception 'INVITE_EMAIL_MISMATCH' using errcode = 'P0001';
  end if;
  insert into profiles (id, role, display_name, is_active)
  values (v_uid, v_invite.role, v_invite.display_name, true)
  on conflict (id) do update set role = excluded.role, display_name = excluded.display_name, is_active = true;
  update staff_invitations set status = 'accepted', accepted_by_profile_id = v_uid, accepted_at = now() where id = v_invite.id;
  insert into audit_logs (actor_profile_id, action, target_table, target_id, diff)
  values (v_uid, 'staff_invitation.accepted', 'profiles', v_uid::text,
    jsonb_build_object('invitation_id', v_invite.id, 'role', v_invite.role, 'invited_by_profile_id', v_invite.invited_by_profile_id));
  return v_invite.role;
end; $$;
revoke all on function accept_staff_invitation(text) from public;
revoke all on function accept_staff_invitation(text) from anon;
grant execute on function accept_staff_invitation(text) to authenticated;
