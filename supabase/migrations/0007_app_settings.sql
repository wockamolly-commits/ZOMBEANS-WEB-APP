-- Singleton store config + feature flags
create table app_settings (
  id int primary key default 1 check (id = 1),
  accepting_orders boolean not null default true,
  hours jsonb not null default
    '{"mon":["07:00","22:00"],"tue":["07:00","22:00"],"wed":["07:00","22:00"],
      "thu":["07:00","22:00"],"fri":["07:00","22:00"],"sat":["07:00","22:00"],
      "sun":["07:00","22:00"]}'::jsonb,
  default_prep_eta_minutes int not null default 20,
  pickup_slot_minutes int not null default 15,
  delivery_fee_tiers jsonb not null default
    '[{"max_km":2,"fee_cents":3000},
      {"max_km":4,"fee_cents":4000},
      {"max_km":6,"fee_cents":5000}]'::jsonb,
  delivery_max_km numeric not null default 6,
  store_lat numeric(10,7) not null default 10.4884825,
  store_lng numeric(10,7) not null default 123.4111058,
  -- feature flags
  loyverse_enabled boolean not null default false,
  loyverse_store_id text,
  loyverse_pos_device_id text,
  email_enabled boolean not null default false,
  maps_enabled boolean not null default false,
  paymongo_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into app_settings (id) values (1);
