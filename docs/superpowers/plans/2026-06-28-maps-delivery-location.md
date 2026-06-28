# Google Maps Delivery Location Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manual delivery distance-tier picker in checkout with a Google Maps address picker that captures real coordinates, and compute the delivery fee + zone authoritatively on the server from those coordinates.

**Architecture:** A Postgres `delivery_quote(lat,lng)` function (haversine, reads `app_settings`) is the authoritative fee/zone source, called by both `place_order` (the charge) and a `quoteDelivery` server action (the live UI readout). A new `DeliveryMapPicker` client component (Places Autocomplete + draggable map pin) feeds coordinates to the action and to placement. A pure `lib/delivery.ts` mirrors the math for unit tests and an instant optimistic UI estimate. The map UI is gated by `app_settings.maps_enabled`; the existing manual tier picker stays as the off-state fallback.

**Tech Stack:** Next.js 16 (App Router/RSC), React 19, TypeScript strict, Supabase/Postgres, Google Maps JavaScript API + Places API (New), Tailwind v4, Zod v4, Vitest.

## Global Constraints

- Customized Next.js — consult `node_modules/next/dist/docs/` before using framework APIs (per `AGENTS.md`).
- Path alias `@/*` → repo root.
- Pure, unit-tested modules (`lib/delivery.ts`) must NOT import `"server-only"`/Supabase/React.
- Migrations are append-only numbered SQL in `supabase/migrations/`, applied manually (feature inert until applied).
- Money is integer centavos (`*_cents` BIGINT). Distances in km.
- Delivery fee tiers live in `app_settings.delivery_fee_tiers` JSONB `[{"max_km":2,"fee_cents":3000},{"max_km":4,"fee_cents":4000},{"max_km":6,"fee_cents":5000}]`; cutoff `delivery_max_km` (6); store coords `store_lat`/`store_lng`. Tier codes are `tier-<max_km>` (`tier-2`/`tier-4`/`tier-6`).
- Delivery requires a signed-in customer (enforced in `place_order`; keep).
- Server actions return `{ ok: false; error } | { ok: true; ... }`.
- Env: `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` (browser, referrer-restricted), `GOOGLE_MAPS_SERVER_KEY` (server, Geocoding) — both already in `.env.local`.
- Theme tokens only: `zb-primary`, `zb-primary-strong`, `zb-primary-dark`, `zb-cream`, `zb-bone`, `zb-bone-soft`, `zb-sage`, `zb-danger`.

**Out of scope (follow-up):** persisting `lat/lng/google_place_id` on **saved** addresses (`customer_addresses`) and re-pinning them on the account page. Saved addresses keep working via their stored `tier`; only the checkout *new-address* flow gets the map. Static map on the tracking page; driving distance.

---

### Task 1: `delivery_quote` — authoritative fee/zone (SQL + TS mirror + tests)

**Files:**
- Create: `lib/delivery.ts`
- Create: `tests/unit/delivery-quote.test.ts`
- Create: `supabase/migrations/0047_maps_delivery.sql`

**Interfaces:**
- Produces (TS, pure):
  - `type DeliveryTier = { maxKm: number; feeCents: number }`
  - `type DeliveryQuote = { inZone: true; distanceKm: number; tier: string; feeCents: number } | { inZone: false; distanceKm: number; tier: null; feeCents: null }`
  - `function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number`
  - `function resolveDeliveryQuote(distanceKm: number, tiers: DeliveryTier[], maxKm: number): DeliveryQuote`
- Produces (SQL): `delivery_quote(p_lat numeric, p_lng numeric) returns table(in_zone boolean, distance_km numeric, tier text, fee_cents bigint)`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/delivery-quote.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  haversineKm,
  resolveDeliveryQuote,
  type DeliveryTier,
} from "@/lib/delivery";

const tiers: DeliveryTier[] = [
  { maxKm: 2, feeCents: 3000 },
  { maxKm: 4, feeCents: 4000 },
  { maxKm: 6, feeCents: 5000 },
];

describe("haversineKm", () => {
  it("is zero for the same point", () => {
    expect(haversineKm(10.5, 123.4, 10.5, 123.4)).toBe(0);
  });
  it("is about 111 km for one degree of latitude", () => {
    expect(haversineKm(10, 123, 11, 123)).toBeGreaterThan(110);
    expect(haversineKm(10, 123, 11, 123)).toBeLessThan(112);
  });
});

describe("resolveDeliveryQuote", () => {
  it("picks the first tier at and below its cap", () => {
    expect(resolveDeliveryQuote(0, tiers, 6)).toMatchObject({ inZone: true, tier: "tier-2", feeCents: 3000 });
    expect(resolveDeliveryQuote(2, tiers, 6)).toMatchObject({ tier: "tier-2", feeCents: 3000 });
    expect(resolveDeliveryQuote(2.01, tiers, 6)).toMatchObject({ tier: "tier-4", feeCents: 4000 });
    expect(resolveDeliveryQuote(4, tiers, 6)).toMatchObject({ tier: "tier-4", feeCents: 4000 });
    expect(resolveDeliveryQuote(5.9, tiers, 6)).toMatchObject({ tier: "tier-6", feeCents: 5000 });
    expect(resolveDeliveryQuote(6, tiers, 6)).toMatchObject({ tier: "tier-6", feeCents: 5000 });
  });
  it("is out of zone past the cutoff", () => {
    expect(resolveDeliveryQuote(6.01, tiers, 6)).toEqual({
      inZone: false,
      distanceKm: 6.01,
      tier: null,
      feeCents: null,
    });
  });
});
```

- [ ] **Step 2: Run the test (RED)**

Run: `npm test -- delivery-quote`
Expected: FAIL — `@/lib/delivery` not found.

- [ ] **Step 3: Implement `lib/delivery.ts`**

```ts
// Pure delivery distance + fee-tier math. Mirrors the SQL `delivery_quote`
// function (migration 0047): both read the same tier config from app_settings,
// so the only duplicated logic is this stable haversine + tier walk. Used by
// DeliveryMapPicker for an instant optimistic estimate; the server (RPC /
// place_order) stays authoritative for the charged fee.

