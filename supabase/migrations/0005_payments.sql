create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  method payment_method not null,
  provider payment_provider not null default 'manual',
  status payment_status not null default 'pending',
  amount_cents bigint not null,
  provider_intent_id text,
  provider_source_id text,
  provider_payment_id text,
  reference text,
  paid_at timestamptz,
  recorded_by_profile_id uuid,
  raw_webhook jsonb,
  created_at timestamptz not null default now()
);
create index on payments(order_id);
create index on payments(provider_intent_id);
