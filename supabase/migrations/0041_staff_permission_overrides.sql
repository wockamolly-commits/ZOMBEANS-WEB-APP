-- Per-staff permission overrides layered on top of role defaults. A row forces
-- a single permission ON (granted = true) or OFF (granted = false) for one
-- operations profile. Role defaults and the merge live in app code
-- (lib/staff-roles.ts); this table only stores the deltas a Super Admin sets.
create table staff_permission_overrides (
  profile_id uuid not null references profiles(id) on delete cascade,
  permission text not null,
  granted boolean not null,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  primary key (profile_id, permission)
);

alter table staff_permission_overrides enable row level security;

-- Operations users resolve their own effective permissions through the
-- RLS-enforced session client, so they must be able to read their own rows.
create policy staff_permission_overrides_self_select
  on staff_permission_overrides
  for select
  to authenticated
  using (profile_id = auth.uid());

grant select on staff_permission_overrides to authenticated;
grant select, insert, update, delete on staff_permission_overrides to service_role;