export type DeliveryTier = { maxKm: number; feeCents: number };

export type DeliveryQuote =
  | { inZone: true; distanceKm: number; tier: string; feeCents: number }
  | { inZone: false; distanceKm: number; tier: null; feeCents: null };

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function resolveDeliveryQuote(
  distanceKm: number,
  tiers: DeliveryTier[],
  maxKm: number
): DeliveryQuote {
  const rounded = Math.round(distanceKm * 100) / 100;
  if (rounded > maxKm) {
    return { inZone: false, distanceKm: rounded, tier: null, feeCents: null };
  }
  const sorted = [...tiers].sort((a, b) => a.maxKm - b.maxKm);
  const match = sorted.find((t) => rounded <= t.maxKm);
  if (!match) {
    return { inZone: false, distanceKm: rounded, tier: null, feeCents: null };
  }
  return {
    inZone: true,
    distanceKm: rounded,
    tier: `tier-${match.maxKm}`,
    feeCents: match.feeCents,
  };
}
```

- [ ] **Step 4: Run the test (GREEN)**

Run: `npm test -- delivery-quote`
Expected: PASS (4 tests).

- [ ] **Step 5: Create migration 0047 with the SQL `delivery_quote`**

Create `supabase/migrations/0047_maps_delivery.sql`:

```sql
-- Maps-powered delivery: an authoritative server-side delivery quote computed
-- from coordinates (haversine), used by both place_order and the live checkout
-- quote. Task 2 appends the place_order redefinition to this same file.

