# Store Availability v2 — Physical + Webstore + High Demand

**Date:** 2026-06-28
**Status:** Approved (design)
**Builds on:** `2026-06-27-webstore-availability-management-design.md` (same branch
`feature/webstore-availability`, not yet merged/applied).

## Summary

Expand the availability system from a single webstore on/off switch into two
**independent** closable services — the **webstore** (online ordering) and the
**physical store** (walk-in café) — plus the existing **High Demand** mode, which
stays independent of both. Closing the physical store can optionally also close
the webstore in one step. Both closures share a unified reason list and a richer
duration/scheduling system with automatic reopen. Status changes reflect
immediately on the customer-facing storefront and ordering flow.

## Background / current state (from v1, this branch)

- `app_settings` already has (migration 0043, committed, not yet applied):
  `accepting_orders` (webstore master switch, enforced in `place_order`),
  `closure_reason_code`, `closure_note`, `closed_until`, `high_demand`,
  `high_demand_minutes`, `high_demand_until`.
- `refresh_expired_store_availability()` auto-clears expired webstore closure and
  high-demand; `get_store_availability()` is a `SECURITY DEFINER` RPC returning
  those fields to `anon`/`authenticated`.
- Pure logic in `lib/store-availability.ts` (`resolveStoreAvailability`,
  `closureLabel`, `clampHighDemandMinutes`, high-demand constants), server reader
  `lib/store-availability-data.ts`, actions in
  `app/workspace/availability/actions.ts`, modal + floating control in
  `components/admin/StoreAvailability{Modal,Control}.tsx`, customer
  `components/shop/StoreClosedNotice.tsx`, and checkout gating in
  `components/shop/CheckoutForm.tsx`.
- The physical café open/closed has so far been time-based only
  (`lib/checkout.ts` → `isStoreOpen()`, `STORE_OPEN_HOUR = 8`,
  `getCloseHour(day)`). There is no manual physical-store switch yet.
- Webstore reasons in v1: `today | temporary | kitchen | inventory | maintenance
  | custom`. These are REPLACED by the unified list below.

## Decisions (confirmed)

1. **Physical-closed effect (webstore kept open):** online ordering stays on, but
   the on-site service modes — `dine_in` and counter `take_out` — are disabled in
   checkout; `pickup` and `delivery` continue. Customers see a "café closed for
   walk-ins" notice.
2. **Reasons unified:** one shared reason set replaces the v1 webstore reasons,
   used by both closure types.
3. **Duration semantics (Asia/Manila):** "Today only" reopens **tomorrow at
   opening time**; "Until tomorrow" reopens **the day after, at opening time**.
4. **High Demand** stays as-is and independent of both closures.

## Data model — migration `0044_physical_store_status.sql`

Append-only (0043 not yet applied, but we keep migrations append-only per
project convention).

Add to `app_settings`, mirroring the webstore columns:

| column | type | notes |
|---|---|---|
| `physical_open` | boolean not null default true | physical café walk-in switch |
| `physical_closure_reason_code` | text null | unified reason code (CHECK) |
| `physical_closure_note` | text null | required when code = `custom` |
| `physical_closed_until` | timestamptz null | auto-reopen time |

**Unified reason set** (one CHECK constraint applied to BOTH
`closure_reason_code` and `physical_closure_reason_code`):

| code | label |
|---|---|
| `end_of_hours` | End of operating hours |
| `maintenance` | Temporary maintenance |
| `staff` | Staff unavailable |
| `inventory` | Inventory shortage |
| `emergency` | Emergency issue |
| `high_volume` | High order volume |
| `custom` | (uses the note) |

Migration steps:
1. `alter table app_settings drop constraint if exists` for the v1
   `closure_reason_code` CHECK (added in 0043), then add the four physical
   columns.
2. Add a single CHECK that constrains `closure_reason_code` to the unified set,
   and another CHECK for `physical_closure_reason_code` to the same set.
