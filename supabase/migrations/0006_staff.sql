-- Staff/admin/rider profiles. Linked 1:1 to Supabase auth users.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null,
  display_name text not null,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on profiles(role);

create table riders (
  profile_id uuid primary key references profiles(id) on delete cascade,
  vehicle_type text,
  plate_no text,
  is_available boolean not null default true
);

create table rider_assignments (
  order_id uuid primary key references orders(id) on delete cascade,
  rider_profile_id uuid not null references profiles(id),
  assigned_at timestamptz not null default now(),
  picked_up_at timestamptz,
  delivered_at timestamptz
);
create index on rider_assignments(rider_profile_id);

-- Now that profiles exists, add the FKs we left dangling on orders/events/payments
alter table orders
  add constraint orders_accepted_by_fk
  foreign key (accepted_by_profile_id) references profiles(id);

alter table order_status_events
  add constraint order_status_events_actor_fk
  foreign key (actor_profile_id) references profiles(id);

alter table payments
  add constraint payments_recorded_by_fk
  foreign key (recorded_by_profile_id) references profiles(id);

create table notifications (
  id bigserial primary key,
  channel text not null,
  target text not null,
  template text not null,
  payload jsonb not null,
  status text not null default 'queued',
  attempts int not null default 0,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index on notifications(status, created_at);

create table audit_logs (
  id bigserial primary key,
  actor_profile_id uuid references profiles(id),
  action text not null,
  target_table text not null,
  target_id text,
  diff jsonb,
  ip inet,
  ua text,
  created_at timestamptz not null default now()
);
create index on audit_logs(target_table, target_id);
create index on audit_logs(actor_profile_id, created_at desc);
