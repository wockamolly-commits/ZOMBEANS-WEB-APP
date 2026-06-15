-- Menu: categories, items, variations, modifiers
create table menu_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references menu_categories(id) on delete restrict,
  slug text unique not null,
  name text not null,
  description text,
  image_url text,
  is_bestseller boolean not null default false,
  is_active boolean not null default true,
  loyverse_item_id text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on menu_items(category_id);
create index on menu_items(is_active, sort_order);
create trigger menu_items_set_updated_at
  before update on menu_items
  for each row execute function set_updated_at();

create table item_variations (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references menu_items(id) on delete cascade,
  label text not null,
  price_cents bigint not null check (price_cents >= 0),
  is_default boolean not null default false,
  is_active boolean not null default true,
  loyverse_variant_id text,
  sort_order int not null default 0
);
create index on item_variations(item_id);

create table item_modifier_groups (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references menu_items(id) on delete cascade,
  name text not null,
  is_required boolean not null default false,
  min_select int not null default 0,
  max_select int not null default 1,
  sort_order int not null default 0
);

create table item_modifiers (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references item_modifier_groups(id) on delete cascade,
  name text not null,
  price_delta_cents bigint not null default 0,
  is_active boolean not null default true
);
create index on item_modifiers(group_id);
