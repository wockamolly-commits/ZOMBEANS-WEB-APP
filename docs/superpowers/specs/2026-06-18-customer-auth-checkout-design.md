# Customer Authentication & Checkout Improvements — Design

**Date:** 2026-06-18
**Status:** Approved for planning

## Goal

Give customers optional accounts (passwordless email/magic-link sign-in) with a
profile, saved delivery addresses, and order history — while keeping fast guest
checkout for everyone. **Delivery orders require a logged-in account**; all other
service modes (dine-in, take-out, pickup) remain available to guests.

The driving tradeoff: speed and convenience for the common case (guest pickup/
take-out), with accountability and reuse where it matters (delivery, repeat
customers).

## Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Sign-in method | Magic link (passwordless email, `signInWithOtp`) | No passwords to store, reset, or get wrong. Lowest-friction registration = login. |
| Customer identity model | Separate `customer_profiles` table keyed on `auth.users(id)` | Leaves the staff `profiles` table and `current_role_kind()` RLS untouched; customer RLS is cleanly self-scoped. |
| Account features | Profile (name + phone), saved delivery addresses, order history | Confirmed in scope. |
| Linking past guest orders to a new account | **Out of scope** (deferred) | More complex matching logic; not needed for first release. |
| Delivery enforcement | Two layers: client UX gate + server `place_order()` guard | Server is the real guard; client is convenience. |

## Architecture

### Customer vs. staff identity

`profiles` + the `user_role` enum (`admin`/`staff`/`rider`) stay exactly as they
are — they describe operators, not customers. Customers are modeled in their own
tables, all keyed on `auth.users(id)`. A customer is simply an authenticated user
with no row in `profiles`.

### Data model (new migrations)

`0014_customer_accounts.sql`:

- **`customer_profiles`**
  - `id uuid primary key references auth.users(id) on delete cascade`
  - `display_name text`
  - `phone text`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()` (with `set_updated_at` trigger)
  - Auto-created on first sign-in via an `on auth.users` insert trigger
    (`handle_new_customer`), so a profile row always exists for an authed user.

- **`customer_addresses`**
  - `id uuid primary key default gen_random_uuid()`
  - `user_id uuid not null references auth.users(id) on delete cascade`
  - `label text` (e.g. "Home", "Work")
  - `street text not null`
  - `barangay text`
  - `landmark text`
  - `city text not null default 'San Carlos City'`
  - `tier text not null` (`tier-2` | `tier-4` | `tier-6`)
  - `is_default boolean not null default false`
  - `created_at timestamptz not null default now()`
  - index on `(user_id)`

- **`orders`** — add `user_id uuid references auth.users(id)` (nullable; `null`
  for guest orders). Index on `(user_id, placed_at desc)`.

`0015_customer_rls.sql`:

- Enable RLS on `customer_profiles` and `customer_addresses`.
- `customer_profiles`: select/insert/update where `id = auth.uid()`.
- `customer_addresses`: select/insert/update/delete where `user_id = auth.uid()`.
- `orders`: add a **customer self-read** policy — `select using (user_id = auth.uid())`.
  Existing staff/rider policies are unchanged.
- `order_items` / `delivery_addresses`: add customer self-read policies scoped to
  orders the customer owns (mirrors the existing staff read policies but with the
  `user_id = auth.uid()` predicate via an `exists` subquery).

### `place_order()` changes (`0016_place_order_auth.sql`)

The RPC runs as `security definer` but `auth.uid()` still reflects the caller's
session (anon vs. authenticated). Changes:

1. Read `v_user_id := auth.uid()` at the top.
2. **Delivery guard:** if `v_service_mode = 'delivery'` and `v_user_id is null`,
   `raise exception 'AUTH_REQUIRED'`.
3. Persist `user_id => v_user_id` on the `orders` insert (null for guests).

Everything else in the function is unchanged.

### Auth flow (magic link)

- **`middleware.ts`** (new, repo root): refreshes the Supabase session on every
  request via `@supabase/ssr`, so server components and the `place_order` action
  see a valid `auth.uid()`. This is currently missing and is a prerequisite for
  all server-side auth. Matcher excludes static assets.
- **`/login` page** (`app/(auth)/login/page.tsx`): email field →
  `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: /auth/confirm } })`.
  Shows a "check your email" confirmation state. Accepts an optional `?next=`
  param to return the user to checkout after sign-in.
- **`/auth/confirm` route handler** (`app/auth/confirm/route.ts`): exchanges the
  magic-link token (`verifyOtp` / code exchange), then redirects to `next` or
  `/account`.
- **`/auth/signout` route handler**: `signOut()` + redirect home.

### Account area (auth-gated, `app/(account)/account/`)

A server component that redirects to `/login?next=/account` if no session.

- **Profile section:** edit `display_name` + `phone`, saved via a server action
  (`updateProfile`) to `customer_profiles`.
- **Saved addresses section:** list / add / edit / delete `customer_addresses`
  via server actions; mark one default.
- **My Orders section:** list the customer's orders (`select * from orders where
  user_id = auth.uid() order by placed_at desc`) with status badge + link to the
  existing `/order/[code]` tracking page.

### Header auth control

A small server component in the layout: shows "Sign in" when logged out, and an
"Account" link when logged in. Keeps the existing localStorage-based order
tracking link working for guests.

### Checkout integration (`CheckoutForm.tsx` + `app/actions/checkout.ts`)

- The checkout page (server) reads the session and the customer profile, passing
  `isLoggedIn`, `profile`, and `savedAddresses` to `CheckoutForm`.
- **Logged-in:** name/phone pre-filled from the profile; for delivery, saved
  addresses render as selectable cards (plus an "enter a new address" option).
- **Guest:** identical to today for dine-in / take-out / pickup.
- **Delivery rule (client layer):** when the user is not logged in and selects
  Delivery, the address form is replaced by a sign-in prompt ("Delivery orders
  need an account — sign in to continue"), with a button to `/login?next=/checkout`.
  The Place Order button is disabled in this state.
- **Delivery rule (server layer):** `placeOrder` relies on the `place_order()`
  RPC raising `AUTH_REQUIRED`, surfaced to the user as a friendly message. This
  is the authoritative guard regardless of client state.
- `placeOrder` no longer needs to pass `user_id` explicitly — the RPC reads it
  from `auth.uid()`.

## Data flow

1. **Guest pickup order:** CheckoutForm → `placeOrder` action → `place_order` RPC
   (`auth.uid()` null, mode ≠ delivery → allowed) → order row with `user_id null`
   → redirect to `/order/[code]`. Unchanged from today.
2. **Customer delivery order:** sign in via magic link → session cookie set by
   middleware → checkout pre-fills profile + saved address → `placeOrder` → RPC
   (`auth.uid()` set, mode delivery → allowed) → order row with `user_id` →
   appears in My Orders.
3. **Guest attempts delivery:** client shows sign-in prompt; if bypassed, RPC
   raises `AUTH_REQUIRED` and the order is rejected.

## Error handling

- `AUTH_REQUIRED` (new): mapped in `placeOrder`/CheckoutForm to "Please sign in to
  place a delivery order."
- Magic-link send failure: `/login` shows an inline error and lets the user retry.
- Expired/invalid magic link at `/auth/confirm`: redirect to `/login` with an
  error flag.
- Server actions for profile/addresses validate ownership implicitly via RLS
  (`auth.uid()` predicate); a failed write surfaces as an inline error.

## Testing

- **DB (SQL / RPC):** `place_order` rejects delivery when unauthenticated
  (`AUTH_REQUIRED`); accepts delivery when authenticated and stamps `user_id`;
  guest pickup/take-out/dine-in still succeed with `user_id null`. RLS: a
  customer can read only their own orders/addresses/profile.
- **Auth:** magic-link request creates the OTP; `/auth/confirm` establishes a
  session; `handle_new_customer` trigger creates a `customer_profiles` row.
- **Checkout UI:** guest sees sign-in prompt on delivery; logged-in sees
  pre-filled details + saved addresses; non-delivery guest flow unchanged.
- **Account:** profile edit persists; address CRUD works and enforces ownership;
  My Orders lists only the signed-in customer's orders.

## Out of scope

- Linking pre-existing guest orders to a newly created account.
- Social / OAuth sign-in (magic link only for now).
- Online payment (still PayMongo-deferred, unchanged).

## Affected / new files

- New migrations: `0014_customer_accounts.sql`, `0015_customer_rls.sql`,
  `0016_place_order_auth.sql`.
- New: `middleware.ts`, `app/(auth)/login/page.tsx`, `app/auth/confirm/route.ts`,
  `app/auth/signout/route.ts`, `app/(account)/account/page.tsx` (+ section
  components and server actions for profile/addresses), header auth control.
- Modified: `app/actions/checkout.ts` (AUTH_REQUIRED handling), `CheckoutForm.tsx`
  (login-aware delivery gate + prefill + saved addresses), `app/layout.tsx`
  (header auth control), checkout page (pass session/profile/addresses).
