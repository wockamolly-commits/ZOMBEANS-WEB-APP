-- supabase/migrations/0014_customer_accounts.sql
-- Customer accounts. Customers are auth.users with companion profile +
-- address rows. The staff `profiles` table and user_role enum are NOT
-- touched: a customer is simply an authed user with no `profiles` row.

create table customer_profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger customer_profiles_set_updated_at
  before update on customer_profiles
  for each row execute function set_updated_at();

create table customer_addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  label       text,
  street      text not null,
  barangay    text,
  landmark    text,
  city        text not null default 'San Carlos City',
  tier        text not null check (tier in ('tier-2','tier-4','tier-6')),
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index on customer_addresses(user_id);

-- Orders placed by a signed-in customer carry their id; guests stay null.
alter table orders add column user_id uuid references auth.users(id);
create index on orders(user_id, placed_at desc);

-- Auto-create a profile row the first time a user appears.
create or replace function handle_new_customer()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into customer_profiles (id, display_name)
  values (new.id, nullif(coalesce(new.raw_user_meta_data, '{}'::jsonb)->>'display_name',''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_customer
  after insert on auth.users
  for each row execute function handle_new_customer();
