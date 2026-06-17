-- supabase/migrations/0015_customer_rls.sql
-- Customers may touch only their own rows. Staff/rider policies from 0008
-- stay as-is; these are added alongside them. Guest order tracking goes
-- through the SECURITY DEFINER get_order_by_code RPC and is unaffected.

alter table customer_profiles  enable row level security;
alter table customer_addresses enable row level security;

create policy "customer reads own profile" on customer_profiles
  for select using (id = auth.uid());
create policy "customer inserts own profile" on customer_profiles
  for insert with check (id = auth.uid());
create policy "customer updates own profile" on customer_profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "customer reads own addresses" on customer_addresses
  for select using (user_id = auth.uid());
create policy "customer inserts own addresses" on customer_addresses
  for insert with check (user_id = auth.uid());
create policy "customer updates own addresses" on customer_addresses
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "customer deletes own addresses" on customer_addresses
  for delete using (user_id = auth.uid());

-- Customers read their own orders + nested items/addresses.
create policy "customer reads own orders" on orders
  for select using (user_id = auth.uid());

create policy "customer reads own order_items" on order_items
  for select using (exists (
    select 1 from orders o
    where o.id = order_items.order_id and o.user_id = auth.uid()
  ));

create policy "customer reads own delivery_addresses" on delivery_addresses
  for select using (exists (
    select 1 from orders o
    where o.id = delivery_addresses.order_id and o.user_id = auth.uid()
  ));
