create table tables (
  id uuid primary key default gen_random_uuid(),
  label text unique not null,
  qr_token text unique,
  is_active boolean not null default true
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  short_code text unique not null,
  status order_status not null default 'pending',
  service_mode service_mode not null,
  customer_name text not null,
  customer_phone text,
  customer_email text,
  table_id uuid references tables(id),
  pickup_time timestamptz,
  subtotal_cents bigint not null,
  delivery_fee_cents bigint not null default 0,
  total_cents bigint not null,
  notes text,
  placed_at timestamptz not null default now(),
  accepted_at timestamptz,
  ready_at timestamptz,
  completed_at timestamptz,
  rejected_at timestamptz,
  rejected_reason text,
  accepted_by_profile_id uuid
);
create index on orders(status, placed_at desc);
create index on orders(short_code);
create index on orders(placed_at desc);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  item_id uuid not null references menu_items(id),
  variation_id uuid not null references item_variations(id),
  item_name_snapshot text not null,
  variation_label_snapshot text not null,
  unit_price_cents bigint not null,
  qty int not null,
  line_total_cents bigint not null
);
create index on order_items(order_id);

create table order_item_modifiers (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references order_items(id) on delete cascade,
  modifier_id uuid not null references item_modifiers(id),
  name_snapshot text not null,
  price_delta_cents bigint not null default 0
);

create table delivery_addresses (
  order_id uuid primary key references orders(id) on delete cascade,
  street text not null,
  barangay text,
  city text not null,
  landmark text,
  delivery_notes text,
  lat numeric(10,7) not null,
  lng numeric(10,7) not null,
  google_place_id text
);

create table order_status_events (
  id bigserial primary key,
  order_id uuid not null references orders(id) on delete cascade,
  from_status order_status,
  to_status order_status not null,
  actor_profile_id uuid,
  reason text,
  created_at timestamptz not null default now()
);
create index on order_status_events(order_id, created_at);

create table loyverse_sync (
  order_id uuid primary key references orders(id) on delete cascade,
  loyverse_receipt_id text,
  payload jsonb,
  attempts int not null default 0,
  last_attempt_at timestamptz,
  last_error text,
  succeeded_at timestamptz
);
