-- Zombeans — enum types and shared bits
create extension if not exists pgcrypto;

create type service_mode as enum ('dine_in','pickup','delivery');

create type order_status as enum (
  'pending',
  'accepted',
  'preparing',
  'ready',
  'out_for_delivery',
  'completed',
  'rejected',
  'cancelled'
);

create type payment_method as enum ('cash','gcash','maya','card');
create type payment_provider as enum ('manual','paymongo');
create type payment_status as enum ('pending','paid','refunded','failed');

create type user_role as enum ('admin','staff','rider');

-- updated_at helper
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
