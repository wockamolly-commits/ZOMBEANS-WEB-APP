# Google Maps Delivery Location — Design

**Date:** 2026-06-28
**Status:** Approved (pending spec review)
**Phase:** Completes Phase 1 "Delivery" (per `zombeans-plan.md`) by bringing the Phase 5 `maps_enabled` Google Maps integration forward.

## Problem

Checkout already offers a **Delivery** service mode, but the customer estimates their own distance via a manual radio picker (`tier-2`/`tier-4`/`tier-6`/`out-of-zone`) — the UI even says *"Maps will calculate this automatically once connected."* Two problems:

1. **No real location.** No coordinates are captured; the fee tier is a customer guess, and the >6 km out-of-zone rule is unenforceable.
2. **Price-tampering gap.** `place_order` trusts the client-supplied `tier` to set the delivery fee (contradicts the plan's §9 "every total recomputed server-side").

## Goal

Replace the manual tier picker with a Google Maps address picker that captures real coordinates, and make the delivery fee + zone check **authoritative on the server**, computed from those coordinates. Net new third-party cost: **$0** at café scale (straight-line distance; no paid distance API).

## Non-goals (YAGNI)

- Static map on the order-tracking page (defer).
- Driving distance / Distance Matrix / Directions API (use straight-line haversine).
- Guest delivery (delivery keeps requiring a signed-in customer — already enforced in `place_order`).

## Architecture

### Authoritative quote (single source of truth)

A Postgres function computes distance, zone, tier, and fee from coordinates — used by **both** the live UI quote and order placement, so they can never disagree.

```
delivery_quote(p_lat numeric, p_lng numeric)
  returns table(in_zone boolean, distance_km numeric, tier text, fee_cents bigint)
```

- Reads `app_settings`: `store_lat`, `store_lng`, `delivery_fee_tiers` (JSONB `[{max_km, fee_cents}]`), `delivery_max_km`.
- **Straight-line (haversine)** distance store → point.
- Walks `delivery_fee_tiers` ascending; first tier whose `max_km >= distance` wins → `tier` (`tier-<max_km>`) + `fee_cents`.
- `distance > delivery_max_km` → `in_zone = false` (no tier/fee).
- `SECURITY DEFINER`, `search_path = public`; granted to `anon, authenticated`.

### Server surfaces

- **`quoteDelivery({ lat, lng })`** server action (`app/actions/checkout.ts`): calls `delivery_quote` RPC, returns `{ inZone, distanceKm, tier, feeCents }` for the live checkout readout.
- **`place_order` (migration 0047)**: in the `delivery` branch, read `lat`/`lng` from the `delivery` payload, call `delivery_quote` internally, and:
  - raise `OUT_OF_ZONE` if `in_zone = false`;
  - set `delivery_fee_cents` from the function (ignore any client `tier`);
  - insert `delivery_addresses` with the real `lat`, `lng`, `google_place_id`, plus `street`, `barangay`, `city`, `landmark`, `delivery_notes`.
  - Keep the existing auth guard (delivery requires a signed-in customer).

### Client

- **`DeliveryMapPicker`** (new client component) renders in the delivery branch when `maps_enabled` is true:
  - **Places Autocomplete** input (Places API New), location-biased to the store.
  - **Maps JavaScript API** map with a **draggable marker**; selecting a suggestion or dragging sets the point.
  - On change: capture `lat`, `lng`, `google_place_id`; parse `street`/`barangay`/`city` from address components (street + landmark remain editable; landmark + notes free-text).
  - Debounced call to `quoteDelivery` → live readout (`≈X km · ₱fee`) or the out-of-zone bounce-to-pickup block.
- **Maps loader**: load the JS API once (browser key, libraries `places,marker`). Loader approach (`@googlemaps/js-api-loader` vs `next/script`) decided in the plan after consulting `node_modules/next/dist/docs/`.
- **Fallback**: when `maps_enabled` is false, the **existing manual tier picker** renders unchanged. `maps_enabled` is set to `true` now (keys configured).

### Data flow

```
customer types/drag → DeliveryMapPicker sets {lat,lng,place_id,address parts}
  → quoteDelivery(lat,lng) → delivery_quote RPC → {inZone, km, tier, fee}
  → UI shows fee or out-of-zone
place order → placeOrder action sends delivery {lat,lng,place_id,street,barangay,city,landmark,notes}
  → place_order RPC → delivery_quote (authoritative fee/zone) → orders + delivery_addresses
```

### Saved addresses

Persist `lat`, `lng`, `google_place_id` on newly saved addresses so reuse re-quotes exactly. `SavedAddress` type + save path extended; existing rows without coordinates fall back to the manual picker or re-pin.

## Keys / config

- `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` — referrer-restricted (localhost + `zombeans.xyz`), Maps JS + Places.
- `GOOGLE_MAPS_SERVER_KEY` — Geocoding only, server-side (reserved; current design does reverse-geocoding client-side via the JS API, so the server key is presently used only if we add server geocoding — keep provisioned).
- `app_settings.maps_enabled = true`.

## Security

- Fee + zone computed server-side from coordinates; client `tier` ignored. (Closes the tampering gap.)
- Browser key referrer-restricted + API-restricted; server key API-restricted, server-only.
- Delivery still requires authentication.

## Testing

- **Unit** (`tests/unit/delivery-quote.test.ts`): a TS port of the tier logic — distance → tier → fee, boundary at each `max_km`, and the `delivery_max_km` cutoff. (SQL function verified by manual round-trip.)
- **Manual checklist**: autocomplete selects a San Carlos point; drag pin updates fee; an out-of-zone point blocks and bounces to pickup; place a delivery order; fee on the order-tracking page matches the quote; `maps_enabled=false` shows the manual fallback.

## Migrations

- **0047** — `delivery_quote()` function + grants; update `place_order` delivery branch to use it; (saved-address coordinate columns if not already present). Applied manually, like prior migrations.
