# Customer Authentication & Checkout Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add passwordless (magic-link) customer accounts — profile, saved delivery addresses, order history — while keeping guest checkout for every mode except delivery, which requires a logged-in account.

**Architecture:** Customers are Supabase `auth.users` rows with companion `customer_profiles` / `customer_addresses` tables (staff `profiles` table untouched). Orders gain a nullable `user_id`. The delivery rule is enforced authoritatively inside the `place_order()` RPC (which reads `auth.uid()`), with a matching client-side UX gate. Session refresh runs in a Next.js **Proxy** (Next 16's renamed Middleware).

**Tech Stack:** Next.js 16.2.9 (App Router), React 19.2, `@supabase/ssr` ^0.12, `@supabase/supabase-js` ^2.108, Zod ^4, Tailwind 4, Base UI.

## Global Constraints

- **Next.js 16 — Middleware is renamed to Proxy.** The session-refresh file is `proxy.ts` at the repo root, exporting a `proxy` function (named or default) with `export const config = { matcher: [...] }`. There is NO `middleware.ts`. (Source: `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`.)
- **`cookies()` from `next/headers` is async** — always `await cookies()`. (Existing `lib/supabase/server.ts` already does this.)
- **Route Handlers** live in `route.ts` files, export named HTTP methods (`GET`), and return `Response`/`NextResponse`. A `route.ts` cannot sit at the same segment as a `page.tsx`.
- **Read before writing Next code.** Per `AGENTS.md`, this Next version has breaking changes; consult `node_modules/next/dist/docs/` for any API not shown verbatim in this plan.
- **Migrations are sequential, append-only SQL files** in `supabase/migrations/`, applied to hosted Supabase (no local CLI config committed). Never edit a shipped migration; add a new numbered file.
- **Money is integer cents** (`*_cents bigint`). **Delivery tiers** are exactly `tier-2` (₱30 / 3000), `tier-4` (₱40 / 4000), `tier-6` (₱50 / 5000).
- **Service modes** are exactly `dine_in | take_out | pickup | delivery`.
- **Branch:** all work lands on `feat/customer-auth-checkout`.
- **Out of scope:** linking pre-existing guest orders to a new account; OAuth/social login; online payment.

---

## File Structure

**New — database**
- `supabase/migrations/0014_customer_accounts.sql` — `customer_profiles`, `customer_addresses`, `orders.user_id`, new-user trigger.
- `supabase/migrations/0015_customer_rls.sql` — RLS policies for customer self-access.
- `supabase/migrations/0016_place_order_auth.sql` — `place_order()` delivery auth guard + `user_id` stamping.
- `supabase/tests/0016_place_order_auth.test.sql` — runnable SQL assertions for the guard.

**New — auth plumbing**
- `proxy.ts` (repo root) — session refresh entry point.
- `lib/supabase/proxy.ts` — `updateSession()` helper.
- `lib/auth.ts` — `getCurrentUser()`, `getCustomerProfile()`, `getSavedAddresses()` server helpers.

**New — auth UI / routes**
- `app/login/page.tsx` + `app/login/actions.ts` — magic-link request form.
- `app/auth/confirm/route.ts` — verify magic link, set session, redirect.
- `app/auth/signout/route.ts` — sign out, redirect home.
- `components/shared/AuthNav.tsx` — header Sign in / Account control.

**New — account area**
- `app/account/page.tsx` — auth-gated account dashboard (profile + addresses + orders sections).
- `app/account/actions.ts` — server actions: update profile, address CRUD.
- `components/account/ProfileForm.tsx`, `components/account/AddressManager.tsx` — client section components.

**Modified**
- `components/shared/Header.tsx` — render `<AuthNav />`.
- `app/(shop)/checkout/page.tsx` — become async, pass session/profile/addresses to form.
- `components/shop/CheckoutForm.tsx` — login-aware delivery gate, prefill, saved-address picker.
- `app/actions/checkout.ts` — surface `AUTH_REQUIRED` as a friendly error.

---

## Task 1: Customer account tables + `orders.user_id`

**Files:**
- Create: `supabase/migrations/0014_customer_accounts.sql`

**Interfaces:**
- Produces: tables `customer_profiles(id, display_name, phone, created_at, updated_at)`, `customer_addresses(id, user_id, label, street, barangay, landmark, city, tier, is_default, created_at)`; column `orders.user_id uuid null`; trigger function `handle_new_customer()`.

- [ ] **Step 1: Write the migration**

```sql
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
  values (new.id, nullif(new.raw_user_meta_data->>'display_name',''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_customer
  after insert on auth.users
  for each row execute function handle_new_customer();
```

- [ ] **Step 2: Apply the migration**

Run (Supabase SQL editor, or psql against the project DB):
```
\i supabase/migrations/0014_customer_accounts.sql
```
Expected: `CREATE TABLE` / `ALTER TABLE` / `CREATE FUNCTION` / `CREATE TRIGGER` with no errors.

- [ ] **Step 3: Verify structure**

Run:
```sql
select column_name from information_schema.columns
where table_name = 'orders' and column_name = 'user_id';
-- expect 1 row: user_id

select tgname from pg_trigger where tgname = 'on_auth_user_created_customer';
-- expect 1 row

select count(*) from customer_profiles;  -- expect 0, no error
select count(*) from customer_addresses; -- expect 0, no error
```
Expected: each query returns as commented, no errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0014_customer_accounts.sql
git commit -m "feat(db): customer_profiles, customer_addresses, orders.user_id"
```

---

## Task 2: Customer RLS policies

**Files:**
- Create: `supabase/migrations/0015_customer_rls.sql`

**Interfaces:**
- Consumes: tables from Task 1; existing staff/rider policies on `orders`, `order_items`, `delivery_addresses` (Task 0008).
- Produces: self-scoped RLS allowing a customer to read/write only their own profile, addresses, and orders. Additive only — existing staff/rider policies and the `get_order_by_code` guest-tracking RPC are unaffected.

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Apply the migration**

Run:
```
\i supabase/migrations/0015_customer_rls.sql
```
Expected: multiple `CREATE POLICY`, no errors.

- [ ] **Step 3: Verify policies exist**

Run:
```sql
select tablename, policyname from pg_policies
where policyname like 'customer %'
order by tablename, policyname;
-- expect 10 rows across customer_profiles, customer_addresses,
-- orders, order_items, delivery_addresses
```
Expected: 10 customer policies listed.

- [ ] **Step 4: Verify self-scoping behaviorally (anon sees nothing)**

Run:
```sql
-- With no JWT claims set, auth.uid() is null → customer policies match nothing.
set local role authenticated;
set local request.jwt.claims = '';
select count(*) from customer_profiles;  -- expect 0 (cannot read others')
reset role;
```
Expected: `0`, no error. (Staff/RPC paths still work because they use their own policies / SECURITY DEFINER.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0015_customer_rls.sql
git commit -m "feat(db): RLS for customer self-access to profile, addresses, orders"
```

---

## Task 3: `place_order()` delivery auth guard + user_id stamping

**Files:**
- Create: `supabase/migrations/0016_place_order_auth.sql`
- Test: `supabase/tests/0016_place_order_auth.test.sql`

**Interfaces:**
- Consumes: existing `place_order(jsonb)` from migration 0013; `orders.user_id` from Task 1.
- Produces: `place_order()` that (a) raises `AUTH_REQUIRED` (errcode `P0001`) when `service_mode='delivery'` and `auth.uid()` is null, and (b) stamps `orders.user_id = auth.uid()` (null for guests).

- [ ] **Step 1: Write the failing test**

```sql
-- supabase/tests/0016_place_order_auth.test.sql
-- Run AFTER 0016 is applied. Wrapped in a rolled-back transaction so it
-- leaves no data behind. auth.uid() is null here (no JWT claims set), so
-- this exercises the guest path + the delivery guard.
begin;

-- (A) Unauthenticated delivery must be rejected with AUTH_REQUIRED.
do $$
begin
  perform place_order(jsonb_build_object(
    'service_mode','delivery',
    'customer_name','Guest',
    'customer_phone','09186056360',
    'lines', jsonb_build_array(jsonb_build_object(
      'item_slug','x','variation_label','y','qty',1)),
    'delivery', jsonb_build_object('tier','tier-2','street','S')
  ));
  raise exception 'TEST FAILED: delivery without auth was allowed';
exception
  when sqlstate 'P0001' then
    if sqlerrm <> 'AUTH_REQUIRED' then
      raise exception 'TEST FAILED: expected AUTH_REQUIRED, got %', sqlerrm;
    end if;
    raise notice 'PASS A: unauthenticated delivery rejected (AUTH_REQUIRED)';
end $$;

-- (B) Guest pickup still succeeds and stores user_id = null.
do $$
declare v jsonb; v_code text;
begin
  v := place_order(jsonb_build_object(
    'service_mode','pickup',
    'customer_name','Guest',
    'customer_phone','09186056360',
    'pickup_time', (now() + interval '1 hour')::text,
    'lines', jsonb_build_array(jsonb_build_object(
      'item_slug', (select slug from menu_items where is_active limit 1),
      'variation_label', (select iv.label from item_variations iv
        join menu_items mi on mi.id = iv.item_id
        where mi.is_active and iv.is_active limit 1),
      'qty',1))
  ));
  v_code := v->>'short_code';
  if (select user_id from orders where short_code = v_code) is not null then
    raise exception 'TEST FAILED: guest order has non-null user_id';
  end if;
  raise notice 'PASS B: guest pickup stored with user_id null';
end $$;

rollback;
```

- [ ] **Step 2: Run the test against the pre-0016 function — verify it fails**

Run:
```
\i supabase/tests/0016_place_order_auth.test.sql
```
Expected: FAIL — `TEST FAILED: delivery without auth was allowed` (the 0013 function has no guard yet).

- [ ] **Step 3: Write the migration (minimal change to make the guard pass)**

Reproduce the full 0013 function with three changes, marked `-- AUTH:`:

```sql
-- supabase/migrations/0016_place_order_auth.sql
-- place_order() gains a delivery auth guard and stamps user_id from
-- auth.uid(). Everything else is identical to 0013.

create or replace function place_order(p_payload jsonb)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_settings   app_settings%rowtype;
  v_short_code text;
  v_order_id   uuid;
  v_subtotal   bigint := 0;
  v_delivery_fee bigint := 0;
  v_total      bigint;
  v_service_mode service_mode;
  v_payment_method payment_method;
  v_pickup_time timestamptz;
  v_attempts   int := 0;
  v_lines      jsonb;
  v_line       jsonb;
  v_delivery   jsonb;
  v_tier       text;
  v_qty        int;
  v_var        record;
  v_user_id    uuid := auth.uid();   -- AUTH: caller identity (null for guests)
begin
  select * into v_settings from app_settings where id = 1;
  if not v_settings.accepting_orders then
    raise exception 'NOT_ACCEPTING' using errcode = 'P0001';
  end if;

  v_service_mode   := (p_payload->>'service_mode')::service_mode;
  v_payment_method := coalesce((p_payload->>'payment_method')::payment_method, 'cash');

  -- AUTH: delivery requires a signed-in customer. This is the authoritative
  -- guard; the client gate is only UX.
  if v_service_mode = 'delivery' and v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  if coalesce(p_payload->>'customer_name','') = '' then
    raise exception 'MISSING_NAME' using errcode = 'P0001';
  end if;

  v_lines := coalesce(p_payload->'lines', '[]'::jsonb);
  if jsonb_array_length(v_lines) = 0 then
    raise exception 'EMPTY_CART' using errcode = 'P0001';
  end if;

  if v_service_mode = 'pickup' then
    v_pickup_time := (p_payload->>'pickup_time')::timestamptz;
    if v_pickup_time is null then
      raise exception 'MISSING_PICKUP_TIME' using errcode = 'P0001';
    end if;
  elsif v_service_mode = 'delivery' then
    v_delivery := p_payload->'delivery';
    if v_delivery is null then
      raise exception 'MISSING_DELIVERY' using errcode = 'P0001';
    end if;
    v_tier := v_delivery->>'tier';
    v_delivery_fee := case v_tier
      when 'tier-2' then 3000
      when 'tier-4' then 4000
      when 'tier-6' then 5000
      else null
    end;
    if v_delivery_fee is null then
      raise exception 'INVALID_DELIVERY_TIER' using errcode = 'P0001';
    end if;
  end if;

  if v_service_mode <> 'dine_in'
     and coalesce(p_payload->>'customer_phone','') = '' then
    raise exception 'MISSING_PHONE' using errcode = 'P0001';
  end if;

  loop
    v_short_code := generate_short_code();
    exit when not exists (select 1 from orders where short_code = v_short_code);
    v_attempts := v_attempts + 1;
    if v_attempts >= 5 then
      raise exception 'SHORT_CODE_COLLISION' using errcode = 'P0001';
    end if;
  end loop;

  insert into orders (
    short_code, status, service_mode,
    customer_name, customer_phone, customer_email,
    table_id, pickup_time,
    subtotal_cents, delivery_fee_cents, total_cents,
    notes, user_id                                   -- AUTH: stamp owner
  ) values (
    v_short_code, 'pending', v_service_mode,
    p_payload->>'customer_name',
    nullif(p_payload->>'customer_phone',''),
    nullif(p_payload->>'customer_email',''),
    null, v_pickup_time,
    0, v_delivery_fee, 0,
    nullif(p_payload->>'notes',''), v_user_id        -- AUTH: null for guests
  ) returning id into v_order_id;

  for v_line in select * from jsonb_array_elements(v_lines) loop
    select iv.id            as variation_id,
           iv.label          as variation_label,
           iv.price_cents    as price_cents,
           iv.item_id        as item_id,
           iv.is_active      as variation_active,
           mi.name           as item_name,
           mi.is_active      as item_active
      into v_var
      from item_variations iv
      join menu_items mi on mi.id = iv.item_id
      where mi.slug = v_line->>'item_slug'
        and iv.label = v_line->>'variation_label';

    if not found then
      raise exception 'INVALID_ITEM:%/%',
        v_line->>'item_slug', v_line->>'variation_label'
        using errcode = 'P0001';
    end if;
    if not v_var.item_active or not v_var.variation_active then
      raise exception 'ITEM_INACTIVE:%', v_var.item_name
        using errcode = 'P0001';
    end if;

    v_qty := (v_line->>'qty')::int;
    if v_qty is null or v_qty <= 0 or v_qty > 50 then
      raise exception 'INVALID_QTY' using errcode = 'P0001';
    end if;

    insert into order_items (
      order_id, item_id, variation_id,
      item_name_snapshot, variation_label_snapshot,
      unit_price_cents, qty, line_total_cents
    ) values (
      v_order_id, v_var.item_id, v_var.variation_id,
      v_var.item_name, v_var.variation_label,
      v_var.price_cents, v_qty, v_var.price_cents * v_qty
    );

    v_subtotal := v_subtotal + v_var.price_cents * v_qty;
  end loop;

  if v_service_mode = 'delivery' then
    insert into delivery_addresses (
      order_id, street, barangay, city, landmark, delivery_notes, lat, lng
    ) values (
      v_order_id,
      coalesce(v_delivery->>'street',''),
      v_delivery->>'barangay',
      coalesce(v_delivery->>'city','San Carlos City'),
      v_delivery->>'landmark',
      v_delivery->>'delivery_notes',
      coalesce((v_delivery->>'lat')::numeric, v_settings.store_lat),
      coalesce((v_delivery->>'lng')::numeric, v_settings.store_lng)
    );
  end if;

  v_total := v_subtotal + v_delivery_fee;
  update orders
    set subtotal_cents = v_subtotal,
        total_cents    = v_total
    where id = v_order_id;

  insert into payments (order_id, method, status, amount_cents)
  values (v_order_id, v_payment_method, 'pending', v_total);

  insert into order_status_events (order_id, from_status, to_status)
  values (v_order_id, null, 'pending');

  return jsonb_build_object(
    'short_code',         v_short_code,
    'order_id',           v_order_id,
    'subtotal_cents',     v_subtotal,
    'delivery_fee_cents', v_delivery_fee,
    'total_cents',        v_total
  );
end;
$$;

grant execute on function place_order(jsonb) to anon, authenticated;
```

- [ ] **Step 4: Apply the migration**

Run:
```
\i supabase/migrations/0016_place_order_auth.sql
```
Expected: `CREATE FUNCTION`, `GRANT`, no errors.

- [ ] **Step 5: Run the test — verify it passes**

Run:
```
\i supabase/tests/0016_place_order_auth.test.sql
```
Expected: `PASS A: unauthenticated delivery rejected (AUTH_REQUIRED)` and `PASS B: guest pickup stored with user_id null`, then `ROLLBACK`.

> **Note — Test C (authenticated delivery stamps user_id) is verified manually in Task 12** via the real signed-in checkout flow, to avoid brittle hand-seeding of `auth.users`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0016_place_order_auth.sql supabase/tests/0016_place_order_auth.test.sql
git commit -m "feat(db): place_order AUTH_REQUIRED guard + user_id stamping"
```

---

## Task 4: Proxy session refresh (Next 16)

**Files:**
- Create: `lib/supabase/proxy.ts`
- Create: `proxy.ts` (repo root)

**Interfaces:**
- Produces: `updateSession(request: NextRequest): Promise<NextResponse>` and the root `proxy` entry point that refreshes the Supabase auth cookie on every non-static request, so server components, server actions, and the `place_order` RPC observe a valid `auth.uid()`.

- [ ] **Step 1: Write the session helper**

```ts
// lib/supabase/proxy.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session and rewrites auth cookies onto the
// response. Adapted from the @supabase/ssr SSR pattern for Next's Proxy.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Touching getUser() refreshes an expiring session and triggers setAll.
  await supabase.auth.getUser();

  return response;
}
```

- [ ] **Step 2: Write the root proxy file**

```ts
// proxy.ts  (Next 16: "Proxy" is the renamed Middleware — see Global Constraints)
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Run on everything except static assets and image files.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
```

- [ ] **Step 3: Verify it builds and runs**

Run:
```bash
npm run dev
```
Expected: dev server starts with no "proxy" config errors. Load `http://localhost:3000/` — page renders normally (no auth user yet, no redirects). Stop the server.

- [ ] **Step 4: Commit**

```bash
git add proxy.ts lib/supabase/proxy.ts
git commit -m "feat(auth): Supabase session refresh via Next 16 proxy"
```

---

## Task 5: Server auth helpers

**Files:**
- Create: `lib/auth.ts`

**Interfaces:**
- Consumes: `createClient` from `lib/supabase/server.ts`; tables from Task 1.
- Produces:
  - `getCurrentUser(): Promise<User | null>` (memoized per request via `react` `cache`)
  - `getCustomerProfile(): Promise<{ display_name: string | null; phone: string | null } | null>`
  - `getSavedAddresses(): Promise<SavedAddress[]>` where
    `SavedAddress = { id: string; label: string | null; street: string; barangay: string | null; landmark: string | null; city: string; tier: "tier-2"|"tier-4"|"tier-6"; is_default: boolean }`

- [ ] **Step 1: Write the helpers**

```ts
// lib/auth.ts
import "server-only";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type SavedAddress = {
  id: string;
  label: string | null;
  street: string;
  barangay: string | null;
  landmark: string | null;
  city: string;
  tier: "tier-2" | "tier-4" | "tier-6";
  is_default: boolean;
};

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export async function getCustomerProfile() {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("customer_profiles")
    .select("display_name, phone")
    .eq("id", user.id)
    .single();
  return data ?? { display_name: null, phone: null };
}

export async function getSavedAddresses(): Promise<SavedAddress[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("customer_addresses")
    .select("id, label, street, barangay, landmark, city, tier, is_default")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  return (data as SavedAddress[] | null) ?? [];
}
```

- [ ] **Step 2: Verify it type-checks**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors referencing `lib/auth.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/auth.ts
git commit -m "feat(auth): server helpers for current user, profile, addresses"
```

---

## Task 6: Login page + magic-link request action

**Files:**
- Create: `app/login/actions.ts`
- Create: `app/login/page.tsx`

**Interfaces:**
- Consumes: `createClient` from `lib/supabase/server.ts`.
- Produces: server action `requestMagicLink(prevState: LoginState, formData: FormData): Promise<LoginState>` where `LoginState = { status: "idle" | "sent" | "error"; message?: string; email?: string }`. Sends an OTP email whose link points at `/auth/confirm?next=<next>`.

- [ ] **Step 1: Write the action**

```ts
// app/login/actions.ts
"use server";

import { headers } from "next/headers";
import * as z from "zod";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  status: "idle" | "sent" | "error";
  message?: string;
  email?: string;
};

const schema = z.object({
  email: z.email({ error: "Enter a valid email address." }).trim(),
  next: z.string().optional(),
});

export async function requestMagicLink(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    next: formData.get("next"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Enter a valid email address." };
  }

  const { email, next } = parsed.data;
  const origin = (await headers()).get("origin") ?? "";
  const redirectTo = `${origin}/auth/confirm?next=${encodeURIComponent(
    next && next.startsWith("/") ? next : "/account"
  )}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });

  if (error) {
    return { status: "error", message: "Could not send the link. Try again.", email };
  }
  return { status: "sent", email };
}
```

- [ ] **Step 2: Write the page**

```tsx
// app/login/page.tsx
"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { DoodleBg } from "@/components/shared/DoodleBg";
import { requestMagicLink, type LoginState } from "./actions";