3. Update `refresh_expired_store_availability()` to ALSO auto-reopen the physical
   store: when `physical_open = false` and `physical_closed_until` is non-null and
   `<= now()`, set `physical_open = true` and clear
   `physical_closure_reason_code`, `physical_closure_note`,
   `physical_closed_until`. (Keep the existing webstore + high-demand expiry
   blocks.)
4. Recreate `get_store_availability()` to also return `physical_open`,
   `physical_closure_reason_code`, `physical_closure_note`,
   `physical_closed_until`. Re-grant execute to `anon, authenticated`.

No new table grants required (writes go through the admin session client;
customer reads go through the SECURITY DEFINER RPC).

## Pure logic (`lib/store-availability.ts`)

### Reason codes & labels
Replace `ClosureReasonCode` with the unified union and rewrite `closureLabel`'s
map to the seven labels above. (`custom` falls back to "Temporarily closed" when
the note is blank.)

### Duration resolver
Add a pure resolver, `resolveClosedUntil(choice, now?, openHour?)`, returning an
ISO string or `null`:

```ts
export type DurationChoice =
  | { kind: "manual" }
  | { kind: "today" }
  | { kind: "tomorrow" }
  | { kind: "preset"; minutes: 30 | 60 | 120 | 240 }
  | { kind: "specific"; iso: string };

export function resolveClosedUntil(
  choice: DurationChoice,
  now?: Date
): { ok: true; value: string | null } | { ok: false; error: string };
```

- `manual` → `{ ok: true, value: null }`.
- `today` → tomorrow at `STORE_OPEN_HOUR` (08:00) Asia/Manila, as UTC ISO.
- `tomorrow` → day-after at `STORE_OPEN_HOUR` Asia/Manila.
- `preset` → `now + minutes`.
- `specific` → the given ISO; `{ ok: false }` when not strictly in the future.

The Manila day/opening math reuses the same `+08:00` ISO construction used by the
existing `endOfSlotISO` helper in `lib/checkout.ts` (no DST). A shared
`manilaDateAtHour(dayOffset, hour, now)` helper in `lib/checkout.ts` produces
these timestamps and is unit-tested.

### Nested availability shape
`resolveStoreAvailability(row, now?)` returns a nested shape (refactor of the v1
flat shape):

```ts
export type ServiceStatus = {
  isOpen: boolean;
  reasonCode: ClosureReasonCode | null;
  label: string | null;       // resolved customer-facing label
  note: string | null;
  closedUntil: string | null;
};

export type StoreAvailability = {
  webstore: ServiceStatus;
  physical: ServiceStatus;
  highDemand: boolean;
  highDemandUntil: string | null;
  prepBufferMinutes: number;
  // convenience flags for consumers:
  onSiteModesDisabled: boolean; // physical closed (regardless of webstore)
};
```

`StoreAvailabilityRow` gains the four physical columns. In-memory expiry is
applied independently to webstore (`accepting_orders`/`closed_until`), physical
(`physical_open`/`physical_closed_until`), and high-demand, mirroring the DB
refresh so reads are correct before the persisted reset lands.

## Server reader & actions

### `lib/store-availability-data.ts`
Update the RPC row type and the open-fallback to the nested shape (fallback: both
services open, no high demand).

### `app/workspace/availability/actions.ts`
Result shape unchanged (`{ ok: true } | { ok: false; error }`). All gated on
`requireStaffPermission("store:availability")`, audited, and revalidate
storefront + workspace.

- `setWebstoreStatus({ open, reasonCode?, note?, duration? })` — open clears
  webstore closure (and high-demand, per v1 decision); close validates
  custom-requires-note + duration, writes `accepting_orders=false` + closure
  fields.
- `setPhysicalStatus({ open, reasonCode?, note?, duration?, alsoCloseWebstore?,
  webstore? })` — open clears physical closure. Close writes the physical
  columns; when `alsoCloseWebstore` is true, the SAME update also closes the
  webstore using `webstore.{reasonCode,note,duration}` (atomic combined closure).
