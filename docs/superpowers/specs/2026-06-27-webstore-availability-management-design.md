# Webstore Availability Management — Design

**Date:** 2026-06-27
**Status:** Approved (design)

## Summary

A staff-facing control for pausing and resuming online ordering on the webstore,
inspired by the Foodpanda Partner app's status flow (used as inspiration only —
not a visual copy). A floating availability button in the staff workspace opens a
modal where staff can set the store **Open** or **Closed**, optionally enable
**High Demand mode**, and (when closed) record a reason and an optional
auto-reopen time. When the store is closed, customers see a "Currently Closed"
notice and cannot place orders.

## Background / current state

- `app_settings.accepting_orders` (boolean, default `true`) already exists and is
  enforced server-side inside `place_order` (raises `NOT_ACCEPTING`). **Nothing in
  the app currently reads or writes it** — there is no UI for it.
- The customer-facing open/closed indicator uses time-based hours
  (`lib/checkout.ts` → `isStoreOpen()`), independent of `accepting_orders`.
- Menu items already implement an availability-hold pattern
  (`unavailability_kind` ∈ `today|until|indefinite`, `unavailable_until`) with an
  expiry-refresh function and a narrow storefront RPC. This feature mirrors that
  pattern at the store level.
- Permissions are a grantable union (`StaffPermission` + `GRANTABLE_PERMISSIONS`)
  resolved per staff member; Super Admins implicitly hold every permission.
- The workspace has a shared `app/workspace/layout.tsx` shell — the home for the
  floating button. The storefront has `KitchenClosingBanner` as a precedent for a
  customer notice.

## Decisions (confirmed)

1. **Manual switch vs. hours — override-to-close only.** Manual `Closed`
   force-closes the store at any time. `Open` means "not manually paused"; the
   existing time-based hours still auto-close after closing time. The effective
   customer gate is `isStoreOpen() && accepting_orders`.
2. **High Demand — fixed +N minutes.** A constant buffer
   (`HIGH_DEMAND_EXTRA_MINUTES = 15`) is added to the prep ETA and the earliest
   pickup slot, plus a customer-facing "busier than usual" note.
3. **Permission — new grantable `store:availability`.** Super Admins always hold
   it; grantable to cashiers through the existing Team UI. Not a cashier default.
4. **Button scope — workspace pages only.** The floating button renders across the
   staff `/workspace` area, not the customer storefront.

## Data model

Migration `0043_store_availability.sql` extends the singleton `app_settings`:

| column | type | notes |
|---|---|---|
| `accepting_orders` | boolean (exists) | master switch; `false` = manually Closed |
| `closure_reason_code` | text null | `today` \| `temporary` \| `kitchen` \| `inventory` \| `maintenance` \| `custom`; CHECK constraint |
| `closure_note` | text null | free text; required when `closure_reason_code = 'custom'` |
| `closed_until` | timestamptz null | optional "unavailable until…" auto-reopen time |
| `high_demand` | boolean not null default false | longer-prep mode |

Reason-code labels (customer-facing):
- `today` → "Unavailable for today"
- `temporary` → "Temporarily closed"
- `kitchen` → "Kitchen unavailable"
- `inventory` → "Inventory shortage"
- `maintenance` → "Under maintenance"
- `custom` → uses `closure_note`

`closed_until` is independent of the reason code (any reason may carry an
auto-reopen time). When `closure_reason_code = 'today'` and no explicit
`closed_until` is given, the action sets `closed_until` to end-of-day in
Asia/Manila.

### Auto-reopen

`refresh_expired_store_availability()` (mirrors
`refresh_expired_menu_item_availability`): when `accepting_orders = false` and
`closed_until` is non-null and in the past, set `accepting_orders = true` and clear
`closure_reason_code`, `closure_note`, `closed_until`. Invoked at the start of the
storefront read so the store reopens on its own without a manual action.

### Grants / RLS

Follow the project's explicit-grant convention. Writes go through
`createAdminSessionClient()` in server actions (as menu availability does), so no
new customer-facing table policies are required. If a narrow storefront read RPC
is added (`get_store_availability`), grant `execute` to `anon, authenticated`,
matching `get_storefront_menu_item_availability`.

## Permissions (`lib/staff-roles.ts`)

- Add `store:availability` to the `StaffPermission` union and to the
  `PERMISSION_KEYS` record (compiler-enforced exhaustiveness).
- Add a `GRANTABLE_PERMISSIONS` entry under a new section `"Store"`:
  - label: "Manage store availability"
  - description: "Open or close the webstore and toggle high-demand mode."
- Do **not** add it to `cashier` role defaults; it remains grant-only. Super
  Admins receive it via `hasStaffPermission`'s admin short-circuit.
