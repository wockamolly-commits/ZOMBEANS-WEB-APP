-- Passwordless staff authentication with WebAuthn/passkeys.
-- Tables are service-role only; browser clients receive no direct access.

create table staff_passkeys (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  email text not null,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0,
  device_type text not null,
  backed_up boolean not null default false,
  transports text[] not null default '{}',
  label text not null default 'Passkey',
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index staff_passkeys_profile_id_idx on staff_passkeys(profile_id);
create index staff_passkeys_email_idx on staff_passkeys(lower(email));

create table staff_passkey_challenges (
  id uuid primary key default gen_random_uuid(),
  browser_token text not null unique,
  profile_id uuid not null references profiles(id) on delete cascade,
  purpose text not null check (purpose in ('registration', 'authentication')),
  challenge text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index staff_passkey_challenges_expiry_idx
  on staff_passkey_challenges(expires_at);

alter table staff_passkeys enable row level security;
alter table staff_passkey_challenges enable row level security;

-- Resolve an active operations account without exposing auth.users to clients.
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
    and p.role in ('staff', 'admin')
  limit 1
$$;

revoke all on function resolve_active_operations_email(text) from public;
revoke all on function resolve_active_operations_email(text) from anon;
revoke all on function resolve_active_operations_email(text) from authenticated;
grant execute on function resolve_active_operations_email(text) to service_role;
-- Atomically claim a challenge so concurrent verification attempts cannot replay it.
create or replace function consume_staff_passkey_challenge(
  p_browser_token text,
  p_purpose text
)
returns table (
  id uuid,
  browser_token text,
  profile_id uuid,
  purpose text,
  challenge text,
  expires_at timestamptz,
  used_at timestamptz
)
language sql
volatile
security definer
set search_path = public
as $$
  update public.staff_passkey_challenges c
  set used_at = now()
  where c.browser_token = p_browser_token
    and c.purpose = p_purpose
    and c.used_at is null
    and c.expires_at > now()
  returning c.id, c.browser_token, c.profile_id, c.purpose,
            c.challenge, c.expires_at, c.used_at
$$;

revoke all on function consume_staff_passkey_challenge(text, text) from public;
revoke all on function consume_staff_passkey_challenge(text, text) from anon;
revoke all on function consume_staff_passkey_challenge(text, text) from authenticated;
grant execute on function consume_staff_passkey_challenge(text, text) to service_role;