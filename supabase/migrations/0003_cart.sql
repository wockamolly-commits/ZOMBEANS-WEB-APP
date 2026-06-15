create table carts (
  id uuid primary key default gen_random_uuid(),
  cart_token text unique not null,
  service_mode service_mode,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);
create trigger carts_set_updated_at
  before update on carts
  for each row execute function set_updated_at();

create table cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references carts(id) on delete cascade,
  item_id uuid not null references menu_items(id),
  variation_id uuid not null references item_variations(id),
  modifier_ids uuid[] not null default '{}',
  qty int not null check (qty > 0),
  unit_price_cents bigint not null,
  created_at timestamptz not null default now()
);
create index on cart_items(cart_id);