const initial: LoginState = { status: "idle" };

export default function LoginPage() {
  const next = useSearchParams().get("next") ?? "";
  const [state, action, pending] = useActionState(requestMagicLink, initial);

  return (
    <>
      <Header />
      <DoodleBg className="flex-1">
        <main className="mx-auto w-full max-w-md px-4 py-16 sm:px-6">
          <h1 className="font-display text-5xl text-zb-cream">SIGN IN</h1>
          <p className="mt-3 text-zb-cream/65">
            We&apos;ll email you a one-time sign-in link — no password needed.
          </p>

          {state.status === "sent" ? (
            <div className="mt-8 rounded-2xl border border-zb-bone/45 bg-zb-bone/10 p-5 text-sm text-zb-cream">
              Check <span className="font-semibold">{state.email}</span> for your
              sign-in link. You can close this tab once you&apos;ve opened it.
            </div>
          ) : (
            <form action={action} className="mt-8 space-y-4">
              <input type="hidden" name="next" value={next} />
              <label className="block text-sm font-medium text-zb-cream">
                Email
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@email.com"
                  className="mt-2 h-12 w-full rounded-xl border border-zb-sage/35 bg-zb-primary-dark/55 px-4 text-zb-cream placeholder:text-zb-cream/35 focus:border-zb-bone focus:outline-none focus:ring-2 focus:ring-zb-bone/20"
                />
              </label>
              {state.status === "error" && (
                <p className="rounded-lg border border-zb-danger/40 bg-zb-danger/10 px-3 py-2 text-xs text-zb-cream">
                  {state.message}
                </p>
              )}
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-zb-bone px-4 font-semibold text-zb-primary-dark transition hover:bg-zb-bone-soft disabled:cursor-not-allowed disabled:opacity-55"
              >
                {pending ? "Sending…" : "Email me a link"}
              </button>
            </form>
          )}
        </main>
      </DoodleBg>
      <Footer />
    </>
  );
}
```

- [ ] **Step 3: Verify**

Run `npm run dev`, open `http://localhost:3000/login`, submit a real email you control.
Expected: the form swaps to the "Check your email" state; an email with a sign-in link arrives (requires Supabase Auth email configured for the project). If email delivery isn't set up yet, confirm the action returns `sent` with no error in the network tab. Stop server.