create or replace function delivery_quote(p_lat numeric, p_lng numeric)
returns table(in_zone boolean, distance_km numeric, tier text, fee_cents bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_settings app_settings%rowtype;
  v_dist numeric;
  v_max_km numeric;
  v_fee bigint;
begin
  select * into v_settings from app_settings where id = 1;

  -- Haversine distance (km) store -> point.
  v_dist := 2 * 6371 * asin(sqrt(
    power(sin(radians(p_lat - v_settings.store_lat) / 2), 2) +
    cos(radians(v_settings.store_lat)) * cos(radians(p_lat)) *
    power(sin(radians(p_lng - v_settings.store_lng) / 2), 2)
  ));
  v_dist := round(v_dist, 2);

  if v_dist > v_settings.delivery_max_km then
    return query select false, v_dist, null::text, null::bigint;
    return;
  end if;

  -- First tier whose max_km is at or above the distance.
  select (t->>'max_km')::numeric, (t->>'fee_cents')::bigint
    into v_max_km, v_fee
  from jsonb_array_elements(v_settings.delivery_fee_tiers) as t
  where (t->>'max_km')::numeric >= v_dist
  order by (t->>'max_km')::numeric asc
  limit 1;

  if v_max_km is null then
    return query select false, v_dist, null::text, null::bigint;
    return;
  end if;

  return query
    select true, v_dist, 'tier-' || (v_max_km)::int::text, v_fee;
end;
$$;

grant execute on function delivery_quote(numeric, numeric) to anon, authenticated;
```

- [ ] **Step 6: Review the SQL against `delivery_quote` parity with TS**

Run: `cat supabase/migrations/0047_maps_delivery.sql`
Expected: confirm tiers come from `app_settings.delivery_fee_tiers`, cutoff from `delivery_max_km`, tier code is `tier-<max_km>` (matches `lib/delivery.ts` and existing `tier-2/4/6`), and the grant is present.

- [ ] **Step 7: Commit**

```bash
git add lib/delivery.ts tests/unit/delivery-quote.test.ts supabase/migrations/0047_maps_delivery.sql
git commit -m "feat: authoritative delivery_quote (haversine) in SQL + TS mirror with tests"
```

---

### Task 2: `place_order` computes delivery fee from coordinates

**Files:**
- Modify: `supabase/migrations/0047_maps_delivery.sql` (append the `place_order` redefinition)

**Interfaces:**
- Consumes: `delivery_quote(numeric, numeric)` (Task 1).
- Produces: `place_order(p_payload jsonb)` — delivery branch now reads `delivery.lat`/`delivery.lng`, derives fee + zone from `delivery_quote`, raises `OUT_OF_ZONE` when out of range, ignores any client `tier`, and stores `lat`/`lng`/`google_place_id` in `delivery_addresses`.

No unit test (SQL + Supabase); verified by review + manual round-trip in Final Verification.

- [ ] **Step 1: Append the new `place_order` to migration 0047**

Append the following to `supabase/migrations/0047_maps_delivery.sql`. This is the full function from migration 0046 with ONLY the delivery branch and the `delivery_addresses` insert changed (changes marked with `-- MAPS:`):

```sql
-- Recompute delivery fee + zone from coordinates via delivery_quote(), instead
-- of trusting a client-supplied tier. Everything else matches migration 0046.
create or replace function place_order(p_payload jsonb)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_settings app_settings%rowtype;
  v_short_code text;
  v_order_id uuid;
  v_order_item_id uuid;
  v_subtotal bigint := 0;
  v_delivery_fee bigint := 0;
  v_total bigint;
  v_service_mode service_mode;
  v_payment_method payment_method;
  v_pickup_time timestamptz;
  v_attempts int := 0;
  v_lines jsonb;
  v_line jsonb;
  v_delivery jsonb;
  v_qty int;
  v_var record;
  v_group record;
  v_option record;
  v_option_id uuid;
  v_option_ids uuid[];
  v_options jsonb;
  v_option_quantities jsonb;
  v_option_qty int;
  v_option_entry_count int;
  v_option_delta bigint;
  v_selected_count int;
  v_user_id uuid := auth.uid();
  v_dlat numeric;          -- MAPS: delivery coordinates
  v_dlng numeric;          -- MAPS
  v_in_zone boolean;       -- MAPS
begin
  perform refresh_expired_menu_item_availability();

  select * into v_settings from app_settings where id = 1;
  if not v_settings.accepting_orders then
    raise exception 'NOT_ACCEPTING' using errcode = 'P0001';
  end if;

  v_service_mode := (p_payload->>'service_mode')::service_mode;
  v_payment_method :=
    coalesce((p_payload->>'payment_method')::payment_method, 'cash');

  if v_service_mode = 'delivery' and v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  if coalesce(p_payload->>'customer_name', '') = '' then
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
    -- MAPS: derive fee + zone from coordinates, not a client tier.
    v_dlat := (v_delivery->>'lat')::numeric;
    v_dlng := (v_delivery->>'lng')::numeric;
    if v_dlat is null or v_dlng is null then
      raise exception 'MISSING_DELIVERY_LOCATION' using errcode = 'P0001';
    end if;
    select q.in_zone, q.fee_cents
      into v_in_zone, v_delivery_fee
      from delivery_quote(v_dlat, v_dlng) q;
    if not v_in_zone then
      raise exception 'OUT_OF_ZONE' using errcode = 'P0001';
    end if;
  end if;

  if v_service_mode <> 'dine_in'
    and coalesce(p_payload->>'customer_phone', '') = ''
  then
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
    notes, user_id
  ) values (
    v_short_code, 'pending', v_service_mode,
    p_payload->>'customer_name',
    nullif(p_payload->>'customer_phone', ''),
    nullif(p_payload->>'customer_email', ''),
    null, v_pickup_time,
    0, v_delivery_fee, 0,
    nullif(p_payload->>'notes', ''), v_user_id
  ) returning id into v_order_id;

  for v_line in select * from jsonb_array_elements(v_lines) loop
    select
      iv.id as variation_id,
      iv.label as variation_label,
      iv.price_cents as price_cents,
      iv.item_id as item_id,
      iv.is_active as variation_active,
      mi.name as item_name,
      mi.is_active as item_active
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

    v_option_quantities := '{}'::jsonb;

    if v_line ? 'options' then
      v_options := coalesce(v_line->'options', '[]'::jsonb);
      if jsonb_typeof(v_options) <> 'array' then
        raise exception 'INVALID_OPTIONS' using errcode = 'P0001';
      end if;

      select
        count(*),
        coalesce(
          array_agg(option_id) filter (where option_id is not null),
          '{}'::uuid[]
        ),
        coalesce(
          jsonb_object_agg(option_id::text, option_qty)
            filter (where option_id is not null),
          '{}'::jsonb
        )
      into v_option_entry_count, v_option_ids, v_option_quantities
      from (
        select
          (entry->>'option_id')::uuid as option_id,
          coalesce((entry->>'qty')::int, (entry->>'quantity')::int, 1) as option_qty
        from jsonb_array_elements(v_options) as parsed(entry)
      ) parsed_options;

      if v_option_entry_count <> cardinality(v_option_ids) then
        raise exception 'INVALID_OPTIONS' using errcode = 'P0001';
      end if;

      if exists (
        select 1
        from jsonb_array_elements(v_options) as parsed(entry)
        where coalesce((entry->>'qty')::int, (entry->>'quantity')::int, 1) <= 0
           or coalesce((entry->>'qty')::int, (entry->>'quantity')::int, 1) > 50
      ) then
        raise exception 'INVALID_OPTION_QTY' using errcode = 'P0001';
      end if;
    else
      if jsonb_typeof(coalesce(v_line->'option_ids', '[]'::jsonb)) <> 'array' then
        raise exception 'INVALID_OPTIONS' using errcode = 'P0001';
      end if;

      select coalesce(array_agg(value::uuid), '{}'::uuid[])
      into v_option_ids
      from jsonb_array_elements_text(
        coalesce(v_line->'option_ids', '[]'::jsonb)
      );

      foreach v_option_id in array v_option_ids loop
        v_option_quantities :=
          v_option_quantities || jsonb_build_object(v_option_id::text, 1);
      end loop;
    end if;

    if cardinality(v_option_ids) <> (
      select count(distinct option_id)
      from unnest(v_option_ids) as selected(option_id)
    ) then
      raise exception 'DUPLICATE_OPTION' using errcode = 'P0001';
    end if;

    for v_group in
      select link.group_id, link.min_select, link.max_select, group_row.name
      from menu_item_option_groups link
      join menu_option_groups group_row on group_row.id = link.group_id
      where link.item_id = v_var.item_id
        and group_row.is_active
    loop
      select count(*)
      into v_selected_count
      from menu_options option_row
      where option_row.group_id = v_group.group_id
        and option_row.id = any(v_option_ids);

      if v_selected_count < v_group.min_select
        or v_selected_count > v_group.max_select
      then
        raise exception 'INVALID_OPTION_COUNT:%', v_group.name
          using errcode = 'P0001';
      end if;
    end loop;

    v_option_delta := 0;
    foreach v_option_id in array v_option_ids loop
      select
        option_row.id,
        option_row.name,
        option_row.price_delta_cents,
        group_row.name as group_name
      into v_option
      from menu_options option_row
      join menu_option_groups group_row
        on group_row.id = option_row.group_id
      join menu_item_option_groups link
        on link.group_id = group_row.id
       and link.item_id = v_var.item_id
      where option_row.id = v_option_id
        and option_row.is_active
        and group_row.is_active;

      if not found then
        raise exception 'INVALID_OPTION:%', v_option_id using errcode = 'P0001';
      end if;

      v_option_qty := coalesce((v_option_quantities->>(v_option_id::text))::int, 1);
      v_option_delta := v_option_delta + v_option.price_delta_cents * v_option_qty;
    end loop;

    insert into order_items (
      order_id, item_id, variation_id,
      item_name_snapshot, variation_label_snapshot,
      unit_price_cents, qty, line_total_cents
    ) values (
      v_order_id, v_var.item_id, v_var.variation_id,
      v_var.item_name, v_var.variation_label,
      v_var.price_cents + v_option_delta,
      v_qty,
      (v_var.price_cents + v_option_delta) * v_qty
    ) returning id into v_order_item_id;

    foreach v_option_id in array v_option_ids loop
      select
        option_row.id,
        option_row.name,
        option_row.price_delta_cents,
        group_row.name as group_name
      into v_option
      from menu_options option_row
      join menu_option_groups group_row
        on group_row.id = option_row.group_id
      where option_row.id = v_option_id;

      v_option_qty := coalesce((v_option_quantities->>(v_option_id::text))::int, 1);

      insert into order_item_options (
        order_item_id,
        option_id,
        group_name_snapshot,
        name_snapshot,
        price_delta_cents,
        quantity
      ) values (
        v_order_item_id,
        v_option.id,
        v_option.group_name,
        v_option.name,
        v_option.price_delta_cents,
        v_option_qty
      );
    end loop;

    v_subtotal :=
      v_subtotal + (v_var.price_cents + v_option_delta) * v_qty;
  end loop;

  if v_service_mode = 'delivery' then
    insert into delivery_addresses (
      order_id, street, barangay, city, landmark, delivery_notes,
      lat, lng, google_place_id                       -- MAPS: real coords + place id
    ) values (
      v_order_id,
      coalesce(v_delivery->>'street', ''),
      v_delivery->>'barangay',
      coalesce(v_delivery->>'city', 'San Carlos City'),
      v_delivery->>'landmark',
      v_delivery->>'delivery_notes',
      v_dlat,                                          -- MAPS
      v_dlng,                                          -- MAPS
      nullif(v_delivery->>'google_place_id', '')       -- MAPS
    );
  end if;

  v_total := v_subtotal + v_delivery_fee;
  update orders
  set subtotal_cents = v_subtotal,
      total_cents = v_total
  where id = v_order_id;

  insert into payments (order_id, method, status, amount_cents)
  values (v_order_id, v_payment_method, 'pending', v_total);

  insert into order_status_events (order_id, from_status, to_status)
  values (v_order_id, null, 'pending');

  return jsonb_build_object(
    'short_code', v_short_code,
    'order_id', v_order_id,
    'subtotal_cents', v_subtotal,
    'delivery_fee_cents', v_delivery_fee,
    'total_cents', v_total
  );
