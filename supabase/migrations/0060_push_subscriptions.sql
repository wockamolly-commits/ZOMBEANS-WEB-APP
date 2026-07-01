-- Web Push subscriptions for locked-screen/backgrounded alerts. Supplements
-- the existing in-tab realtime alert system (audio + toast); see
-- docs/web-push-notifications.md for the full design.
--
-- Customer subscriptions are keyed by order short_code (guest checkout has no
-- user_id); rider subscriptions are keyed by user_id (riders are always
-- logged-in staff accounts). All reads/writes go through server-side routes
-- using the service-role admin client, so no anon/authenticated policies are
-- needed beyond the service_role grant this project requires explicitly.

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('customer', 'rider')),
  order_code text,
  user_id uuid references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint push_subscriptions_role_key check (
    (role = 'customer' and order_code is not null)
    or (role = 'rider' and user_id is not null)
  )
);

create index push_subscriptions_order_code_idx
  on push_subscriptions (order_code)
  where order_code is not null;

create index push_subscriptions_user_id_idx
  on push_subscriptions (user_id)
  where user_id is not null;

alter table push_subscriptions enable row level security;

grant select, insert, update, delete on push_subscriptions to service_role;
