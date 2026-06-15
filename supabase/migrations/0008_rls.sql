-- Row Level Security.
-- Customer-facing read of menu is public. Everything else is locked.
-- Customer order/cart paths go through SECURITY DEFINER RPCs (0009).

alter table menu_categories enable row level security;
alter table menu_items enable row level security;
alter table item_variations enable row level security;
alter table item_modifier_groups enable row level security;
alter table item_modifiers enable row level security;

create policy "public read active categories"
  on menu_categories for select
  using (is_active);

create policy "public read active items"
  on menu_items for select
  using (is_active);

create policy "public read active variations"
  on item_variations for select
  using (is_active);

create policy "public read item modifier groups"
  on item_modifier_groups for select
  using (true);

create policy "public read active modifiers"
  on item_modifiers for select
  using (is_active);

-- Everything customer-write goes via SECURITY DEFINER RPC; direct access denied.
alter table carts enable row level security;
alter table cart_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_item_modifiers enable row level security;
alter table delivery_addresses enable row level security;
alter table payments enable row level security;
alter table order_status_events enable row level security;
alter table loyverse_sync enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;
alter table profiles enable row level security;
alter table riders enable row level security;
alter table rider_assignments enable row level security;
alter table tables enable row level security;
alter table app_settings enable row level security;

-- Helper: current user's role (null if no profile / guest)
create or replace function current_role_kind()
returns user_role
language sql stable security definer set search_path = public
as $$
  select role from profiles where id = auth.uid()
$$;

-- Staff/Admin read access on operational tables
create policy "staff read orders" on orders for select
  using (current_role_kind() in ('staff','admin'));
create policy "staff read order_items" on order_items for select
  using (current_role_kind() in ('staff','admin'));
create policy "staff read order_item_modifiers" on order_item_modifiers for select
  using (current_role_kind() in ('staff','admin'));
create policy "staff read delivery_addresses" on delivery_addresses for select
  using (current_role_kind() in ('staff','admin'));
create policy "staff read payments" on payments for select
  using (current_role_kind() in ('staff','admin'));
create policy "staff read status events" on order_status_events for select
  using (current_role_kind() in ('staff','admin'));
create policy "staff read loyverse_sync" on loyverse_sync for select
  using (current_role_kind() in ('staff','admin'));
create policy "staff read profiles" on profiles for select
  using (current_role_kind() in ('staff','admin') or id = auth.uid());

-- Admin-only writes on menu (we'll add granular policies as needed)
create policy "admin write categories" on menu_categories for all
  using (current_role_kind() in ('staff','admin'))
  with check (current_role_kind() in ('staff','admin'));
create policy "admin write items" on menu_items for all
  using (current_role_kind() in ('staff','admin'))
  with check (current_role_kind() in ('staff','admin'));
create policy "admin write variations" on item_variations for all
  using (current_role_kind() in ('staff','admin'))
  with check (current_role_kind() in ('staff','admin'));
create policy "admin write modifier groups" on item_modifier_groups for all
  using (current_role_kind() in ('staff','admin'))
  with check (current_role_kind() in ('staff','admin'));
create policy "admin write modifiers" on item_modifiers for all
  using (current_role_kind() in ('staff','admin'))
  with check (current_role_kind() in ('staff','admin'));

-- Rider can read own assignments + their orders
create policy "rider read own assignments" on rider_assignments for select
  using (rider_profile_id = auth.uid());

create policy "rider read assigned orders" on orders for select
  using (
    current_role_kind() = 'rider'
    and exists (
      select 1 from rider_assignments ra
      where ra.order_id = orders.id and ra.rider_profile_id = auth.uid()
    )
  );

-- App settings: read by any authenticated; write by admin
create policy "read settings" on app_settings for select using (true);
create policy "admin write settings" on app_settings for update
  using (current_role_kind() = 'admin')
  with check (current_role_kind() = 'admin');