end;
$$;

grant execute on function place_order(jsonb) to anon, authenticated;
```

- [ ] **Step 2: Review the diff against 0046**

Run: `git diff --no-index supabase/migrations/0046_option_quantities.sql supabase/migrations/0047_maps_delivery.sql || true`
Expected: the only `place_order` differences are the removed `v_tier` declaration/usage, the new `v_dlat`/`v_dlng`/`v_in_zone` handling + `delivery_quote` call + `OUT_OF_ZONE`, and the `delivery_addresses` insert now using real coords + `google_place_id`. (The added `delivery_quote` function at the top is expected.)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0047_maps_delivery.sql
git commit -m "feat(db): place_order derives delivery fee + zone from coordinates"
```

---

### Task 3: `quoteDelivery` action + delivery payload carries coordinates

**Files:**
- Modify: `app/actions/checkout.ts`

**Interfaces:**
- Consumes: `delivery_quote` RPC (Task 1); `createClient` from `@/lib/supabase/server` (already imported).
- Produces:
  - `type DeliveryQuoteResult = { ok: true; inZone: boolean; distanceKm: number; tier: string | null; feeCents: number | null } | { ok: false; error: string }`
  - `async function quoteDelivery(input: { lat: number; lng: number }): Promise<DeliveryQuoteResult>`
  - Extended `PlaceOrderInput["delivery"]` with `lat?: number; lng?: number; googlePlaceId?: string` (and `tier` made optional — ignored server-side now).

