-- Reusable menu option groups and admin-managed menu image storage.
-- The original item_modifier_* tables remain intact for existing orders.

alter table menu_categories
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists menu_categories_set_updated_at on menu_categories;
create trigger menu_categories_set_updated_at
  before update on menu_categories
  for each row execute function set_updated_at();

create table menu_option_groups (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  description text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger menu_option_groups_set_updated_at
  before update on menu_option_groups
  for each row execute function set_updated_at();

create table menu_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references menu_option_groups(id) on delete cascade,
  name text not null,
  price_delta_cents bigint not null default 0 check (price_delta_cents >= 0),
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, name)
);
create index menu_options_group_id_idx on menu_options(group_id, sort_order);

create trigger menu_options_set_updated_at
  before update on menu_options
  for each row execute function set_updated_at();

create table menu_item_option_groups (
  item_id uuid not null references menu_items(id) on delete cascade,
  group_id uuid not null references menu_option_groups(id) on delete cascade,
  is_required boolean not null default false,
  min_select int not null default 0 check (min_select >= 0),
  max_select int not null default 1 check (max_select > 0),
  sort_order int not null default 0,
  primary key (item_id, group_id),
  check (min_select <= max_select)
);
create index menu_item_option_groups_group_id_idx
  on menu_item_option_groups(group_id, sort_order);

alter table menu_option_groups enable row level security;
alter table menu_options enable row level security;
alter table menu_item_option_groups enable row level security;

create policy "public read active option groups"
  on menu_option_groups for select using (is_active);
create policy "public read active options"
  on menu_options for select using (is_active);
create policy "public read option group links"
  on menu_item_option_groups for select using (true);

create policy "super admin writes option groups"
  on menu_option_groups for all
  using (current_role_kind() = 'admin')
  with check (current_role_kind() = 'admin');
create policy "super admin writes options"
  on menu_options for all
  using (current_role_kind() = 'admin')
  with check (current_role_kind() = 'admin');
create policy "super admin writes option links"
  on menu_item_option_groups for all
  using (current_role_kind() = 'admin')
  with check (current_role_kind() = 'admin');

grant select on menu_option_groups, menu_options, menu_item_option_groups
  to anon, authenticated;
grant insert, update, delete on menu_option_groups, menu_options, menu_item_option_groups
  to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-images',
  'menu-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Starter reusable groups requested for the drinks menu.
insert into menu_option_groups (name, description, sort_order)
values
  ('Choice of Milk Substitute', 'Choose an alternative milk for eligible drinks.', 10),
  ('Choice of Extras for Drinks', 'Optional drink add-ons and upgrades.', 20)
on conflict (name) do nothing;

insert into menu_options (group_id, name, price_delta_cents, sort_order)
select g.id, option_row.name, option_row.price_delta_cents, option_row.sort_order
from menu_option_groups g
cross join (
  values
    ('Sub Oatmilk', 3000::bigint, 10),
    ('Sub Breve', 2500::bigint, 20)
) as option_row(name, price_delta_cents, sort_order)
where g.name = 'Choice of Milk Substitute'
on conflict (group_id, name) do nothing;

insert into menu_options (group_id, name, price_delta_cents, sort_order)
select g.id, option_row.name, option_row.price_delta_cents, option_row.sort_order
from menu_option_groups g
cross join (
  values
    ('Caramel Sauce', 2800::bigint, 10),
    ('Milk', 2000::bigint, 20),
    ('Condensed', 1400::bigint, 30),
    ('Espresso', 4000::bigint, 40),
    ('Cold Foam', 3500::bigint, 50),
    ('Chocolate Sauce', 2800::bigint, 60)
) as option_row(name, price_delta_cents, sort_order)
where g.name = 'Choice of Extras for Drinks'
on conflict (group_id, name) do nothing;

insert into menu_item_option_groups (item_id, group_id, max_select, sort_order)
select mi.id, mog.id, 1, mog.sort_order
from menu_items mi
join menu_categories mc on mc.id = mi.category_id
cross join menu_option_groups mog
where mc.slug in (
  'signature-drinks',
  'coffee',
  'matcha',
  'milk-series',
  'creamcheese-series'
)
and mog.name in ('Choice of Milk Substitute', 'Choice of Extras for Drinks')
on conflict (item_id, group_id) do nothing;
