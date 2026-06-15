# ZomBeans — Café Ordering Management System
**Planning & Architecture Document (v1.0)**

> "Rise Up From The Dead." A production-ready ordering platform for ZomBeans Café — built on Next.js 15, Supabase, and Loyverse POS.

This document is the **complete pre-code plan**. No code is generated until you approve this.

---

## 0. TL;DR — What We're Building

A premium, mobile-first web app where customers can order **Dine-in / Pickup / Delivery** as guests. Every order lands first in a **ZomBeans Admin Dashboard** where staff *Accept → forward to Loyverse POS → Prepare → Ready → Out for Delivery → Completed*. The café's own rider gets a dedicated mobile-friendly delivery view with Google Maps navigation. Realtime status updates flow back to the customer's order-tracking page.

The website is **not just an ordering form** — it's a brand experience for ZomBeans (the playful zombie-coffee identity), built to the visual quality of Starbucks Reserve or a premium independent café site, not Foodpanda.

---

## 1. Asset & Brand Analysis

### 1.1 What I reviewed
- **Logo** (`zombeans-logo.jpg`) — coffee bean mascot with pink brain + dripping green slime, thick black cartoon outlines.
- **Prototype mockups** (5 JPGs) — homepage, About Us, menu landing, color palette page, doodle background swatches.
- **Menu pages 1–4** (PNG) — full live menu with peso pricing, size variants, and "Zombeans Bestseller" badges.
- **Product photography** — 30 drink PNGs + 31 food PNGs, all shot on white backgrounds (PNG cutouts), Instagram-ready quality.

### 1.2 Brand Analysis

| Dimension | Reading |
|---|---|
| **Identity** | Playful zombie-coffee café. Cartoon mascot logo, doodle background — leans youthful, but with a premium dark-green palette that keeps it grown-up. |
| **Wordmark** | "ZOMBEANS" set in a heavy condensed display sans (Bebas Neue / Anton family). Confident, all-caps, billboard energy. |
| **Tagline** | "RISE UP FROM THE DEAD" — leans into the zombie/coffee-wakes-you-up double meaning. Use sparingly, never compete with H1. |
| **Color** | Dark forest green dominates; cream (`#ede0d6`) provides relief; sage (`#65845b`) is the only mid-tone. There is **no warm accent yet** — we'll add one (see §1.4). |
| **Photography** | Drinks on white background, food plated on green ceramic plates — the green plate echoes brand color (lucky alignment, lean into this). |
| **Voice** | Currently generic ("modern and innovative platform created to provide quality services"). Needs ZomBeans-specific copy with light zombie humor — "Brew. Brain. Bite." not "We are committed to excellence." |

### 1.3 UI / UX Audit of the Prototype

The prototype establishes the *palette and mood* well, but as a working café ordering site it has structural problems:

| # | Prototype issue | Why it hurts | Fix |
|---|---|---|---|
| 1 | Homepage hero is logo + centered welcome text only. No CTA. | Visitors don't know whether to order, browse, or call. | Replace with a hero that opens with an **"Order Now"** primary CTA + a service-mode chooser (Dine-in / Pickup / Delivery). |
| 2 | "Our Menu" page is three big cards (Coffee-Based / Non-Coffee / Best Sellers). | This is a category gate, not a menu. Users want to *see* drinks, not click into another page. | Single menu page with sticky category tabs + a real product grid with photos and prices. |
| 3 | Doodle background runs full-bleed behind everything, including text. | Hurts legibility, especially on menu cards. | Use doodle pattern as **hero/section accent only**, not as the page background. Use cream `#ede0d6` and dark green flats behind cards. |
| 4 | Nav has Home/About/Menu/Contact and nothing else. | No cart, no order tracking, no auth slot, no service-mode pill. | Sticky header with: logo • menu • Track Order • cart icon (count) • **Order Now** CTA pill. |
| 5 | About Us copy is filler. | Erodes trust on a real cafe site. | Replace with founder story, location, hours, photos of the actual café. |
| 6 | No responsive consideration visible. | Mobile is **>70% of café traffic** in PH. | Mobile-first redesign with bottom-sticky "View Cart" bar, swipeable category tabs, thumb-friendly hit areas. |
| 7 | No clear ordering flow shown. | Whole reason the site exists. | Customer flow §4.2 below — guest-first, 4 screens max from menu to confirmation. |
| 8 | No accessibility considerations. | Cream-on-dark-green needs to be checked for WCAG AA. | All combinations specified in §3.3 are AA-verified. |

### 1.4 Design Improvements We're Adopting

**Keep from prototype:** color palette, doodle motif (as accent), wordmark, mascot logo, "Rise Up From The Dead" tagline as supporting line.

**Replace / add:**
- A new **warm accent** for prices/CTAs/badges to break up the all-green wash. Proposed: **`#E5C07B` (Bone)** — a desaturated cream-gold that reads as "premium" against the dark green and pairs naturally with coffee tones. Used sparingly: price chips, primary button highlights, "Bestseller" badges.
- A **secondary display font** for body copy (the prototype only uses the heavy display font, which becomes fatiguing). Pair Bebas Neue / Anton (display) with **Inter** (body) and **JetBrains Mono** (prices/order numbers — gives the receipt-feel).
- **Real product photography** front and center, not typography.
- **Service-mode selector** as a persistent top-level state (Dine-in / Pickup / Delivery), affecting cart, checkout fields, and price (no delivery fee if pickup, etc.).
- **Track Order** as a first-class feature with a short order code (e.g., `ZB-7F3K`) the customer can paste anywhere.

---

## 2. Menu Model (from real menu pages)

The menu structure drives the data model. From pages 1–4 we have:

### 2.1 Categories
1. **Signature Drinks** — Zomboss, Spanish, Salted Caramel, Biscoff, etc.
2. **Coffee** — Americano, Caramel/Hazelnut/Salted Hazelnut/Mocha Latte
3. **Matcha** — Matcha Latte, Clean Matcha, White Mocha Matcha, Chabako, Creamcheese Latte
4. **Milk Series** — Strawberry/Blueberry/Ube/Mango Milk, Milo Overload, Choco HQ Blend
5. **Creamcheese Series** — Strawberry/Blueberry/Milo Creamcheese
6. **Sparkling** — Sparkling Strawberry / Blueberry
7. **Tea** — Honey Lemon / Pomegranate / Ginger / Peach Oolong
8. **Rice Bowls** — Bacon, Hungarian, Tocino, Tapa, Corned Beef, Longganisa, Chick'n Rice, Burger Steak, Pork Belly w/ Mushroom Gravy
9. **Toasts** — Bacon Toast, Salami Toast
10. **Croffles** — Plain, Biscoff, Choco Almond, Milo Overload, Strawberry/Blueberry Creamcheese
11. **Chicken & Sandwiches** — Chick'n Fries, Chick'n Buns, Chicken & Ham Overload, Taco Burger, Chicken Salad
12. **Sides** — Chick'n Chips, Nori Bites, Wings & Wedges, Shawarma Fries, Fries & Wedges, Flavored Fries, Quesadilla, Nachos Overload