- [ ] **Step 4: Commit**

```bash
git add app/login/actions.ts app/login/page.tsx
git commit -m "feat(auth): magic-link login page and request action"
```

---

## Task 7: Auth confirm + signout route handlers

**Files:**
- Create: `app/auth/confirm/route.ts`
- Create: `app/auth/signout/route.ts`

**Interfaces:**
- Consumes: `createClient` from `lib/supabase/server.ts`; the `?token_hash=&type=&next=` query params Supabase appends to the magic link.
- Produces: `GET` handlers that establish a session (`verifyOtp`) and redirect to `next` (or `/account`), and that sign out and redirect to `/`.

- [ ] **Step 1: Write the confirm handler**

```ts
// app/auth/confirm/route.ts
import { type NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next");
  const next = nextParam && nextParam.startsWith("/") ? nextParam : "/account";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=invalid_link", request.url));
}
```

- [ ] **Step 2: Write the signout handler**

```ts
// app/auth/signout/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url));
}
```

- [ ] **Step 3: Verify the full magic-link round trip**

Run `npm run dev`. From Task 6, open the emailed link.
Expected: it lands on `/auth/confirm`, sets the session cookie, and redirects to `/account` (which will 404 until Task 9 — that's fine; confirm the redirect target URL is `/account` and the session cookie `sb-*-auth-token` is set). Then visit `/auth/signout` and confirm it redirects home and clears the cookie. Stop server.

- [ ] **Step 4: Commit**

```bash
git add app/auth/confirm/route.ts app/auth/signout/route.ts
git commit -m "feat(auth): magic-link confirm and signout route handlers"
```

---

## Task 8: Header auth control

**Files:**
- Create: `components/shared/AuthNav.tsx`
- Modify: `components/shared/Header.tsx:24-35`

**Interfaces:**
- Consumes: `getCurrentUser` from `lib/auth.ts`.
- Produces: `<AuthNav />` async server component rendering a "Sign in" link when logged out and an "Account" link when logged in. Rendered inside `Header`'s right-hand control group.

- [ ] **Step 1: Write AuthNav**

```tsx
// components/shared/AuthNav.tsx
import Link from "next/link";
import { CircleUserRound } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";

export async function AuthNav() {
  const user = await getCurrentUser();
  const href = user ? "/account" : "/login";
  const label = user ? "Account" : "Sign in";
  return (
    <Link
      href={href}
      className="inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-zb-cream/85 transition hover:bg-zb-primary-strong hover:text-zb-cream"
    >
      <CircleUserRound className="size-4" />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
```

- [ ] **Step 2: Render it in the Header control group**

In `components/shared/Header.tsx`, change the right-hand `<div className="flex items-center gap-2">` block to include `<AuthNav />` before `<CartLink />`:

```tsx
          <div className="flex items-center gap-2">
            <AuthNav />
            <CartLink />
            <Link
              href="/menu"
              className={cn(
                buttonVariants(),
                "h-10 px-4 font-semibold bg-zb-bone text-zb-primary-dark hover:bg-zb-bone-soft"
              )}
            >
              Order Now
            </Link>
          </div>
```

And add the import at the top:

```tsx
import { AuthNav } from "./AuthNav";
```

> `Header` is a (sync) Server Component; rendering the async `<AuthNav />` child is supported.

- [ ] **Step 3: Verify**

Run `npm run dev`. Logged out → header shows "Sign in" linking to `/login`. Sign in (Task 6/7 flow) → header shows "Account" linking to `/account`. Stop server.

- [ ] **Step 4: Commit**

```bash
git add components/shared/AuthNav.tsx components/shared/Header.tsx
git commit -m "feat(auth): header sign in / account control"
```

---

## Task 9: Account dashboard + profile editing

**Files:**
- Create: `app/account/actions.ts`
- Create: `components/account/ProfileForm.tsx`
- Create: `app/account/page.tsx`

**Interfaces:**
- Consumes: `getCurrentUser`, `getCustomerProfile`, `getSavedAddresses` from `lib/auth.ts`.
- Produces:
  - `updateProfile(prev: ProfileState, formData: FormData): Promise<ProfileState>` where `ProfileState = { status: "idle"|"saved"|"error"; message?: string }`.
  - `<ProfileForm initial={{ display_name, phone }} />` client component.
  - `/account` page: redirects to `/login?next=/account` when unauthenticated; otherwise renders the profile form, the address manager (Task 10), and the order list (Task 11).

- [ ] **Step 1: Write the profile action**

```ts
// app/account/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ProfileState = { status: "idle" | "saved" | "error"; message?: string };

const phoneRe = /^(?:\+63|0)9\d{9}$/;
const profileSchema = z.object({
  display_name: z.string().trim().max(80).optional(),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || phoneRe.test(v), {
      error: "Use a Philippine mobile number such as 09186056360.",
    }),
});

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Please sign in again." };

  const parsed = profileSchema.safeParse({
    display_name: formData.get("display_name") ?? "",
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("customer_profiles").upsert({
    id: user.id,
    display_name: parsed.data.display_name || null,
    phone: parsed.data.phone || null,
  });
  if (error) return { status: "error", message: "Could not save. Try again." };

  revalidatePath("/account");
  return { status: "saved" };
}
```

- [ ] **Step 2: Write the profile form**

```tsx
// components/account/ProfileForm.tsx
"use client";

import { useActionState } from "react";
import { updateProfile, type ProfileState } from "@/app/account/actions";

const inputClass =
  "mt-2 h-12 w-full rounded-xl border border-zb-sage/35 bg-zb-primary-dark/55 px-4 text-zb-cream placeholder:text-zb-cream/35 focus:border-zb-bone focus:outline-none focus:ring-2 focus:ring-zb-bone/20";
const initial: ProfileState = { status: "idle" };

export function ProfileForm({
  initial: data,
}: {
  initial: { display_name: string | null; phone: string | null };
}) {
  const [state, action, pending] = useActionState(updateProfile, initial);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium text-zb-cream">
        Name
        <input name="display_name" defaultValue={data.display_name ?? ""} className={inputClass} placeholder="Your name" />
      </label>
      <label className="text-sm font-medium text-zb-cream">
        Mobile number
        <input name="phone" defaultValue={data.phone ?? ""} inputMode="tel" className={inputClass} placeholder="09XX XXX XXXX" />
      </label>
      <div className="sm:col-span-2 flex items-center gap-3">
        <button type="submit" disabled={pending} className="inline-flex h-11 items-center justify-center rounded-xl bg-zb-bone px-5 font-semibold text-zb-primary-dark transition hover:bg-zb-bone-soft disabled:opacity-55">
          {pending ? "Saving…" : "Save profile"}
        </button>
        {state.status === "saved" && <span className="text-sm text-zb-bone">Saved.</span>}
        {state.status === "error" && <span className="text-sm text-zb-danger">{state.message}</span>}
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Write the account page (profile section only; address + orders sections wired in Tasks 10–11)**

```tsx
// app/account/page.tsx
import { redirect } from "next/navigation";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { DoodleBg } from "@/components/shared/DoodleBg";
import { getCurrentUser, getCustomerProfile } from "@/lib/auth";
import { ProfileForm } from "@/components/account/ProfileForm";

export const metadata = { title: "Your account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  const profile = await getCustomerProfile();

  return (
    <>
      <Header />
      <DoodleBg className="flex-1">
        <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-5xl text-zb-cream">YOUR ACCOUNT</h1>
            <a href="/auth/signout" className="text-sm font-semibold text-zb-bone hover:underline">
              Sign out
            </a>
          </div>
          <p className="mt-2 text-sm text-zb-cream/60">{user.email}</p>

          <section className="mt-8 rounded-2xl border border-zb-sage/25 bg-zb-primary-strong/75 p-6">
            <h2 className="font-display text-2xl text-zb-cream">PROFILE</h2>
            <p className="mt-1 text-sm text-zb-cream/60">Used to pre-fill your checkout.</p>
            <div className="mt-5">
              <ProfileForm initial={profile ?? { display_name: null, phone: null }} />
            </div>
          </section>

          {/* ADDRESSES section added in Task 10 */}
          {/* ORDERS section added in Task 11 */}
        </main>
      </DoodleBg>
      <Footer />
    </>
  );
}
```

- [ ] **Step 4: Verify**

Run `npm run dev`. Visit `/account` while logged out → redirected to `/login?next=/account`. Sign in → `/account` shows your email + profile form. Edit name + phone, Save → "Saved."; reload → values persist. Enter a bad phone → inline error. Stop server.

- [ ] **Step 5: Commit**

```bash
git add app/account/actions.ts components/account/ProfileForm.tsx app/account/page.tsx
git commit -m "feat(account): auth-gated dashboard with profile editing"
```

---

## Task 10: Saved addresses CRUD

**Files:**
- Modify: `app/account/actions.ts` (append address actions)
- Create: `components/account/AddressManager.tsx`
- Modify: `app/account/page.tsx` (render the addresses section)

**Interfaces:**
- Consumes: `getSavedAddresses` + `SavedAddress` from `lib/auth.ts`; `getCurrentUser`; `DELIVERY_TIERS` from `lib/checkout.ts`.
- Produces:
  - `addAddress(prev: AddressState, formData: FormData): Promise<AddressState>`
  - `deleteAddress(id: string): Promise<void>`
  - `setDefaultAddress(id: string): Promise<void>`
  - where `AddressState = { status: "idle"|"added"|"error"; message?: string }`.
  - `<AddressManager addresses={SavedAddress[]} />` client component.

- [ ] **Step 1: Append address actions to `app/account/actions.ts`**

```ts
// --- append to app/account/actions.ts ---

export type AddressState = { status: "idle" | "added" | "error"; message?: string };

const addressSchema = z.object({
  label: z.string().trim().max(40).optional(),
  street: z.string().trim().min(1, { error: "Street is required." }),
  barangay: z.string().trim().optional(),
  landmark: z.string().trim().optional(),
  tier: z.enum(["tier-2", "tier-4", "tier-6"]),
});

export async function addAddress(
  _prev: AddressState,
  formData: FormData
): Promise<AddressState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Please sign in again." };

  const parsed = addressSchema.safeParse({
    label: formData.get("label") ?? "",
    street: formData.get("street") ?? "",
    barangay: formData.get("barangay") ?? "",
    landmark: formData.get("landmark") ?? "",
    tier: formData.get("tier") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("customer_addresses").insert({
    user_id: user.id,
    label: parsed.data.label || null,
    street: parsed.data.street,
    barangay: parsed.data.barangay || null,
    landmark: parsed.data.landmark || null,
    tier: parsed.data.tier,
  });
  if (error) return { status: "error", message: "Could not save address." };

  revalidatePath("/account");
  return { status: "added" };
}

export async function deleteAddress(id: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const supabase = await createClient();
  // RLS also enforces ownership; the user_id filter is belt-and-suspenders.
  await supabase.from("customer_addresses").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/account");
}

export async function setDefaultAddress(id: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const supabase = await createClient();
  await supabase.from("customer_addresses").update({ is_default: false }).eq("user_id", user.id);
  await supabase.from("customer_addresses").update({ is_default: true }).eq("id", id).eq("user_id", user.id);
  revalidatePath("/account");
}
```

- [ ] **Step 2: Write the address manager**

```tsx
// components/account/AddressManager.tsx
"use client";

import { useActionState } from "react";
import { Star, Trash2 } from "lucide-react";
import { DELIVERY_TIERS } from "@/lib/checkout";
import type { SavedAddress } from "@/lib/auth";
import {
  addAddress,
  deleteAddress,
  setDefaultAddress,
  type AddressState,
} from "@/app/account/actions";

const inputClass =
  "mt-2 h-11 w-full rounded-xl border border-zb-sage/35 bg-zb-primary-dark/55 px-4 text-zb-cream placeholder:text-zb-cream/35 focus:border-zb-bone focus:outline-none focus:ring-2 focus:ring-zb-bone/20";
const initial: AddressState = { status: "idle" };

export function AddressManager({ addresses }: { addresses: SavedAddress[] }) {
  const [state, action, pending] = useActionState(addAddress, initial);
  return (
    <div className="space-y-5">
      {addresses.length > 0 && (
        <ul className="space-y-3">
          {addresses.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3 rounded-xl border border-zb-sage/25 bg-zb-primary-dark/35 p-4">
              <div className="min-w-0">
                <p className="font-semibold text-zb-cream">
                  {a.label || "Address"}
                  {a.is_default && <span className="ml-2 text-xs font-semibold text-zb-bone">Default</span>}
                </p>
                <p className="mt-0.5 truncate text-sm text-zb-cream/65">
                  {a.street}{a.barangay ? `, ${a.barangay}` : ""} · {a.city}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!a.is_default && (
                  <form action={setDefaultAddress.bind(null, a.id)}>
                    <button type="submit" title="Set default" className="rounded-md p-2 text-zb-cream/60 hover:bg-zb-primary-strong hover:text-zb-bone">
                      <Star className="size-4" />
                    </button>
                  </form>
                )}
                <form action={deleteAddress.bind(null, a.id)}>
                  <button type="submit" title="Delete" className="rounded-md p-2 text-zb-cream/60 hover:bg-zb-primary-strong hover:text-zb-danger">
                    <Trash2 className="size-4" />
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-zb-cream">
          Label <span className="font-normal text-zb-cream/45">(optional)</span>
          <input name="label" className={inputClass} placeholder="Home" />
        </label>
        <label className="text-sm font-medium text-zb-cream">
          Distance tier
          <select name="tier" required defaultValue="" className={inputClass}>
            <option value="" disabled>Choose distance</option>
            {DELIVERY_TIERS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-zb-cream sm:col-span-2">
          Street
          <input name="street" required className={inputClass} placeholder="House number, street, subdivision" />
        </label>
        <label className="text-sm font-medium text-zb-cream">
          Barangay
          <input name="barangay" className={inputClass} placeholder="Barangay" />
        </label>
        <label className="text-sm font-medium text-zb-cream">
          Landmark
          <input name="landmark" className={inputClass} placeholder="Near the red gate" />
        </label>
        <div className="sm:col-span-2 flex items-center gap-3">
          <button type="submit" disabled={pending} className="inline-flex h-11 items-center justify-center rounded-xl bg-zb-bone px-5 font-semibold text-zb-primary-dark transition hover:bg-zb-bone-soft disabled:opacity-55">
            {pending ? "Saving…" : "Add address"}
          </button>
          {state.status === "added" && <span className="text-sm text-zb-bone">Added.</span>}
          {state.status === "error" && <span className="text-sm text-zb-danger">{state.message}</span>}
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Render the addresses section in `app/account/page.tsx`**

Add the import:
```tsx
import { getSavedAddresses } from "@/lib/auth";
import { AddressManager } from "@/components/account/AddressManager";
```
Fetch alongside the profile:
```tsx
  const profile = await getCustomerProfile();
  const addresses = await getSavedAddresses();
```
Replace the `{/* ADDRESSES section added in Task 10 */}` comment with:
```tsx
          <section className="mt-6 rounded-2xl border border-zb-sage/25 bg-zb-primary-strong/75 p-6">
            <h2 className="font-display text-2xl text-zb-cream">DELIVERY ADDRESSES</h2>
            <p className="mt-1 text-sm text-zb-cream/60">Reused when you order delivery.</p>
            <div className="mt-5">
              <AddressManager addresses={addresses} />
            </div>
          </section>
```

- [ ] **Step 4: Verify**

Run `npm run dev`, sign in, go to `/account`. Add an address (pick a tier) → appears in the list. Set a different one default → "Default" badge moves. Delete one → removed. Reload → state persists. Stop server.

- [ ] **Step 5: Commit**

```bash
git add app/account/actions.ts components/account/AddressManager.tsx app/account/page.tsx
git commit -m "feat(account): saved delivery address CRUD"
```

---

## Task 11: My Orders history

**Files:**
- Modify: `app/account/page.tsx` (render orders section)

**Interfaces:**
- Consumes: `getCurrentUser`; `createClient`; the customer self-read RLS on `orders` from Task 2; existing `/order/[code]` tracking page.
- Produces: an "ORDERS" section listing the signed-in customer's orders (newest first) with status + total, each linking to `/order/<short_code>`.

- [ ] **Step 1: Add an order fetch helper inline in the page**

In `app/account/page.tsx`, add imports:
```tsx
import Link from "next/link";
import { formatPeso } from "@/lib/peso";
import { createClient } from "@/lib/supabase/server";
```
After fetching `addresses`, fetch orders (RLS restricts to the current user):
```tsx
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("short_code, status, service_mode, total_cents, placed_at")
    .order("placed_at", { ascending: false });
```

- [ ] **Step 2: Render the orders section**

Replace the `{/* ORDERS section added in Task 11 */}` comment with:
```tsx
          <section className="mt-6 rounded-2xl border border-zb-sage/25 bg-zb-primary-strong/75 p-6">
            <h2 className="font-display text-2xl text-zb-cream">YOUR ORDERS</h2>
            {!orders || orders.length === 0 ? (
              <p className="mt-3 text-sm text-zb-cream/60">
                No orders yet. <Link href="/menu" className="text-zb-bone hover:underline">Browse the menu</Link>.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-zb-sage/20">
                {orders.map((o) => (
                  <li key={o.short_code}>
                    <Link href={`/order/${o.short_code}`} className="flex items-center justify-between gap-3 py-3 transition hover:text-zb-bone">
                      <div className="min-w-0">
                        <p className="font-mono-tabular font-semibold text-zb-cream">{o.short_code}</p>
                        <p className="text-xs text-zb-cream/55">
                          {new Date(o.placed_at as string).toLocaleString("en-PH")} · {o.status}
                        </p>
                      </div>
                      <span className="font-mono-tabular text-sm text-zb-cream/85">
                        {formatPeso(o.total_cents as number)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
```

- [ ] **Step 3: Verify**

Run `npm run dev`, sign in. Initially "No orders yet." (Full population is verified in Task 12 after placing a signed-in order.) Confirm the section renders without error and the menu link works. Stop server.

- [ ] **Step 4: Commit**

```bash
git add app/account/page.tsx
git commit -m "feat(account): My Orders history list"
```

---

## Task 12: Checkout integration — delivery gate, prefill, saved addresses

**Files:**
- Modify: `app/(shop)/checkout/page.tsx`
- Modify: `components/shop/CheckoutForm.tsx`
- Modify: `app/actions/checkout.ts:69-71`

**Interfaces:**
- Consumes: `getCurrentUser`, `getCustomerProfile`, `getSavedAddresses` + `SavedAddress` from `lib/auth.ts`; the `AUTH_REQUIRED` error raised by `place_order()` (Task 3).
- Produces: a login-aware `CheckoutForm` that (a) blocks the guest delivery path with a sign-in prompt, (b) pre-fills name/phone for logged-in users, (c) offers saved addresses for delivery, and (d) surfaces `AUTH_REQUIRED` as a friendly message.

- [ ] **Step 1: Make the checkout page pass auth data**

Replace `app/(shop)/checkout/page.tsx` with:
```tsx
import { CheckoutForm } from "@/components/shop/CheckoutForm";
import { DoodleBg } from "@/components/shared/DoodleBg";
import { Footer } from "@/components/shared/Footer";
import { Header } from "@/components/shared/Header";
import { getCurrentUser, getCustomerProfile, getSavedAddresses } from "@/lib/auth";

export const metadata = { title: "Checkout" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const user = await getCurrentUser();
  const profile = user ? await getCustomerProfile() : null;
  const savedAddresses = user ? await getSavedAddresses() : [];

  return (
    <>
      <Header />
      <DoodleBg className="flex-1">
        <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zb-bone">Almost revived</p>
            <h1 className="mt-2 font-display text-5xl text-zb-cream sm:text-6xl">CHECKOUT</h1>
            <p className="mt-3 max-w-2xl text-zb-cream/65">Choose how you want it, tell us where it is going, and review the total.</p>
          </div>
          <CheckoutForm
            isLoggedIn={!!user}
            profile={profile ?? { display_name: null, phone: null }}
            savedAddresses={savedAddresses}
          />
        </main>
      </DoodleBg>
      <Footer />
    </>
  );
}
```

- [ ] **Step 2: Add props + prefill + delivery gate to `CheckoutForm.tsx`**

Update the imports and signature. Add to the top imports:
```tsx
import { LogIn } from "lucide-react";
import type { SavedAddress } from "@/lib/auth";
```
Change the component signature and add a saved-address state:
```tsx
export function CheckoutForm({
  isLoggedIn,
  profile,
  savedAddresses,
}: {
  isLoggedIn: boolean;
  profile: { display_name: string | null; phone: string | null };
  savedAddresses: SavedAddress[];
}) {
  const [lines, setLines] = useState<CartLine[] | null>(null);
  const [mode, setMode] = useState<ServiceMode>("pickup");
  const [pickupTime, setPickupTime] = useState<string | null>(null);
  const [deliveryTier, setDeliveryTier] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [reviewed, setReviewed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // ...existing refs/state unchanged...
```

- [ ] **Step 3: Pre-fill name + phone defaults**

On the Name input (currently `CheckoutForm.tsx:217`), add a default value:
```tsx
              <input name="customerName" required autoComplete="name" defaultValue={profile.display_name ?? ""} className={inputClass} placeholder="Your name" />
```
On the Mobile number input (currently `:222`), add:
```tsx
                <input name="customerPhone" required inputMode="tel" autoComplete="tel" defaultValue={profile.phone ?? ""} pattern="(?:\+63|0)9\d{9}" title="Use a Philippine mobile number such as 09186056360" className={inputClass} placeholder="09XX XXX XXXX" />
```

- [ ] **Step 4: Gate the delivery section for guests**

Wrap the existing `{mode === "delivery" && ( ... )}` block (currently `:291-358`) so guests see a sign-in prompt instead of the address form. Replace the opening `{mode === "delivery" && (` with:
```tsx
            {mode === "delivery" && !isLoggedIn && (
              <div className="sm:col-span-2 rounded-2xl border border-zb-bone/40 bg-zb-bone/10 p-5">
                <p className="flex items-center gap-2 font-semibold text-zb-bone">
                  <LogIn className="size-4" /> Delivery needs an account
                </p>
                <p className="mt-2 text-sm leading-6 text-zb-cream/70">
                  For safety and accountability, delivery orders require a signed-in
                  customer. Dine-in, take out, and pickup stay available as a guest.
                </p>
                <Link href="/login?next=/checkout" className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-zb-bone px-5 font-semibold text-zb-primary-dark transition hover:bg-zb-bone-soft">
                  Sign in to continue
                </Link>
              </div>
            )}
            {mode === "delivery" && isLoggedIn && (
```
(The existing address fields/fieldset stay inside this second block; close it with the existing `)}`.)

- [ ] **Step 5: Offer saved addresses (logged-in delivery)**

At the top of the logged-in delivery block (just inside `{mode === "delivery" && isLoggedIn && (` and its `<>`), add a saved-address picker before the "Delivery address" textarea:
```tsx
                {savedAddresses.length > 0 && (
                  <fieldset className="sm:col-span-2">
                    <legend className="text-sm font-medium">Saved addresses</legend>
                    <div className="mt-3 grid gap-2">
                      {savedAddresses.map((a) => (
                        <label key={a.id} className="cursor-pointer">
                          <input
                            type="radio"
                            name="savedAddress"
                            value={a.id}
                            checked={selectedAddressId === a.id}
                            onChange={() => {
                              setSelectedAddressId(a.id);
                              setDeliveryTier(a.tier);
                            }}
                            className="peer sr-only"
                          />
                          <span className="block rounded-xl border border-zb-sage/30 bg-zb-primary-dark/35 px-4 py-3 text-sm transition hover:border-zb-sage peer-checked:border-zb-bone peer-checked:bg-zb-bone/10">
                            <span className="font-semibold">{a.label || "Address"}</span>
                            <span className="ml-2 text-zb-cream/60">{a.street}{a.barangay ? `, ${a.barangay}` : ""}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}
```
When a saved address is selected, prefill the address inputs by adding `defaultValue` is not enough (controlled by selection); instead key the textarea/inputs off the selection. Simplest reliable approach: when `selectedAddressId` is set, populate hidden fallbacks. Add to the `handlePlaceOrder` delivery payload (Step 6) a branch that reads the saved address when one is selected.

- [ ] **Step 6: Build the delivery payload from saved address when chosen**

In `handlePlaceOrder`, replace the `delivery:` construction (currently `:121-135`) with:
```tsx
      delivery:
        mode === "delivery" && isLoggedIn
          ? (() => {
              const saved = savedAddresses.find((a) => a.id === selectedAddressId);
              if (saved) {
                return {
                  street: saved.street,
                  barangay: saved.barangay ?? undefined,
                  landmark: saved.landmark ?? undefined,
                  tier: saved.tier,
                };
              }
              if (deliveryTier && deliveryTier !== "out-of-zone") {
                return {
                  street: String(data.get("street") ?? ""),
                  barangay: data.get("barangay") ? String(data.get("barangay")) : undefined,
                  landmark: data.get("landmark") ? String(data.get("landmark")) : undefined,
                  tier: deliveryTier as "tier-2" | "tier-4" | "tier-6",
                };
              }
              return undefined;
            })()
          : undefined,
```
> When a saved address is selected, the manual street/barangay inputs are not required. Make the new-address inputs required only when no saved address is chosen: on the "Delivery address" textarea and "Barangay" input, change `required` to `required={!selectedAddressId}`.

- [ ] **Step 7: Disable Place Order on the guest delivery dead-end**

On the "Review order" submit button (currently `:412`), extend the `disabled` expression:
```tsx
disabled={deliveryTier === "out-of-zone" || (mode === "pickup" && pickupSlots.length === 0) || (mode === "delivery" && !isLoggedIn)}
```

- [ ] **Step 8: Surface AUTH_REQUIRED as a friendly message**

In `app/actions/checkout.ts`, replace the error return (currently `:69-71`) with:
```ts
  if (error) {
    const message =
      error.message === "AUTH_REQUIRED"
        ? "Please sign in to place a delivery order."
        : error.message;
    return { ok: false, error: message };
  }
```

- [ ] **Step 9: Verify the whole flow (covers DB Test C)**

Run `npm run dev`:
1. **Guest pickup:** as a guest, place a pickup order → succeeds, redirects to `/order/<code>`. (No regression.)
2. **Guest delivery blocked:** as a guest, pick Delivery → sign-in prompt shows, Review/Place disabled.
3. **Signed-in delivery:** sign in, add a saved address in `/account`, return to `/checkout` → name/phone pre-filled; pick Delivery → saved address selectable; place the order → succeeds.
4. **Ownership:** open `/account` → the delivery order appears under YOUR ORDERS with the right total (this is **DB Test C**: confirm via SQL `select user_id from orders where short_code='<code>'` that `user_id` is your auth id, not null).
5. **Server guard:** (optional) sign out, and confirm a forced delivery submit returns "Please sign in to place a delivery order."

Stop server.

- [ ] **Step 10: Commit**

```bash
git add "app/(shop)/checkout/page.tsx" components/shop/CheckoutForm.tsx app/actions/checkout.ts
git commit -m "feat(checkout): login-aware delivery gate, prefill, saved addresses"
```

---

## Self-Review

**Spec coverage:**
- Magic-link auth → Tasks 4–7. ✅
- Customer identity = separate tables on `auth.users` → Task 1. ✅
- Profile (name + phone) → Task 9. ✅
- Saved delivery addresses → Task 10. ✅
- Order history → Task 11. ✅
- Guest checkout retained for dine-in/take-out/pickup → unchanged paths, verified Task 12 step 1. ✅
- Delivery requires login, two-layer (client gate + server `AUTH_REQUIRED`) → client Task 12 steps 4/7, server Task 3, message Task 12 step 8. ✅
- RLS self-scoping → Task 2. ✅
- Header auth control → Task 8. ✅
- Out of scope (guest-order linking, OAuth, payments) → not planned. ✅

**Placeholder scan:** No TBD/TODO; every code step shows complete code. The only "added later" references are forward-pointers to numbered tasks that include the full code (Tasks 10/11 fill the commented section placeholders in Task 9's page). ✅

**Type consistency:** `SavedAddress` defined in Task 5 and consumed unchanged in Tasks 10/12. `LoginState`/`ProfileState`/`AddressState` each defined where their action lives and imported by their form. `getCurrentUser/getCustomerProfile/getSavedAddresses` signatures consistent across Tasks 5, 8, 9, 10, 11, 12. `place_order` returns the same JSON shape as 0013. ✅