No unit test (server action); verified by `npm run build` + `npm run lint` and Final Verification.

- [ ] **Step 1: Extend `PlaceOrderInput.delivery`**

In `app/actions/checkout.ts`, replace the `delivery?: {...}` block in `PlaceOrderInput` (currently lines ~17-24) with:

```ts
  delivery?: {
    street: string;
    barangay?: string;
    city?: string;
    landmark?: string;
    deliveryNotes?: string;
    lat?: number;
    lng?: number;
    googlePlaceId?: string;
    // Legacy manual-picker tier; ignored by place_order (kept for the
    // maps_enabled=false fallback path).
    tier?: "tier-2" | "tier-4" | "tier-6";
  };
```

- [ ] **Step 2: Send coordinates in the place_order payload**

In the same file, in the `payload` object's `delivery` builder (currently lines ~95-104), replace the delivery object with:

```ts
    delivery:
      input.serviceMode === "delivery" && input.delivery
        ? {
            street: input.delivery.street,
            barangay: input.delivery.barangay,
            city: input.delivery.city ?? "San Carlos City",
            landmark: input.delivery.landmark,
            delivery_notes: input.delivery.deliveryNotes,
            lat: input.delivery.lat,
            lng: input.delivery.lng,
            google_place_id: input.delivery.googlePlaceId,
            tier: input.delivery.tier,
          }
        : null,
```

- [ ] **Step 3: Map the `OUT_OF_ZONE` / `MISSING_DELIVERY_LOCATION` errors**

Find the error-message map in `placeOrder` (the object containing `AUTH_REQUIRED: "Please sign in to place a delivery order."`). Add these two entries to that map:

```ts
      OUT_OF_ZONE:
        "That address is outside our 6 km delivery zone. Please switch to pickup — your cart is saved.",
      MISSING_DELIVERY_LOCATION:
        "Please pick your delivery location on the map so we can confirm the fee.",
```

- [ ] **Step 4: Add the `quoteDelivery` server action**

Append to `app/actions/checkout.ts` (after `placeOrder`):

```ts
export type DeliveryQuoteResult =
  | {
      ok: true;
      inZone: boolean;
      distanceKm: number;
      tier: string | null;
      feeCents: number | null;
    }
  | { ok: false; error: string };

export async function quoteDelivery(input: {
  lat: number;
  lng: number;
}): Promise<DeliveryQuoteResult> {
  if (
    typeof input.lat !== "number" ||
    typeof input.lng !== "number" ||
    Number.isNaN(input.lat) ||
    Number.isNaN(input.lng)
  ) {
    return { ok: false, error: "Invalid location." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delivery_quote", {
    p_lat: input.lat,
    p_lng: input.lng,
  });
  if (error || !data || !data[0]) {
    return { ok: false, error: "Could not calculate the delivery fee." };
  }
  const row = data[0] as {
    in_zone: boolean;
    distance_km: number;
    tier: string | null;
    fee_cents: number | null;
  };
  return {
    ok: true,
    inZone: row.in_zone,
    distanceKm: Number(row.distance_km),
    tier: row.tier,
    feeCents: row.fee_cents === null ? null : Number(row.fee_cents),
  };
}
```

- [ ] **Step 5: Lint + build**