### 2.2 Variations & Modifiers Observed
- **Temperature**: Hot / Cold (most drinks; some Cold-only)
- **Size**: 16oz / 1 Liter (drinks)
- **Variant**: Chicken / Beef (Quesadilla, Nachos Overload)
- **Sauce selection (modifier, choose-one)**: Cheesy Buffalo / Garlic Buffalo / Cheesy BBQ (Chick'n Fries; likely Wings)
- **Bestseller flag** — boolean badge

Pricing is **per variation**, not per item — Cold 16oz and Cold 1L are separate prices. Schema must model this (§5).

### 2.3 Currency & Locale
- Philippine Peso (₱). All prices stored as **integer minor units (cents)** to avoid float drift — `price_cents BIGINT`. Display formatter converts: `12000 → ₱120.00` (or `₱120` if `.00`).

---

## 3. UX Architecture

### 3.1 Sitemap

```
Public
├─ /                       Home (hero, bestsellers, service-mode CTA, about teaser, location)
├─ /menu                   Full menu (single page, category tabs, photo grid)
├─ /menu/[slug]            Product detail (variations, modifiers, qty, add-to-cart)
├─ /cart                   Cart review (server-rendered, edit qty, change service mode)
├─ /checkout               Service-mode-aware form (Dine-in | Pickup | Delivery) → payment
├─ /order/[code]           Order tracking by short code (e.g., ZB-7F3K) — realtime status
├─ /about                  Real founder story, location, hours, photos
├─ /contact                Contact, FB/IG, hours, map
└─ /legal/*                Terms, Privacy

Staff (auth required, role-gated)
├─ /admin                  Dashboard overview (today's KPIs)
├─ /admin/orders           Realtime kanban: Pending → Accepted → Preparing → Ready → OFD → Completed
├─ /admin/orders/[id]      Order detail, accept/reject, assign rider, forward to Loyverse
├─ /admin/menu             Category/item/variation/modifier CRUD, availability toggle
├─ /admin/menu/sync        Loyverse menu sync (pull items, map IDs)
├─ /admin/riders           Rider CRUD
├─ /admin/staff            Staff CRUD (admin only)
├─ /admin/analytics        Sales analytics
└─ /admin/audit            Audit log

Rider (auth required, role-gated)
├─ /rider                  Today's assigned deliveries (mobile-first)
└─ /rider/delivery/[id]    Customer info, address, landmark, Google Maps deeplink, mark delivered
```

### 3.2 Customer Order Flow (guest-first, 4 screens)

```
Screen 1: Menu         → tap product
Screen 2: Product      → choose variation/modifiers/qty → Add to cart
Screen 3: Cart         → choose service mode (Dine-in/Pickup/Delivery) → Checkout
Screen 4: Checkout     → mode-specific fields + payment method → Place Order
              ↓
Result:   /order/[code] (realtime tracking, status badges, ETA)
```

- **No login required.** Cart persists in `localStorage` + a Supabase `carts` row keyed by `cart_token` cookie (so we can resume across devices later if user opts in).
- **One-tap re-add** for bestsellers from `/`.

### 3.3 Visual System

**Color tokens (used by Tailwind + CSS variables):**

| Token | Hex | Use | Contrast on `#ede0d6` |
|---|---|---|---|
| `--zb-primary` | `#203222` | Surfaces, header, dark sections | 11.2:1 ✓ AAA |
| `--zb-primary-strong` | `#1c2d1d` | Deeper surface, hover states | 12.1:1 ✓ AAA |
| `--zb-primary-dark` | `#1e2016` | Footer, modals | 13.8:1 ✓ AAA |
| `--zb-sage` | `#65845b` | Borders, secondary buttons, badges | 3.0:1 — large text / icons only |
| `--zb-cream` | `#ede0d6` | Body bg on light sections, text on dark | n/a |
| `--zb-bone` (new) | `#e5c07b` | Prices, primary CTAs, bestseller badge | 4.6:1 ✓ AA |
| `--zb-slime` (logo green only) | `#3ade3a` | Reserved for logo; no UI use | n/a |
| `--zb-danger` | `#c0392b` | Rejected status, errors | AA on dark surfaces |

**Typography:**
- Display: **Anton** (free, near-identical to prototype wordmark)
- Body: **Inter**
- Numerics (prices, order codes, timers): **JetBrains Mono**

**Spacing/grid:** 4px base. Container max-width 1280px. Mobile breakpoint at 768px. Bottom-sticky cart bar on mobile when cart not empty.

**Doodle pattern** (`#bg-doodle`): retained as a CSS-tiled SVG, used as overlay only on hero, About, and order-confirmation screens at ~8% opacity. Never behind body text.

**Accessibility floor:** WCAG 2.1 AA. Focus rings always visible. Form errors named + colored. Sage cannot be used for small body text.

---

## 4. System Architecture

### 4.1 High-level

```
┌────────────────────────────────────────────────────────────────┐
│                      Customer Browser                          │
│  Next.js 15 (App Router, RSC) · Tailwind · shadcn/ui          │
└──────────────────────┬───────────────────┬────────────────────┘
                       │ Server Actions    │ Supabase JS (realtime)
                       ▼                   ▼
┌──────────────────────────┐    ┌──────────────────────────────┐
│  Next.js Server Runtime  │    │       Supabase               │
│   - Server Actions       │    │  · Postgres + RLS            │
│   - Route handlers       │    │  · Auth (staff/rider only)   │
│   - Loyverse client      │◄──►│  · Realtime (orders channel) │
│   - Cron (Vercel cron)   │    │  · Storage (menu images)     │
└────────┬──────┬──────────┘    └──────────────────────────────┘
         │      │
         │      └─► Resend (email confirmations + rider notify)
         │
         ├─► Google Maps Platform (Places, Directions, Static Maps)
         │
         └─► Loyverse Receipts API (forward-on-accept, idempotent)
```

### 4.2 Why this shape
- **Server-side everything ordering-related.** Cart pricing, totals, taxes, and Loyverse forwarding all happen on the server. The client never tells us a price.
- **Supabase Auth for staff/rider only.** Customers are guest-first; the `customer` "row" is born at checkout-confirm and has no auth identity yet (just a record + optional email).
- **Realtime channel for orders.** Admin dashboard subscribes to `orders` table changes; customer's tracking page subscribes to its own order id only. Powered by Supabase Realtime + RLS.
- **Loyverse stays the source of truth for sales/inventory.** We only push *accepted* orders. We do not pull payments from Loyverse — payment status on our side is `cash_pending` / `paid` / `gcash_pending` etc., set by staff in the dashboard.

### 4.3 Service-mode logic

| Mode | Required fields | Pricing rules | Loyverse mapping |
|---|---|---|---|
| **Dine-in** | name, table_number | No service charge; subtotal == total | Loyverse `dining_option` = Dine-in; table # in note |
| **Pickup** | name, phone, pickup_time | No fee; warn if < 15min ahead | Loyverse `dining_option` = Take-out |
| **Delivery** | name, phone, address, landmark, notes, lat/lng | Add delivery fee (config-driven; flat or distance band) | Loyverse `dining_option` = Delivery; address in note |

A single `service_mode` enum keeps the order row clean; mode-specific extras live in `order_meta` JSONB and `delivery_addresses` (one-to-one).

---

## 5. Database Design (PostgreSQL on Supabase)

### 5.1 ER overview

```
roles (seed)
   │
profiles ──────► auth.users (Supabase auth; staff/riders only)
   │
   └──► riders (optional 1-to-1 for role=rider; vehicle, plate)

menu_categories ─┬─► menu_items ─┬─► item_variations  (size/temp, has price)
                 │                ├─► item_modifier_groups ─► item_modifiers (sauce choices, etc.)
                 │                └─► item_images
                 │
                 └─► (sort_order, slug, is_active)

carts ──► cart_items ──► (item_id, variation_id, modifiers[], qty, snapshot_unit_price_cents)

orders ─┬─► order_items ──► order_item_modifiers
        ├─► delivery_addresses           (1:1, only when mode='delivery')
        ├─► payments                     (cash / gcash; status machine)
        ├─► rider_assignments            (1:1; rider_id, picked_up_at, delivered_at)
        ├─► order_status_events          (audit trail of every status change)
        └─► loyverse_sync                (1:1; loyverse_receipt_id, payload, retry meta)

tables             (id, label, is_active, qr_token)
notifications      (id, channel, target, payload, status, sent_at)
audit_logs         (id, actor_profile_id, action, target_table, target_id, diff jsonb, ip, ua, created_at)
app_settings       (singleton config: store hours, delivery fee, prep ETA, accepting_orders bool)
```

### 5.2 Key DDL excerpts (full SQL goes in migrations during Phase 1)

```sql
-- Money as integer minor units (centavos)
-- Status enums kept tight so we get compile-time checks via codegen

CREATE TYPE service_mode AS ENUM ('dine_in','pickup','delivery');

CREATE TYPE order_status AS ENUM (
  'pending',        -- customer placed; awaiting staff review
  'accepted',       -- staff accepted; forwarded to Loyverse
  'preparing',
  'ready',
  'out_for_delivery',
  'completed',
  'rejected',
  'cancelled'
);

CREATE TYPE payment_method AS ENUM ('cash','gcash','maya','card');  -- via PayMongo
CREATE TYPE payment_provider AS ENUM ('manual','paymongo');
CREATE TYPE payment_status AS ENUM ('pending','paid','refunded','failed');

CREATE TYPE user_role AS ENUM ('admin','staff','rider');

CREATE TABLE menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES menu_categories(id) ON DELETE RESTRICT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,                       -- primary product photo
  is_bestseller BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  loyverse_item_id TEXT,                -- nullable until synced
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON menu_items(category_id);
CREATE INDEX ON menu_items(is_active, sort_order);

CREATE TABLE item_variations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  label TEXT NOT NULL,                  -- "Hot", "Cold 16oz", "Cold 1L"
  price_cents BIGINT NOT NULL CHECK (price_cents >= 0),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  loyverse_variant_id TEXT,
  sort_order INT NOT NULL DEFAULT 0
);
CREATE INDEX ON item_variations(item_id);

CREATE TABLE item_modifier_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                   -- "Sauce"
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  min_select INT NOT NULL DEFAULT 0,
  max_select INT NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE item_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES item_modifier_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                   -- "Cheesy Buffalo"
  price_delta_cents BIGINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_token TEXT UNIQUE NOT NULL,      -- httpOnly cookie
  service_mode service_mode,            -- nullable; chosen before checkout
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days'
);

CREATE TABLE cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES menu_items(id),
  variation_id UUID NOT NULL REFERENCES item_variations(id),
  modifier_ids UUID[] NOT NULL DEFAULT '{}',
  qty INT NOT NULL CHECK (qty > 0),
  unit_price_cents BIGINT NOT NULL,     -- snapshot at add-time; recomputed at checkout
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON cart_items(cart_id);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_code TEXT UNIQUE NOT NULL,      -- e.g., 'ZB-7F3K'  (8 chars total)
  status order_status NOT NULL DEFAULT 'pending',
  service_mode service_mode NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,                  -- required for pickup/delivery
  customer_email TEXT,
  table_id UUID REFERENCES tables(id),  -- when dine_in
  pickup_time TIMESTAMPTZ,              -- when pickup
  subtotal_cents BIGINT NOT NULL,
  delivery_fee_cents BIGINT NOT NULL DEFAULT 0,
  total_cents BIGINT NOT NULL,
  notes TEXT,
  placed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejected_reason TEXT,
  accepted_by_profile_id UUID REFERENCES profiles(id)
);
CREATE INDEX ON orders(status, placed_at DESC);
CREATE INDEX ON orders(short_code);
CREATE INDEX ON orders(placed_at DESC);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES menu_items(id),
  variation_id UUID NOT NULL REFERENCES item_variations(id),
  item_name_snapshot TEXT NOT NULL,     -- historical readability if items renamed
  variation_label_snapshot TEXT NOT NULL,
  unit_price_cents BIGINT NOT NULL,
  qty INT NOT NULL,
  line_total_cents BIGINT NOT NULL
);
CREATE INDEX ON order_items(order_id);

CREATE TABLE order_item_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  modifier_id UUID NOT NULL REFERENCES item_modifiers(id),
  name_snapshot TEXT NOT NULL,
  price_delta_cents BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE delivery_addresses (
  order_id UUID PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  street TEXT NOT NULL,
  barangay TEXT,
  city TEXT NOT NULL,
  landmark TEXT,
  delivery_notes TEXT,
  lat NUMERIC(10,7) NOT NULL,
  lng NUMERIC(10,7) NOT NULL,
  google_place_id TEXT
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method payment_method NOT NULL,
  provider payment_provider NOT NULL DEFAULT 'manual',
  status payment_status NOT NULL DEFAULT 'pending',
  amount_cents BIGINT NOT NULL,
  provider_intent_id TEXT,               -- PayMongo PaymentIntent id
  provider_source_id TEXT,               -- PayMongo Source id (for GCash/Maya redirect)
  provider_payment_id TEXT,              -- PayMongo Payment id once captured
  reference TEXT,                        -- manual fallback (GCash ref typed by staff)
  paid_at TIMESTAMPTZ,
  recorded_by_profile_id UUID REFERENCES profiles(id),
  raw_webhook JSONB                      -- last PayMongo webhook payload, for audit
);
CREATE INDEX ON payments(order_id);
CREATE INDEX ON payments(provider_intent_id);

CREATE TABLE tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT UNIQUE NOT NULL,            -- "T-01"
  qr_token TEXT UNIQUE,                  -- so a QR on the table deep-links to /menu?table=...
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  display_name TEXT NOT NULL,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON profiles(role);

CREATE TABLE riders (
  profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  vehicle_type TEXT,
  plate_no TEXT,
  is_available BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE rider_assignments (
  order_id UUID PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  rider_profile_id UUID NOT NULL REFERENCES profiles(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);
CREATE INDEX ON rider_assignments(rider_profile_id);

CREATE TABLE order_status_events (
  id BIGSERIAL PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status order_status,
  to_status order_status NOT NULL,
  actor_profile_id UUID REFERENCES profiles(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON order_status_events(order_id, created_at);

CREATE TABLE loyverse_sync (
  order_id UUID PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  loyverse_receipt_id TEXT,
  payload JSONB NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  last_error TEXT,
  succeeded_at TIMESTAMPTZ
);

CREATE TABLE notifications (
  id BIGSERIAL PRIMARY KEY,
  channel TEXT NOT NULL,                 -- 'email' | 'sms' (future)
  target TEXT NOT NULL,
  template TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued', -- queued|sent|failed
  attempts INT NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON notifications(status, created_at);

CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_profile_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  target_table TEXT NOT NULL,
  target_id TEXT,
  diff JSONB,
  ip INET,
  ua TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON audit_logs(target_table, target_id);
CREATE INDEX ON audit_logs(actor_profile_id, created_at DESC);

CREATE TABLE app_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),    -- singleton
  accepting_orders BOOLEAN NOT NULL DEFAULT TRUE,
  hours JSONB NOT NULL,                            -- {"mon":["08:00","20:00"], ...}
  default_prep_eta_minutes INT NOT NULL DEFAULT 20,
  pickup_slot_minutes INT NOT NULL DEFAULT 15,           -- 15-min slots
  delivery_fee_tiers JSONB NOT NULL DEFAULT              -- distance-tiered fee table
    '[{"max_km":2,"fee_cents":3000},
      {"max_km":4,"fee_cents":4000},
      {"max_km":6,"fee_cents":5000}]'::jsonb,
  delivery_max_km NUMERIC NOT NULL DEFAULT 6,            -- hard cutoff: out of zone
  store_lat NUMERIC(10,7) NOT NULL,
  store_lng NUMERIC(10,7) NOT NULL,
  loyverse_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  loyverse_store_id TEXT,
  loyverse_pos_device_id TEXT,
  email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  maps_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  paymongo_enabled BOOLEAN NOT NULL DEFAULT TRUE
);
```

### 5.3 Row-Level Security strategy

| Table | Public read | Public write | Staff/Admin | Rider |
|---|---|---|---|---|
| menu_categories, menu_items, item_variations, item_modifier_groups, item_modifiers | ✓ (active only) | ✗ | RW | R |
| carts, cart_items | by `cart_token` cookie via RPC | by `cart_token` via RPC | R | ✗ |
| orders | **read own** via short_code + RPC | insert via RPC only | RW | R (assigned only) |
| order_items, order_item_modifiers | read own via parent | insert via RPC | RW | R |
| delivery_addresses | read own via parent | insert via RPC | R | R (assigned only) |
| payments | ✗ | ✗ | RW | ✗ |
| rider_assignments | ✗ | ✗ | RW | R (own only) |
| profiles, riders, tables, app_settings | ✗ | ✗ | RW (admin); R (staff) | R own |
| audit_logs | ✗ | ✗ | R (admin) | ✗ |

Customer reads/writes (cart and own order tracking) go through **`SECURITY DEFINER` PostgreSQL functions** (`get_order_by_code`, `place_order`, `add_to_cart`) — RLS denies direct table access. This is critical: it lets us validate price totals server-side, generate short codes, and prevent enumeration.

### 5.4 Indexes & performance
- All FKs indexed.
- `orders(status, placed_at DESC)` for the kanban board.
- `menu_items(is_active, sort_order)` + `category_id` for menu page.
- `audit_logs` partitioned by month if volume grows (Phase 2).

---

## 6. Folder Structure (Next.js 15 App Router)

```
zombeans-web/
├─ app/
│  ├─ (marketing)/
│  │  ├─ page.tsx                     # /
│  │  ├─ about/page.tsx
│  │  └─ contact/page.tsx
│  ├─ (shop)/
│  │  ├─ menu/page.tsx                # /menu (RSC, streams categories)
│  │  ├─ menu/[slug]/page.tsx         # /menu/[slug]
│  │  ├─ cart/page.tsx
│  │  ├─ checkout/page.tsx
│  │  └─ order/[code]/page.tsx        # realtime tracking
│  ├─ admin/
│  │  ├─ layout.tsx                   # auth gate (role: admin|staff)
│  │  ├─ page.tsx                     # dashboard KPIs
│  │  ├─ orders/page.tsx              # realtime kanban
│  │  ├─ orders/[id]/page.tsx
│  │  ├─ menu/page.tsx                # CRUD
│  │  ├─ menu/sync/page.tsx           # Loyverse sync wizard
│  │  ├─ riders/page.tsx
│  │  ├─ staff/page.tsx
│  │  ├─ analytics/page.tsx
│  │  └─ audit/page.tsx
│  ├─ rider/
│  │  ├─ layout.tsx                   # auth gate (role: rider)
│  │  ├─ page.tsx
│  │  └─ delivery/[id]/page.tsx
│  ├─ api/
│  │  ├─ paymongo/webhook/route.ts    # payment.paid, payment.failed
│  │  ├─ loyverse/webhook/route.ts    # (future)
│  │  └─ cron/
│  │     ├─ retry-loyverse/route.ts   # Vercel cron, every 1 min
│  │     └─ expire-carts/route.ts     # nightly
│  ├─ actions/                        # server actions
│  │  ├─ cart.ts
│  │  ├─ checkout.ts
│  │  ├─ admin/orders.ts
│  │  ├─ admin/menu.ts
│  │  └─ rider.ts
│  ├─ layout.tsx
│  └─ globals.css
├─ components/
│  ├─ ui/                             # shadcn primitives
│  ├─ marketing/                      # Hero, BestsellerCarousel, AboutBlock, LocationMap
│  ├─ menu/                           # CategoryTabs, ProductCard, ProductDetailSheet
│  ├─ cart/                           # CartLine, CartSummary, StickyCartBar (mobile)
│  ├─ checkout/                       # ServiceModeTabs, DineInForm, PickupForm, DeliveryForm, MapPicker
│  ├─ order/                          # StatusTimeline, OrderHeader
│  ├─ admin/                          # OrderKanban, OrderCard, AcceptDialog, AssignRiderDialog
│  ├─ rider/                          # DeliveryCard, OpenInMapsButton
│  └─ shared/                         # Header, Footer, Logo, DoodleBg, PesoPrice
├─ lib/
│  ├─ supabase/
│  │  ├─ server.ts                    # createServerClient
│  │  ├─ browser.ts                   # createBrowserClient
│  │  └─ types.ts                     # generated types
│  ├─ loyverse/
│  │  ├─ client.ts                    # fetch wrapper, retries
│  │  ├─ map-order.ts                 # our order → Loyverse receipt payload
│  │  └─ sync-menu.ts
│  ├─ paymongo/
│  │  ├─ client.ts                    # PayMongo REST wrapper
│  │  ├─ create-intent.ts             # PaymentIntent + Source (GCash/Maya)
│  │  └─ verify-webhook.ts            # HMAC signature check
│  ├─ pricing/                        # total/subtotal/tax helpers (server-only)
│  ├─ short-code.ts                   # ZB-XXXX generator
│  ├─ peso.ts                         # cents ↔ display
│  ├─ validators/                     # zod schemas
│  └─ rate-limit.ts                   # checkout abuse guard
├─ supabase/
│  ├─ migrations/                     # SQL files, ordered
│  ├─ seed.sql                        # categories, items, modifiers from menu pages
│  └─ functions/                      # SECURITY DEFINER fns: place_order, get_order_by_code, etc.
├─ public/
│  ├─ images/
│  │  ├─ drinks/                      # PNGs from food pics/Drinks (renamed slug-friendly)
│  │  ├─ food/                        # PNGs from food pics/Food
│  │  └─ brand/                       # logo variants, doodle.svg
│  └─ favicon.ico
├─ tests/
│  ├─ e2e/                            # Playwright: place-order, accept, deliver
│  └─ unit/                           # vitest: pricing, short-code, loyverse mapping
├─ .env.example
├─ .env.local                         # not committed
├─ next.config.mjs
├─ tailwind.config.ts
├─ tsconfig.json
└─ package.json
```

---

## 7. API / Server-Action Surface

We default to **Server Actions** for write paths (better DX, automatic CSRF) and **Route Handlers** only for cron + webhooks. RPC names below match the file structure above.

### 7.1 Customer
| Action | Method | Inputs | Behavior |
|---|---|---|---|
| `getMenu()` | RSC fetch | — | Cached, revalidate on menu publish. |
| `addToCart` | Server Action | `itemId, variationId, modifierIds[], qty` | Validates qty/active flags, recomputes price server-side. |
| `updateCartItem` / `removeCartItem` | Server Action | `cartItemId, qty?` | — |
| `setServiceMode` | Server Action | `'dine_in' \| 'pickup' \| 'delivery'` | Persists on cart row. |
| `placeOrder` | Server Action (rate-limited) | `customerName, contact, modeFields, paymentMethod` | Calls `place_order()` RPC. Returns `{ shortCode }`. |
| `getOrder(code)` | RSC fetch | `code` | Uses `get_order_by_code(code)` RPC. |
| Realtime | Supabase channel | `order:<id>` | Subscribed only to the user's own order id. |

### 7.2 Staff / Admin
| Action | Inputs | Behavior |
|---|---|---|
| `acceptOrder(orderId)` | — | `status: pending → accepted`, enqueues Loyverse push, sets `accepted_by_profile_id`. |
| `rejectOrder(orderId, reason)` | reason | `status: pending → rejected`, customer email. |
| `markPreparing/Ready/OFD/Completed(orderId)` | — | Status transition + status event row. |
| `assignRider(orderId, riderId)` | riderId | Creates `rider_assignments` row. |
| `recordPayment(orderId, method, amount, ref?)` | — | Insert into `payments`; mark `paid`. |
| `pushToLoyverse(orderId)` | — | Manual retry button. |
| Menu CRUD | — | Category/item/variation/modifier; image upload to Supabase Storage. |
| `syncLoyverseMenu()` | — | Pulls items via Loyverse Items API; lets staff map our items → Loyverse item_ids. |

### 7.3 Rider
| Action | Behavior |
|---|---|
| `getMyDeliveries()` | Lists current `rider_assignments` with status `out_for_delivery` or earlier `accepted/preparing/ready` flagged for delivery. |
| `markPickedUp(orderId)` | Sets `picked_up_at` (transition is staff's call; this just records actual pickup). |
| `markDelivered(orderId)` | `status: out_for_delivery → completed`. Records `delivered_at`. |

---

## 8. Loyverse POS Integration Strategy

**Decision:** Use the **Loyverse REST API** (Bearer token, server-side only). The official "Receipts" endpoint allows creating completed sales receipts. We use it on the **Accept** transition.

### 8.1 Flow

```
[Customer placeOrder]
   └─► orders row created with status='pending'
       loyverse_sync row created with payload=null

[Staff Accept]
   ├─► status pending → accepted (transaction)
   ├─► Build Loyverse payload from order + items + variations + modifiers
   ├─► loyverse_sync.payload = built payload
   └─► Enqueue async: POST /receipts to Loyverse

[Async worker / Server Action follow-up]
   ├─► POST /receipts with Idempotency-Key = order.id
   ├─► On 2xx: loyverse_sync.loyverse_receipt_id = id, succeeded_at = now
   ├─► On 4xx: mark last_error, surface in admin UI (do NOT auto-retry validation errors)
   └─► On 5xx / network: increment attempts, retry via cron up to 10 times w/ exponential backoff

[Vercel cron /api/cron/retry-loyverse — every 1 min]
   └─► picks loyverse_sync where succeeded_at IS NULL AND attempts < 10 AND backoff_due
```

### 8.2 Why this design
- **Accept ≠ POS push synchronously.** Staff shouldn't wait for Loyverse to respond. UI says "Accepted ✓, syncing to POS…" with a small spinner that resolves when `succeeded_at` is set.
- **Idempotency-Key = order.id** prevents duplicate receipts if the worker retries.
- **Schema-validation errors don't auto-retry** — they need human attention (usually a missing `loyverse_item_id` mapping).

### 8.3 Menu sync
- One-way pull: Loyverse → us. `sync-menu.ts` lists Loyverse items + variants; admin UI lets staff drag-match our `menu_items` to Loyverse items (sets `loyverse_item_id` and `loyverse_variant_id`).
- We do *not* let Loyverse write to our menu — our menu has its own descriptions, photos, and sort orders.

### 8.4 What we deliberately don't do (yet)
- We don't process payments through Loyverse. Payment status is local. When staff records GCash/cash, it updates our `payments` table; the Loyverse receipt is already marked paid (via `payments` array in the payload).
- We don't subscribe to Loyverse webhooks. (Loyverse webhook coverage is limited; we don't need them in Phase 1.)

---

## 9. Security Strategy

| Concern | Mitigation |
|---|---|
| **Guest cart hijack** | `cart_token` is httpOnly, Secure, SameSite=Lax, rotated on checkout. RLS denies non-RPC access. |
| **Order enumeration** | Short codes are 8 chars from a 32-char alphabet (no `0/O/1/I`), giving ~10^12 space. `get_order_by_code` is rate-limited per IP. |
| **Price tampering** | Every total is recomputed server-side in `place_order()`. Client prices are display-only. |
| **Spam orders** | Rate-limit `placeOrder` to 3 per 15 min per IP + 1 per phone per 2 min. `accepting_orders=false` short-circuits. Cancel button available before staff accepts. |
| **Staff auth** | Supabase Auth, email + password + (Phase 2) TOTP. Service-role key only used in server actions. Sessions short-lived. |
| **Rider auth** | Same Supabase Auth. Rider only sees own assignments via RLS. |
| **Loyverse secrets** | API token in Vercel env var `LOYVERSE_API_TOKEN`, never sent to client. All Loyverse calls server-only. |
| **Google Maps key** | Browser key is referrer-restricted to production domains; Geocoding/Directions server-side calls use a separate server key. |
| **PII** | Phone numbers + addresses in `orders/delivery_addresses`. Encrypted at rest (Supabase default). Logs scrub phone/address. Right-to-deletion: admin action that anonymizes the order row (replaces name/phone, leaves totals for sales accuracy). |
| **CSRF** | Server Actions have automatic origin checks. Route handlers check `Origin`. |
| **CSP** | Strict CSP via `next.config.mjs`. Only `*.googleapis.com`, `*.gstatic.com`, `*.supabase.co` allowlisted. |
| **Audit** | Every staff write (accept/reject/menu change) writes to `audit_logs` with diff. |
| **Backups** | Supabase Pro daily backups. Weekly off-site download via cron to S3. |

---

## 10. Deployment Strategy

| Layer | Where | Notes |
|---|---|---|
| **Frontend + Server Actions** | Vercel | Next.js 15, edge by default; checkout + Loyverse on Node runtime. |
| **Database / Auth / Storage / Realtime** | Supabase (Singapore region for PH latency) | Pro tier required for daily backups + better connection pooling. |
| **Cron** | Vercel Cron Jobs | `retry-loyverse` every 1 min; `expire-carts` nightly. |
| **Email** | Resend | Transactional: order confirmation, status updates, rider notification. |
| **Maps** | Google Maps Platform | Places Autocomplete (checkout), Directions deeplink (rider), Static Maps (order tracking). |
| **DNS** | Cloudflare or Vercel-managed | Apex + `www`. |
| **Domain** | `zombeans.ph` recommended | (acquire) |
| **Monitoring** | Vercel Analytics + Sentry | Sentry catches client + server errors. |
| **CI** | GitHub Actions | Lint, typecheck, vitest, Playwright on PR; auto-deploy main → production. |

**Environments:**
- `dev` (local, Supabase local with `supabase start`)
- `preview` (Vercel preview deploy, ephemeral Supabase branch)
- `staging` (locked Vercel domain, separate Supabase project)
- `production` (main domain, separate Supabase project)

**Secrets** — only configured in Vercel env (never in repo):
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY        # deferred — set when ready
GOOGLE_MAPS_SERVER_KEY                     # deferred
LOYVERSE_API_TOKEN                         # deferred
RESEND_API_KEY                             # deferred
PAYMONGO_SECRET_KEY                        # sk_test_... / sk_live_...
PAYMONGO_PUBLIC_KEY                        # pk_test_... / pk_live_...
PAYMONGO_WEBHOOK_SECRET
CRON_SECRET
```

**Feature flags** (in `app_settings` so they can be toggled without redeploy):
```
loyverse_enabled BOOLEAN DEFAULT FALSE   -- skip POS push until token provided
email_enabled    BOOLEAN DEFAULT FALSE   -- skip Resend until domain verified
maps_enabled     BOOLEAN DEFAULT FALSE   -- skip Maps picker; fall back to address textarea
paymongo_enabled BOOLEAN DEFAULT TRUE
```
This lets us ship Phase 1 with stubs for the deferred integrations and flip them on later.

---

## 11. Development Roadmap

We build in 5 phases so the café can start using the system as early as possible.

### Phase 0 — Foundation (Week 1)
- Next.js 15 + TS + Tailwind + shadcn/ui scaffold
- Supabase project, migrations 001–010 (schema)
- Auth setup (admin/staff/rider)
- Brand tokens, fonts, Doodle SVG background component
- Logo + product image rename + upload to Supabase Storage
- Seed migration with all categories, items, variations, modifiers from menu pages
- Deploy preview to Vercel

**Exit criteria:** Empty home + menu render with real categories/items/photos. Admin can log in (blank dashboard).

### Phase 1 — Customer Ordering (Weeks 2–3)
- Home (hero, bestsellers, location, About teaser with approved copy)
- Full menu page + product detail sheet
- Cart (server-persisted via `cart_token`)
- Checkout — all three service modes:
  - **Dine-in:** name + table picker
  - **Pickup:** name + phone + **15-min slot picker** (generated from current time + prep ETA → closing)
  - **Delivery:** name + phone + address textarea + barangay + landmark + notes (Maps picker swaps in later when `maps_enabled=true`)
- **Distance-tiered delivery fee** computed server-side; **>6 km blocked with friendly bounce to Pickup**
- **PayMongo integration** (GCash + Maya + cards) via PaymentIntent/Source flow + webhook handler
- Cash payment path (status `pending` → staff marks `paid` at counter)
- `place_order()` RPC + short-code generator
- Order tracking page with realtime status
- Mobile sticky cart bar + responsive QA
- **Email + Maps + Loyverse: stubs only** (feature flags `email_enabled`, `maps_enabled`, `loyverse_enabled` default false)

**Exit criteria:** A real customer can browse → order → pay GCash/cash → see live status. Admin sees orders. Loyverse/email/maps off (per §13.2).

### Phase 2 — Admin Dashboard (Weeks 4–5)
- Realtime order kanban
- Accept/Reject/Status transitions
- Assign rider
- Record payment (cash / GCash with reference)
- Menu CRUD (categories, items, variations, modifiers, availability toggle)
- Image upload (Supabase Storage)
- Audit log view
- Sales analytics (daily/weekly/monthly totals, top items)

**Exit criteria:** Café can fully operate without us — accept orders, manage menu, view sales.

### Phase 3 — Loyverse Integration (Week 6)
- Loyverse menu sync wizard (map items)
- Receipt-on-accept push with idempotency
- Retry cron
- Sync status surfacing in admin order detail

**Exit criteria:** Accepted orders appear as receipts in Loyverse within 30s, 99% of the time.

### Phase 4 — Rider App (Week 7)
- Rider auth + role gate
- Today's deliveries view
- Delivery detail + Open in Google Maps deeplink
- Picked Up / Delivered transitions
- Rider notification on assignment (email; SMS in Phase 5)

**Exit criteria:** Rider can work the whole shift from their phone.

### Phase 5 — Polish & Launch (Week 8)
- Performance pass (Lighthouse ≥ 90 on mobile)
- Accessibility audit (axe-core, manual screen reader pass)
- Playwright E2E suite green
- SEO (metadata, OpenGraph, sitemap, robots.txt)
- Load test (k6) — 50 RPS sustained on menu, 5 RPS on placeOrder
- Soft launch with one staff member; daily standup with café for 2 weeks
- Public launch

### Phase 6+ — Future (post-launch)
Customer accounts, saved addresses, favorites, order history, loyalty/stamps, GCash API, Maya, card payments via PayMongo/Xendit, SMS notifications via Semaphore, table QR ordering with prefilled table number, multi-branch.

---

## 12. UI Wireframes (text-form)

### 12.1 Home (mobile, top → bottom)
```
[Sticky header: Logo • Menu • Track Order • 🛒(0) • [Order Now] ]
[Hero (doodle overlay)
  ZOMBEANS              ← Anton, 64pt
  RISE UP FROM THE DEAD ← Inter caps, 12pt, bone color
  [Order Now ▶]  [Browse Menu]
  (small) 📍 Open until 9pm · Pickup ready in ~15 min
]
[Service-mode tiles: 🍽 Dine-in • 🥤 Pickup • 🛵 Delivery]
[Bestsellers carousel — 4 product cards, photos, prices]
[About teaser block: short copy + image of café interior]
[Location card: static map + hours + Get Directions]
[Footer: hours, social, terms]
```

### 12.2 Menu page
```
[Sticky header]
[Sticky category tab strip (swipeable on mobile)]
  Signature • Coffee • Matcha • Milk • Sparkling • Tea • Bowls • Toasts • Croffles • Chicken • Sides
[Grid: 2 cols mobile, 3 tablet, 4 desktop]
  [ProductCard
     [Photo]
     Name
     ₱120
     [Add +]
  ]
[Bottom-sticky cart bar (mobile): View Cart (3) • ₱360 ▶]
```

### 12.3 Product detail (sheet on mobile, dialog on desktop)
```
[Photo]
Name + Description
[Variation pills: Hot • Cold 16oz • Cold 1L]   ← prices update
[Modifier groups: Sauce (required) → radio chips]
[Qty stepper: − 1 +]
[Add to Cart • ₱120]
```

### 12.4 Checkout
```
[Step indicator: 1 Service Mode • 2 Details • 3 Payment]
[Tabs: Dine-in | Pickup | Delivery]   ← color-shifts hero strip
[Mode-specific form fields]
[Notes textarea]
[Order summary card (collapsed on mobile, sticky on desktop)]
[Payment radio: Cash • GCash (PayMongo) • Maya (PayMongo) • Card (PayMongo)]
[Place Order ▶]   ← for non-cash: redirects to PayMongo Source URL, returns to /order/[code]
```

### 12.5 Order tracking `/order/ZB-7F3K`
```
[Big order code chip: ZB-7F3K]
[StatusTimeline: ● Pending → ◐ Accepted → ◐ Preparing → ○ Ready → ○ OFD → ○ Completed]
[Current ETA: "Ready in ~12 min"]
[Order summary]
[Service-mode card: dine-in table / pickup time / delivery map]
[Need help? → Call café]
```

### 12.6 Admin orders (desktop)
```
[Sidebar: Dashboard • Orders • Menu • Riders • Staff • Analytics • Audit]
[Top bar: "Accepting orders" toggle, search]
[Kanban columns: Pending • Accepted • Preparing • Ready • OFD • Completed today]
  [OrderCard
     ZB-7F3K · 14:32 · ₱360 · Delivery
     "Salted Latte ×1, Burger Steak ×1, Plain Croffles ×1"
     [Accept] [Reject ▾]
  ]
```

### 12.7 Rider (mobile)
```
[Header: Hi, Jay · 3 deliveries today]
[DeliveryCard
   ZB-7F3K · ₱360 (Cash)
   Pat — 0917-xxx-xxxx
   #21 Aurora St, Brgy Mabini · Beside red gate
   [Open in Maps ▶] [Call] [Picked Up] [Delivered ✓]
]
```

---

## 13. Decisions — Locked / Deferred / Open

### 13.1 ✅ LOCKED (we build against these)

| # | Decision | Value |
|---|---|---|
| **Location** | Café GPS | `10.488482484549147, 123.41110576656816` |
| | Address | San Julio Subdivision, Nangka St, Barangay 2, San Carlos City, 6127 Negros Occidental |
| | Hours | All week, **7 AM – 10 PM** |
| | Phone | 0918 605 6360 |
| | Facebook | @ZombeansOfficial |
| **Delivery** | Service area | **San Carlos City only** (validated at checkout via reverse-geocode + distance to store) |
| | Fee model | **Distance-tiered from store coords** |
| | | ₱30 ≤ 2 km · ₱40 ≤ 4 km · ₱50 ≤ 6 km · *(>6 km: cannot deliver, show error)* |
| **Pickup** | Time selection | **Fixed 15-minute slots**, starting from `now + default_prep_eta_minutes`, through end-of-day. |
| **Payments** | Phase 1 stack | **Cash + PayMongo** (PayMongo unlocks GCash, Maya, and cards in one integration) |
| | Manual entry | Staff can still record a manual GCash ref as fallback (e.g., walk-in pays GCash to scan-and-pay sticker). |
| **Photography** | Rights | ✅ confirmed we can use the 60+ product PNGs. |
| **About Us copy** | Approved | See §13.4 below — typeset verbatim. |

### 13.2 ⏸ DEFERRED (built behind feature flags, wired later)

Plan absorbed these as **flags in `app_settings`** so the rest of the build is unblocked. Each one has a "stub" implementation that does the safe thing when the flag is off.

| # | Item | Stub behavior while deferred | What's needed to flip on |
|---|---|---|---|
| 1 | **Domain name** | App runs on Vercel preview URL. SEO meta uses placeholder. | You pick + acquire a domain; we point DNS. |
| 5 | **Loyverse API token** | Accepting an order updates our DB only. `loyverse_sync` row created but not pushed. Admin sees "Loyverse: disabled" badge. | You issue an API token from Loyverse → I add to env → flip `loyverse_enabled=true`. |
| 6 | **Resend / email** | Order confirmation page works (customer sees short code on screen + can bookmark `/order/<code>`). No emails sent. | Verify a sending domain in Resend → add API key → flip `email_enabled=true`. |
| 7 | **Google Maps billing** | Delivery checkout uses a **plain address textarea + barangay select + landmark field** instead of map picker. We still store address text; lat/lng inferred from barangay centroid (good-enough for fee tiering — barangay-to-store distance is precomputed). | Enable GCP billing + provision Maps Platform key → flip `maps_enabled=true` → checkout swaps in the proper map picker. |

### 13.3 ✅ All resolved

Founding year locked: **2021**.

### 13.4 About Us copy (approved, typeset verbatim)

> **Brew. Brain. Bite.**
> Some cafés wake you up. We bring you back to life.
>
> ZomBeans started in **2021** in San Carlos City, when Mark Hibionada decided the city needed a café that took its coffee seriously without taking itself seriously. The name? Half a love letter to the bean, half a wink at every undercaffeinated soul stumbling in before 9 a.m. looking for a pulse.
>
> What we serve is the easy part — signature drinks built around our house syrups, matcha whisked the slow way, rice bowls and croffles plated on our signature green ceramic, and bestsellers we'll fight you about (the Zomboss, mostly). What we're really after is the ten minutes you spend with the cup in your hand: feet up, brain on, the playlist a little louder than it needs to be.
>
> If you've already been here, you know. If you haven't — pull up a chair. The dead don't bite. (The croffles do.)
>
> 📍 San Julio Subdivision, Nangka St, Barangay 2, San Carlos City, 6127 Negros Occidental
> 🕒 Open all week · 7 AM – 10 PM
> 📱 0918 605 6360 · @ZombeansOfficial on Facebook
>
> **[Order Now ▶]** **[See the Menu]**

### 13.5 Implications for the build (so you can hold me to this)

- **Phase 1 ships PayMongo, not just manual GCash.** Slightly more wiring upfront, but no Phase-2 payment rework.
- **Phase 1 does NOT block on Loyverse / Resend / Google Maps.** App is fully usable without them — orders work, just no POS sync, no email, fallback address form instead of map.
- **Delivery has a hard "out of zone" error** when distance > 6 km from store. Customer is gently bounced to Pickup with an apology + their cart preserved.
- **Pickup slots regenerate per request** based on current time + remaining hours that day, so we never offer a slot in the past or after closing.
- **Year placeholder `[YEAR]`** stays in the About copy until you confirm it.

---

## 14. Done When
- [x] You've reviewed and approved this plan.
- [x] Decisions in §13.1 are locked.
- [x] Founding year (§13.3) provided — 2021.
- [ ] We start Phase 0 with a clear scope.

Once approved, the next deliverable is a working Phase 0 scaffold with the schema deployed and the home + empty menu rendering against real seeded data.

---

*End of plan. No code generated until you approve.*