- `setHighDemand(...)` — unchanged.

Each action validates its reason/duration via the pure resolver and Zod; both
closures in a combined call are validated before any write.

## Staff modal (`components/admin/StoreAvailabilityModal.tsx`)

Step-by-step flow with three clearly separated sections — **Physical Store**,
**Webstore**, **High Demand**:

- Each service shows current state (green open / red closed with reason) and a
  primary toggle/Close action.
- Closing the **Webstore**: ① choose reason (Base UI Select, unified list) → ②
  custom note when `custom` → ③ choose duration.
- Closing the **Physical Store**: ① "Keep webstore open" vs "Also close webstore"
  → ② reason(s) — one when keeping webstore open, two when also closing (each its
  own reason + note) → ③ duration(s). Keep the flow compact (a step indicator or
  progressive disclosure), not a multi-page wizard.
- **Duration picker** (shared component): buttons for Until manually reopened /
  Today only / Until tomorrow / 30 min / 1 h / 2 h / 4 h, plus a "Specific day &
  time" option exposing native date + time inputs with `min` set to now
  (past-prevention) and a client-side future check.
- **High Demand** section is unchanged (toggle + stepper + window note), shown
  independently and enableable whenever the webstore is open.
- Smooth transitions; `zb-*` theme tokens; responsive bottom-sheet → centered
  dialog.

`StoreAvailabilityControl` (floating button) dot severity: both closed → red
"Closed"; either one closed → amber (label names which); high-demand only → amber
"High demand"; all open → green "Open".

## Customer surface

### `components/shop/StoreClosedNotice.tsx`
Render per combination (priority order):
- **Webstore closed** (with or without physical) → "Online ordering is currently
  unavailable" + reason + reopen time; if physical also closed, add a line that
  the café is closed too.
- **Physical closed only** (webstore open) → "Our café is closed for walk-ins
  right now" + reason + reopen time; online ordering still available.
- **High demand** (all open) → existing "Busier than usual" note.
- Otherwise null.

### `components/shop/CheckoutForm.tsx`
Receives both services' status (via the checkout page reading
`getStoreAvailability()`):
- Webstore closed → existing closed-screen gate (online-unavailable messaging).
- Physical closed (webstore open) → hide/disable the `dine_in` top mode and the
  `take_out` counter sub-mode; default to `pickup`; show a short note that on-site
  options are paused. `pickup`/`delivery` work normally.
- High-demand `prepBufferMinutes` into pickup slots — unchanged.

The hard backstop (`place_order` `NOT_ACCEPTING` on `accepting_orders=false`)
remains; physical-closure on-site gating is UX-layer (no DB enforcement needed
since on-site modes are a webstore-form concern).

## Testing

Unit (Vitest, pure modules only):
- `resolveClosedUntil`: each kind — manual→null; today→tomorrow 08:00 Manila;
  tomorrow→day-after 08:00; presets→now+N; specific future ok; specific past
  rejected.
- `manilaDateAtHour`: correct UTC instant for a given day offset + hour.
- `closureLabel`: all seven codes incl. custom-with/without note.
- `resolveStoreAvailability`: independent webstore/physical/high-demand expiry;
  nested shape; `onSiteModesDisabled` reflects physical only; combined
  both-closed.

UI/integration: `npm run lint` + `npm run build`; manual checklist (deferred):
combined closure flow, scheduled reopen, on-site mode hiding, dot severity,
permission-gated visibility.

## Out of scope

- Per-branch / multi-location availability (single store).
- Recurring/calendar schedules beyond a single `closed_until`/
  `physical_closed_until`.
- Realtime push to already-open tabs (server-rendered on navigation; consistent
  with the project's polling-over-realtime decision).
- DB-level enforcement of physical-closure on-site modes (UX-layer only).