- `GrantablePermission.section` union gains `"Store"`. The Team
  `StaffPermissionsForm` renders sections generically, so the new section appears
  automatically.

## Server side

### `lib/store-availability.ts` (server-only)

```ts
export type StoreAvailability = {
  isOpen: boolean;            // accepting_orders, after expiry refresh
  closureReasonCode: ClosureReasonCode | null;
  closureLabel: string | null;   // resolved customer-facing label
  closureNote: string | null;
  closedUntil: string | null;    // ISO
  highDemand: boolean;
  prepBufferMinutes: number;     // HIGH_DEMAND_EXTRA_MINUTES when highDemand else 0
};

export async function getStoreAvailability(): Promise<StoreAvailability>;
```

Calls the refresh function (RPC or direct admin update) first, then reads
`app_settings`. Pure label/format helpers are unit-testable in isolation.

### `app/workspace/availability/actions.ts`

`"use server"` actions, each gated by
`requireStaffPermission("store:availability")`, writing via
`createAdminSessionClient()`, auditing via the existing `audit(...)` helper, and
revalidating storefront + workspace paths:

- `setStoreOpen()` → `accepting_orders=true`, clear `closure_reason_code`,
  `closure_note`, `closed_until`. Leaves `high_demand` unchanged.
- `setStoreClosed({ reasonCode, note?, until? })` → validate (custom requires
  note; `until` must be a future date; `today` derives end-of-day Manila when no
  `until`), set `accepting_orders=false`, force `high_demand=false`.
- `setHighDemand(enabled: boolean)` → rejected with an error result when enabling
  while the store is closed; otherwise update `high_demand`.

Result type mirrors `MenuActionResult` (`{ ok: true } | { ok: false; error }`).

### Constant

`HIGH_DEMAND_EXTRA_MINUTES = 15` (in `lib/checkout.ts` alongside the other prep
constants, or in `lib/store-availability.ts`). Added to `DEFAULT_PREP_MINUTES`
when high demand is active.

## Staff UI

### `components/admin/StoreAvailabilityButton.tsx` (client)

- Fixed, floating button (bottom-right) with a status dot: green (open), red
  (closed), amber (open + high demand).
- Rendered from `app/workspace/layout.tsx`, only when
  `hasStaffPermission(profile, "store:availability")`, seeded with the server-read
  `StoreAvailability`.
- Opens the modal; reflects state changes optimistically / after action result.

### `components/admin/StoreAvailabilityModal.tsx` (client)

- Header: "Update your status" with current state summary and a close (✕) button.
- Three option cards, themed with the existing `zb-*` palette:
  - **Open** (green dot) — "Receiving incoming orders as usual".
  - **High Demand mode** — a toggle; only enableable while open; subtitle "Stay
    open with automatically increased preparation time".
  - **Closed** (red dot) — with an **Edit** affordance opening the reason editor:
    - Reason picker using a **Base UI Select** styled like the pickup-time picker
      (per project preference — no native `<select>`).
    - Conditional custom-reason text field (when `custom`).
    - Optional "Unavailable until…" datetime input.
- Smooth transitions/animations on status change; modern, minimal, responsive.
- Calls the server actions and surfaces errors inline.

## Customer surface

### `components/shop/StoreClosedNotice.tsx` (server)

- Reads `getStoreAvailability()`.
- When closed: a "Currently Closed" banner showing the resolved reason label
  (and note) and the reopen time when `closed_until` is set.
- When open + high demand: a "busier than usual — longer waits" variant.
- Renders nothing when open and not high demand.
- Placed on the menu, cart, and checkout pages (next to `KitchenClosingBanner`).

### Ordering gate

- The hard backstop already exists: `place_order` raises `NOT_ACCEPTING` when
  `accepting_orders=false`.
- UX layer: the checkout/cart primary CTA is disabled when closed. `CheckoutForm`
  receives `isOpen` and `prepBufferMinutes` props; pickup-slot generation and the
  displayed ETA add `prepBufferMinutes` when high demand is active.

## Testing

- **Availability resolver** (`getStoreAvailability` pure helpers): open vs closed,
  expired `closed_until` auto-reopen, high-demand buffer value, label resolution
  for each reason code (incl. custom note).
- **Closure validation**: custom requires note; `until` must be in the future;
  `today` derives end-of-day Manila; `setHighDemand(true)` rejected while closed.
- Follow the existing menu-availability test patterns and the project's testing
  conventions.

## Out of scope

- Multi-location / per-branch availability (single store today).
- Configurable high-demand magnitude (fixed constant for now).
- Realtime push of status to already-open customer tabs (server-rendered on
  navigation; consistent with the project's polling-over-realtime decision).
- Scheduled/recurring closures beyond the single `closed_until` timestamp.