Run: `npm run lint`
Expected: no errors in `app/actions/checkout.ts`.
Run: `npm run build`
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add app/actions/checkout.ts
git commit -m "feat: quoteDelivery action and coordinate-carrying delivery payload"
```

---

### Task 4: Google Maps loader + `DeliveryMapPicker` component

**Files:**
- Modify: `package.json` (add `@googlemaps/js-api-loader`)
- Create: `components/shop/DeliveryMapPicker.tsx`

**Interfaces:**
- Consumes: `quoteDelivery` (Task 3); `haversineKm`, `resolveDeliveryQuote`, `DeliveryTier` (Task 1); `formatPeso` from `@/lib/peso`.
- Produces:
  - `type DeliveryDetails = { lat: number; lng: number; googlePlaceId: string | null; street: string; barangay: string | null; city: string; tier: string; feeCents: number; distanceKm: number }`
  - `function DeliveryMapPicker(props: { apiKey: string; storeLat: number; storeLng: number; tiers: DeliveryTier[]; maxKm: number; onChange: (details: DeliveryDetails | null) => void }): JSX.Element`

No unit test (browser/Maps UI); verified by `npm run lint` + `npm run build` + manual checklist.

- [ ] **Step 1: Read the Next.js client-component + script guidance**

Run: `ls node_modules/next/dist/docs/ && sed -n '1,60p' node_modules/next/dist/docs/*client*components* 2>/dev/null | head -60`
Expected: confirm client components use `"use client"` and that third-party browser SDKs load inside `useEffect` (not via RSC). We load the Maps SDK with `@googlemaps/js-api-loader` inside an effect; do NOT use `next/script` for the SDK (the loader dedupes and gives a promise).

- [ ] **Step 2: Add the loader dependency**

Run: `npm install @googlemaps/js-api-loader@^1`
Then: `npm install --save-dev @types/google.maps@^3`
Expected: both install cleanly; `package.json` + lock updated.

- [ ] **Step 3: Implement `components/shop/DeliveryMapPicker.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { MapPin } from "lucide-react";
import { quoteDelivery } from "@/app/actions/checkout";
import {
  haversineKm,
  resolveDeliveryQuote,
  type DeliveryTier,
} from "@/lib/delivery";
import { formatPeso } from "@/lib/peso";

export type DeliveryDetails = {
  lat: number;
  lng: number;
  googlePlaceId: string | null;
  street: string;
  barangay: string | null;
  city: string;
  tier: string;
  feeCents: number;
  distanceKm: number;
};

type Quote =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "in_zone"; distanceKm: number; feeCents: number }
  | { state: "out_of_zone"; distanceKm: number };

// Pull a named component out of a Geocoder/Place address_components array.
function pickComponent(
  components: google.maps.GeocoderAddressComponent[] | undefined,
  type: string
): string | null {
  return components?.find((c) => c.types.includes(type))?.long_name ?? null;
}

export function DeliveryMapPicker({
  apiKey,
  storeLat,
  storeLng,
  tiers,
  maxKm,
  onChange,
}: {
  apiKey: string;
  storeLat: number;
  storeLng: number;
  tiers: DeliveryTier[];
  maxKm: number;
  onChange: (details: DeliveryDetails | null) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [quote, setQuote] = useState<Quote>({ state: "idle" });
  // Latest resolved address parts, merged into onChange when the quote lands.
  const partsRef = useRef<{ street: string; barangay: string | null; city: string; placeId: string | null }>({
    street: "",
    barangay: null,
    city: "San Carlos City",
    placeId: null,
  });

  // Load the Maps SDK once and build the map, marker, and autocomplete.
  useEffect(() => {
    let cancelled = false;
    const loader = new Loader({ apiKey, libraries: ["places", "marker"] });
    loader
      .load()
      .then((google) => {
        if (cancelled || !mapRef.current || !inputRef.current) return;
        const center = { lat: storeLat, lng: storeLng };
        const map = new google.maps.Map(mapRef.current, {
          center,
          zoom: 14,
          disableDefaultUI: true,
          zoomControl: true,
        });
        const marker = new google.maps.Marker({ map, draggable: true });
        markerRef.current = marker;
        geocoderRef.current = new google.maps.Geocoder();

        const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          fields: ["geometry", "address_components", "place_id", "name"],
          componentRestrictions: { country: "ph" },
        });
        autocomplete.bindTo("bounds", map);

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          if (!place.geometry?.location) return;
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          map.setCenter({ lat, lng });
          map.setZoom(16);
          marker.setPosition({ lat, lng });
          partsRef.current = {
            street: place.name ?? "",
            barangay: pickComponent(place.address_components, "sublocality_level_1")
              ?? pickComponent(place.address_components, "neighborhood"),
            city: pickComponent(place.address_components, "locality") ?? "San Carlos City",
            placeId: place.place_id ?? null,
          };
          void runQuote(lat, lng);
        });

        marker.addListener("dragend", () => {
          const pos = marker.getPosition();
          if (!pos) return;
          void reverseGeocode(pos.lat(), pos.lng());
        });

        setReady(true);
      })
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reverseGeocode(lat: number, lng: number) {
    const geocoder = geocoderRef.current;
    if (geocoder) {
      try {
        const { results } = await geocoder.geocode({ location: { lat, lng } });
        const best = results[0];
        partsRef.current = {
          street: best?.formatted_address ?? partsRef.current.street,
          barangay:
            pickComponent(best?.address_components, "sublocality_level_1") ??
            pickComponent(best?.address_components, "neighborhood") ??
            partsRef.current.barangay,
          city:
            pickComponent(best?.address_components, "locality") ??
            partsRef.current.city,
          placeId: best?.place_id ?? null,
        };
      } catch {
        // Keep prior parts; the quote still uses coordinates.
      }
    }
    await runQuote(lat, lng);
  }

  // Authoritative quote from the server; show an instant local estimate first.
  async function runQuote(lat: number, lng: number) {
    const local = resolveDeliveryQuote(haversineKm(storeLat, storeLng, lat, lng), tiers, maxKm);
    setQuote(
      local.inZone
        ? { state: "in_zone", distanceKm: local.distanceKm, feeCents: local.feeCents }
        : { state: "out_of_zone", distanceKm: local.distanceKm }
    );
    const result = await quoteDelivery({ lat, lng });
    if (!result.ok) {
      setQuote({ state: "idle" });
      onChange(null);
      return;
    }
    if (!result.inZone || result.tier === null || result.feeCents === null) {
      setQuote({ state: "out_of_zone", distanceKm: result.distanceKm });
      onChange(null);
      return;
    }
    setQuote({ state: "in_zone", distanceKm: result.distanceKm, feeCents: result.feeCents });
    onChange({
      lat,
      lng,
      googlePlaceId: partsRef.current.placeId,
      street: partsRef.current.street,
      barangay: partsRef.current.barangay,
      city: partsRef.current.city,
      tier: result.tier,
      feeCents: result.feeCents,
      distanceKm: result.distanceKm,
    });
  }

  if (loadError) {
    return (
      <p className="rounded-xl border border-zb-danger/40 bg-zb-danger/10 p-4 text-sm text-zb-cream">
        We couldn&apos;t load the map. Please refresh, or switch to pickup.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="text"
        placeholder="Search your address or landmark"
        className="h-12 w-full rounded-xl border border-zb-sage/35 bg-zb-primary-dark/55 px-4 text-zb-cream placeholder:text-zb-cream/35 focus:border-zb-bone focus:outline-none"
      />
      <div
        ref={mapRef}
        className="h-64 w-full overflow-hidden rounded-xl border border-zb-sage/35 bg-zb-primary-dark/40"
        aria-label="Delivery location map"
      />
      <p className="text-xs text-zb-cream/50">
        {ready
          ? "Search above or drag the pin to your exact location."
          : "Loading map…"}
      </p>

      {quote.state === "in_zone" && (
        <div className="flex items-center justify-between rounded-xl border border-zb-bone/40 bg-zb-bone/10 px-4 py-3 text-sm">
          <span className="flex items-center gap-2 text-zb-cream">
            <MapPin className="size-4 text-zb-bone" />
            ≈{quote.distanceKm.toFixed(1)} km from Zombeans
          </span>
          <span className="font-mono-tabular font-bold text-zb-bone">
            {formatPeso(quote.feeCents)}
          </span>
        </div>
      )}
      {quote.state === "out_of_zone" && (
        <p className="rounded-xl border border-zb-danger/40 bg-zb-danger/10 px-4 py-3 text-sm text-zb-cream">
          That location is ≈{quote.distanceKm.toFixed(1)} km away — outside our 6 km
          delivery zone. Please switch to Pickup; your cart stays right here.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Lint + build**

Run: `npm run lint`
Expected: no errors (the single `exhaustive-deps` disable on the init effect is intentional — it runs once).
Run: `npm run build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json components/shop/DeliveryMapPicker.tsx
git commit -m "feat: DeliveryMapPicker (Places Autocomplete + draggable pin + live quote)"
```

---

### Task 5: Wire the map into checkout behind `maps_enabled`

**Files:**
- Modify: `app/(shop)/checkout/page.tsx`
- Modify: `components/shop/CheckoutForm.tsx`

**Interfaces:**
- Consumes: `DeliveryMapPicker`, `DeliveryDetails` (Task 4); `quoteDelivery`/extended `PlaceOrderInput` (Task 3).
- Produces: `CheckoutForm` gains props `mapsEnabled: boolean`, `mapsApiKey: string | null`, `storeLat: number`, `storeLng: number`, `deliveryTiers: DeliveryTier[]`, `deliveryMaxKm: number`.

No unit test (RSC/UI); verified by `npm run lint` + `npm run build` + manual checklist.

- [ ] **Step 1: Read `app_settings` maps + delivery config in the checkout page**

In `app/(shop)/checkout/page.tsx`, after `const storeAvailability = await getStoreAvailability();`, add a read of the relevant `app_settings` columns via the admin-session client (server-only; the page is already `force-dynamic`):

```tsx
  const settingsClient = await createAdminSessionClient();
  const { data: settingsRow } = await settingsClient
    .from("app_settings")
    .select("maps_enabled, store_lat, store_lng, delivery_fee_tiers, delivery_max_km")
    .eq("id", 1)
    .single();
  const deliveryTiers = ((settingsRow?.delivery_fee_tiers as
    | { max_km: number; fee_cents: number }[]
    | null) ?? []).map((t) => ({ maxKm: t.max_km, feeCents: t.fee_cents }));
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? null;
  const mapsEnabled = Boolean(settingsRow?.maps_enabled) && Boolean(mapsApiKey);
```

(`createAdminSessionClient` is already imported in this file.)

- [ ] **Step 2: Pass the new props to `<CheckoutForm>`**

In the same file, add to the `<CheckoutForm ... />` props (after `physicalLabel={...}`):

```tsx
            mapsEnabled={mapsEnabled}
            mapsApiKey={mapsApiKey}
            storeLat={Number(settingsRow?.store_lat ?? 10.4884825)}
            storeLng={Number(settingsRow?.store_lng ?? 123.4111058)}
            deliveryTiers={deliveryTiers}
            deliveryMaxKm={Number(settingsRow?.delivery_max_km ?? 6)}
```

- [ ] **Step 3: Extend `CheckoutForm` props and import the picker**

In `components/shop/CheckoutForm.tsx`:

(a) Add imports near the other component imports:

```ts
import { DeliveryMapPicker, type DeliveryDetails } from "@/components/shop/DeliveryMapPicker";
import type { DeliveryTier } from "@/lib/delivery";
```

(b) Extend the destructured props and the props type (after `physicalLabel`):

```ts
  physicalLabel,
  mapsEnabled,
  mapsApiKey,
  storeLat,
  storeLng,
  deliveryTiers,
  deliveryMaxKm,
}: {
  // ...existing prop types unchanged...
  physicalLabel: string | null;
  mapsEnabled: boolean;
  mapsApiKey: string | null;
  storeLat: number;
  storeLng: number;
  deliveryTiers: DeliveryTier[];
  deliveryMaxKm: number;
}) {
```

- [ ] **Step 4: Hold the map-picked details in state**

Add near the other `useState` calls (after `const [deliveryTier, setDeliveryTier] = useState("");`):

```ts
  const [mapDetails, setMapDetails] = useState<DeliveryDetails | null>(null);
```

- [ ] **Step 5: Compute the delivery fee from the active source**

Replace the existing `const deliveryFee = ...` line (currently ~line 274) with:

```ts
  // With Maps on, the fee comes from the server-confirmed map pick; otherwise
  // from the manual tier radios.
  const deliveryFee =
    mode === "delivery"
      ? mapsEnabled
        ? mapDetails?.feeCents ?? 0
        : getDeliveryFeeCents(deliveryTier)
      : 0;
  const deliveryReady =
    mode !== "delivery" ||
    Boolean(selectedAddressId) ||
    (mapsEnabled ? mapDetails !== null : deliveryTier !== "" && deliveryTier !== "out-of-zone");
```

(A selected saved address is always ready — it carries its own `tier`.)

- [ ] **Step 6: Render the map picker in the delivery branch**

In the `mode === "delivery" && effectiveIsLoggedIn` block, render the map picker when `mapsEnabled` (and no saved address is selected), and show the existing manual address fields only when `!mapsEnabled`. A selected saved address needs no extra input under Maps (it carries its own `tier`). Concretely, immediately after the saved-addresses `fieldset` closing tag and before the `Delivery address` label, insert:

```tsx
                {mapsEnabled && mapsApiKey && !selectedAddressId && (
                  <div className="sm:col-span-2 space-y-3">
                    <DeliveryMapPicker
                      apiKey={mapsApiKey}
                      storeLat={storeLat}
                      storeLng={storeLng}
                      tiers={deliveryTiers}
                      maxKm={deliveryMaxKm}
                      onChange={setMapDetails}
                    />
                    <label className="block text-sm font-medium">
                      Landmark / delivery notes
                      <input name="landmark" className={inputClass} placeholder="Near the red gate, unit number, etc." />
                    </label>
                  </div>
                )}
```

Then keep the manual block for the `maps_enabled=false` fallback only. Wrap the manual fields group by replacing the `Delivery address` label's opening line:

```tsx
                {!mapsEnabled && (
                <>
                <label className="text-sm font-medium sm:col-span-2">
                  Delivery address
```

and after the `Approximate distance` `fieldset` closing tag (`</fieldset>`), close the wrapper:

```tsx
                </>
                )}
```

(Under the fallback, the saved-address path keeps prefilling these manual fields and its `tier`, exactly as today.)

- [ ] **Step 7: Build the delivery payload from the map details**

In `handlePlaceOrder`, replace the `delivery:` builder in the `input` object (currently lines ~312-334) with:

```ts
      delivery:
        mode === "delivery" && effectiveIsLoggedIn
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
              if (mapsEnabled && mapDetails) {
                return {
                  street: mapDetails.street,
                  barangay: mapDetails.barangay ?? undefined,
                  city: mapDetails.city,
                  landmark: data.get("landmark") ? String(data.get("landmark")) : undefined,
                  lat: mapDetails.lat,
                  lng: mapDetails.lng,
                  googlePlaceId: mapDetails.googlePlaceId ?? undefined,
                };
              }
              if (!mapsEnabled && deliveryTier && deliveryTier !== "out-of-zone") {
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

- [ ] **Step 8: Gate the submit button on `deliveryReady`**

In the `Review order` submit button's `disabled` expression (currently includes `deliveryTier === "out-of-zone"`), replace `deliveryTier === "out-of-zone"` with `!deliveryReady`:

```tsx
          <button type="submit" disabled={requiresAccount || !deliveryReady || (mode === "pickup" && pickupSlots.length === 0) || (mode === "delivery" && !effectiveIsLoggedIn)} ...>
```

- [ ] **Step 9: Lint + build**

Run: `npm run lint`
Expected: no errors; confirm all new props are used.
Run: `npm run build`
Expected: success.

- [ ] **Step 10: Commit**

```bash
git add "app/(shop)/checkout/page.tsx" "components/shop/CheckoutForm.tsx"
git commit -m "feat: Maps delivery picker in checkout behind maps_enabled with manual fallback"
```

---

## Final Verification

- [ ] Run `npm test` → all suites pass (smoke, staff-roles, checkout-slots, store-availability, duration, delivery-quote).
- [ ] Run `npm run lint && npm run build` → both succeed.
- [ ] Apply `supabase/migrations/0047_maps_delivery.sql` to Supabase (manual). Then set the flag: `update app_settings set maps_enabled = true where id = 1;`
- [ ] Manual checklist (delivery, signed-in customer):
  - Search an address in San Carlos City → map centers, pin drops, fee shows (e.g. `≈3.2 km · ₱40`).
  - Drag the pin → distance + fee update.
  - Pick a point > 6 km away → out-of-zone message; submit stays disabled.
  - Place an in-zone delivery order → success; `/order/<code>` shows the matching delivery fee and total.
  - Verify in DB: `delivery_addresses` row has real `lat`/`lng` (not store coords) and `google_place_id`.
  - Set `maps_enabled = false` → the manual tier picker renders again and an order can still be placed.

## Notes for the implementer

- The browser key is referrer-restricted; Maps renders on `localhost:3000` and `zombeans.xyz`. If the map is blank with a console `RefererNotAllowedMapError`, add the current origin to the key's HTTP-referrer list in Google Cloud Console.
- `place_order` is authoritative for the charged fee; the client quote is display-only. The manual checklist's "fee on tracking matches" step is the parity check between `lib/delivery.ts` and the SQL `delivery_quote`.
- **Follow-up (not in this plan):** persist `lat`/`lng`/`google_place_id` on `customer_addresses` and reuse `DeliveryMapPicker` on the account page so saved addresses re-quote precisely. Today saved addresses keep using their stored `tier`.
