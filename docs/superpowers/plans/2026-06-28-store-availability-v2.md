# Store Availability v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an independent **physical-store** closable status alongside the existing **webstore** status, with a combined-closure flow, a unified reason list, and a richer duration/scheduling system with automatic reopen — keeping High Demand mode independent.

**Architecture:** Extend the singleton `app_settings` with physical-store columns (migration 0044) and a unified reason CHECK. Pure logic in `lib/store-availability.ts` gains a unified reason set, a duration resolver, and a resolver that reports webstore + physical + high-demand status. Staff drive it through a step-by-step modal calling permission-gated server actions; the customer storefront shows the right message per combination and the checkout hides on-site service modes when the café is closed.

**Tech Stack:** Next.js 16 (App Router/RSC), React 19, TypeScript strict, Supabase/Postgres, Base UI (`@base-ui/react`), Tailwind v4, Zod v4, Vitest.

## Global Constraints

- Customized Next.js — consult `node_modules/next/dist/docs/` before using framework APIs (per `AGENTS.md`).
- Path alias `@/*` → repo root.
- Pure, unit-tested modules (`lib/store-availability.ts`, `lib/checkout.ts`) must NOT import `"server-only"`/Supabase/React. `lib/store-availability-data.ts` is `"server-only"`.
- DB writes use `createAdminSessionClient()`; customer reads use the anon client via the `get_store_availability` RPC. Staff actions gate on `requireStaffPermission("store:availability")`. Action result shape: `{ ok: true } | { ok: false; error: string }`.
- All store-time math is Asia/Manila (no DST → UTC+8). Reuse the `+08:00` ISO construction pattern from `lib/checkout.ts`.
- Migrations are append-only numbered SQL in `supabase/migrations/`, applied manually (feature inert until applied).
- Theme tokens only: `zb-primary`, `zb-primary-strong`, `zb-primary-dark`, `zb-cream`, `zb-bone`, `zb-bone-soft`, `zb-sage`, `zb-danger` (+ status `emerald-*`/`amber-*`).
- **Unified reason codes (replace v1's):** `end_of_hours` ("End of operating hours"), `maintenance` ("Temporary maintenance"), `staff` ("Staff unavailable"), `inventory` ("Inventory shortage"), `emergency` ("Emergency issue"), `high_volume` ("High order volume"), `custom` (uses note).
- **Duration semantics (Asia/Manila, `STORE_OPEN_HOUR = 8`):** manual → null; today → tomorrow 08:00; tomorrow → day-after 08:00; presets → now + 30/60/120/240 min; specific → chosen datetime (must be strictly future).
- **Representation note (deviation from spec wording):** the spec said "nested" `StoreAvailability`; this plan uses a **flat additive** shape (existing webstore fields kept; `physical*` siblings added) to keep every task's build green. Functionally equivalent. Flagged for review.

---

### Task 1: Migration 0044 — physical-store columns, unified reasons, refresh + RPC

**Files:**
- Create: `supabase/migrations/0044_physical_store_status.sql`

**Interfaces:**
- Produces: `app_settings` columns `physical_open boolean not null default true`, `physical_closure_reason_code text`, `physical_closure_note text`, `physical_closed_until timestamptz`; a unified reason CHECK on both `closure_reason_code` and `physical_closure_reason_code`; `refresh_expired_store_availability()` also auto-reopens the physical store; `get_store_availability()` returns the four new columns (after `accepting_orders` group).

No unit test (SQL); verified by review + manual application later.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0044_physical_store_status.sql`:

```sql
-- Store Availability v2: a manual physical-store (walk-in café) status that is
-- independent of the webstore (accepting_orders). Adds physical columns, a
-- unified closure-reason set shared by both statuses, extends the expiry refresh
-- and the storefront read RPC.

-- v1 (0043) put an inline CHECK on closure_reason_code with the old reason set.
-- Drop it (auto-generated name) and the new unified CHECK is added below.
alter table app_settings
  drop constraint if exists app_settings_closure_reason_code_check;

alter table app_settings
  add column if not exists physical_open boolean not null default true,
  add column if not exists physical_closure_reason_code text,
  add column if not exists physical_closure_note text,
  add column if not exists physical_closed_until timestamptz;

-- Unified reason set for BOTH statuses. NULL allowed (open state).
alter table app_settings
  add constraint app_settings_closure_reason_code_check
    check (closure_reason_code in
      ('end_of_hours','maintenance','staff','inventory','emergency','high_volume','custom')),
  add constraint app_settings_physical_closure_reason_code_check
    check (physical_closure_reason_code in
      ('end_of_hours','maintenance','staff','inventory','emergency','high_volume','custom'));

-- Auto-clear expired states for webstore, physical store, and high demand.
create or replace function refresh_expired_store_availability()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update app_settings
  set accepting_orders = true,
      closure_reason_code = null,
      closure_note = null,
      closed_until = null
  where id = 1
    and accepting_orders = false
    and closed_until is not null
    and closed_until <= now();

  update app_settings
  set physical_open = true,
      physical_closure_reason_code = null,
      physical_closure_note = null,
      physical_closed_until = null
  where id = 1
    and physical_open = false
    and physical_closed_until is not null
    and physical_closed_until <= now();

  update app_settings
  set high_demand = false,
      high_demand_minutes = null,
      high_demand_until = null
  where id = 1
    and high_demand = true
    and high_demand_until is not null
    and high_demand_until <= now();
end;
$$;

-- Storefront read: refresh expiries, then return webstore + physical + high
-- demand fields (no other app_settings columns leak to anon).
create or replace function get_store_availability()
returns table (
  accepting_orders boolean,
  closure_reason_code text,
  closure_note text,
  closed_until timestamptz,
  physical_open boolean,
  physical_closure_reason_code text,
  physical_closure_note text,
  physical_closed_until timestamptz,
  high_demand boolean,
  high_demand_minutes int,
  high_demand_until timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform refresh_expired_store_availability();

  return query
  select s.accepting_orders,
         s.closure_reason_code,
         s.closure_note,
         s.closed_until,
         s.physical_open,
         s.physical_closure_reason_code,
         s.physical_closure_note,
         s.physical_closed_until,
         s.high_demand,
         s.high_demand_minutes,
         s.high_demand_until
  from app_settings s
  where s.id = 1;
end;
$$;

grant execute on function get_store_availability() to anon, authenticated;
```

- [ ] **Step 2: Review against 0043**

Run: `cat supabase/migrations/0043_store_availability.sql`
Expected: confirm the new RPC keeps `SECURITY DEFINER` + `set search_path = public` + the single `get_store_availability` grant; confirm the dropped constraint name matches Postgres's auto-name for 0043's inline column check (`app_settings_closure_reason_code_check`).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0044_physical_store_status.sql
git commit -m "feat(db): add physical-store status, unified reasons, extended refresh/RPC"
```

---

### Task 2: Pure logic — unified reasons, duration resolver, physical status + tests

**Files:**
- Modify: `lib/checkout.ts` (add `manilaDateAtHour`)
- Modify: `lib/store-availability.ts` (reasons, duration resolver, flat-additive physical fields, resolver)
- Modify: `lib/store-availability-data.ts` (row type + fallback)
- Modify: `app/workspace/availability/actions.ts:18-25` (reason `z.enum` values only)
- Modify: `components/admin/StoreAvailabilityModal.tsx:23-30,43-45` (REASONS list + reason initializer only — compile fix)
- Test: `tests/unit/store-availability.test.ts` (rewrite), `tests/unit/duration.test.ts` (new)

**Interfaces:**
- Consumes: `STORE_OPEN_HOUR`, `MANILA_TZ` (module-private in checkout — see Step 1), `getCloseHour` from `lib/checkout`.
- Produces (pure):
  - `lib/checkout.ts`: `export function manilaDateAtHour(dayOffset: number, hour: number, now?: Date): string`
  - `lib/store-availability.ts`:
    - `ClosureReasonCode = "end_of_hours" | "maintenance" | "staff" | "inventory" | "emergency" | "high_volume" | "custom"`
    - `type DurationChoice = { kind: "manual" } | { kind: "today" } | { kind: "tomorrow" } | { kind: "preset"; minutes: 30 | 60 | 120 | 240 } | { kind: "specific"; iso: string }`
    - `function resolveClosedUntil(choice: DurationChoice, now?: Date): { ok: true; value: string | null } | { ok: false; error: string }`
    - `closureLabel(code, note)` (unified labels)
    - `StoreAvailabilityRow` (+ 4 physical fields)
    - `StoreAvailability` flat-additive (webstore fields unchanged + `physicalOpen`, `physicalReasonCode`, `physicalLabel`, `physicalNote`, `physicalClosedUntil`, `onSiteModesDisabled`)
    - `resolveStoreAvailability(row, now?)`

- [ ] **Step 1: Add `manilaDateAtHour` to `lib/checkout.ts`**

`MANILA_TZ` and `STORE_OPEN_HOUR` already exist in this file. Add, right after the `endOfSlotISO` function:

```ts
// A Manila wall-clock instant at `hour:00` on (today + dayOffset), as a UTC ISO
// string. Manila has no DST (UTC+8), so day arithmetic on the midnight instant
// is exact. dayOffset 1 = tomorrow, 2 = day after.
export function manilaDateAtHour(
  dayOffset: number,
  hour: number,
  now: Date = new Date()
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const manilaMidnightToday = new Date(
    `${get("year")}-${get("month")}-${get("day")}T00:00:00+08:00`
  ).getTime();
  return new Date(
    manilaMidnightToday + (dayOffset * 24 + hour) * 3_600_000
  ).toISOString();
}
```

- [ ] **Step 2: Write the duration test (TDD)**

Create `tests/unit/duration.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveClosedUntil } from "@/lib/store-availability";
import { manilaDateAtHour } from "@/lib/checkout";

const now = new Date("2026-06-28T02:00:00Z"); // 10:00 Manila, Sun Jun 28

describe("resolveClosedUntil", () => {
  it("manual → null", () => {
    expect(resolveClosedUntil({ kind: "manual" }, now)).toEqual({
      ok: true,
      value: null,
    });
  });

  it("today → tomorrow at opening (08:00 Manila)", () => {
    const r = resolveClosedUntil({ kind: "today" }, now);
    expect(r).toEqual({ ok: true, value: manilaDateAtHour(1, 8, now) });
    // 2026-06-29 08:00 +08:00 == 2026-06-29T00:00:00Z
    expect(r.ok && r.value).toBe("2026-06-29T00:00:00.000Z");
  });

  it("tomorrow → day-after at opening", () => {
    const r = resolveClosedUntil({ kind: "tomorrow" }, now);
    expect(r.ok && r.value).toBe("2026-06-30T00:00:00.000Z");
  });

  it("preset → now + minutes", () => {
    const r = resolveClosedUntil({ kind: "preset", minutes: 120 }, now);
    expect(r.ok && r.value).toBe(new Date(now.getTime() + 120 * 60_000).toISOString());
  });

  it("specific future → that iso", () => {
    const iso = "2026-06-28T05:00:00.000Z";
    expect(resolveClosedUntil({ kind: "specific", iso }, now)).toEqual({
      ok: true,
      value: iso,
    });
  });

  it("specific past → error", () => {
    const r = resolveClosedUntil(
      { kind: "specific", iso: "2026-06-28T01:00:00.000Z" },
      now
    );
    expect(r.ok).toBe(false);
  });
});

describe("manilaDateAtHour", () => {
  it("builds the right UTC instant", () => {
    expect(manilaDateAtHour(0, 8, now)).toBe("2026-06-28T00:00:00.000Z");
  });
});
```

- [ ] **Step 3: Run the duration test (RED)**

Run: `npm test -- duration`
Expected: FAIL — `resolveClosedUntil` not exported.

- [ ] **Step 4: Rewrite `lib/store-availability.ts`**

Replace the entire file with:

```ts
import { manilaDateAtHour, STORE_OPEN_HOUR } from "@/lib/checkout";

export const HIGH_DEMAND_MIN_MINUTES = 5;
export const HIGH_DEMAND_MAX_MINUTES = 60;
export const HIGH_DEMAND_STEP_MINUTES = 5;
export const HIGH_DEMAND_DEFAULT_MINUTES = 15;
export const HIGH_DEMAND_WINDOW_MINUTES = 30;

export type ClosureReasonCode =
  | "end_of_hours"
  | "maintenance"
  | "staff"
  | "inventory"
  | "emergency"
  | "high_volume"
  | "custom";

export const REASON_CODES: ClosureReasonCode[] = [
  "end_of_hours",
  "maintenance",
  "staff",
  "inventory",
  "emergency",
  "high_volume",
  "custom",
];

const CLOSURE_LABELS: Record<ClosureReasonCode, string> = {
  end_of_hours: "End of operating hours",
  maintenance: "Temporary maintenance",
  staff: "Staff unavailable",
  inventory: "Inventory shortage",
  emergency: "Emergency issue",
  high_volume: "High order volume",
  custom: "Temporarily closed",
};

export type DurationChoice =
  | { kind: "manual" }
  | { kind: "today" }
  | { kind: "tomorrow" }
  | { kind: "preset"; minutes: 30 | 60 | 120 | 240 }
  | { kind: "specific"; iso: string };

export function resolveClosedUntil(
  choice: DurationChoice,
  now: Date = new Date()
): { ok: true; value: string | null } | { ok: false; error: string } {
  switch (choice.kind) {
    case "manual":
      return { ok: true, value: null };
    case "today":
      return { ok: true, value: manilaDateAtHour(1, STORE_OPEN_HOUR, now) };
    case "tomorrow":
      return { ok: true, value: manilaDateAtHour(2, STORE_OPEN_HOUR, now) };
    case "preset":
      return {
        ok: true,
        value: new Date(now.getTime() + choice.minutes * 60_000).toISOString(),
      };
    case "specific": {
      const t = new Date(choice.iso).getTime();
      if (Number.isNaN(t) || t <= now.getTime()) {
        return { ok: false, error: "Choose a future date and time." };
      }
      return { ok: true, value: choice.iso };
    }
  }
}

export type StoreAvailabilityRow = {
  accepting_orders: boolean;
  closure_reason_code: ClosureReasonCode | null;
  closure_note: string | null;
  closed_until: string | null;
  physical_open: boolean;
  physical_closure_reason_code: ClosureReasonCode | null;
  physical_closure_note: string | null;
  physical_closed_until: string | null;
  high_demand: boolean;
  high_demand_minutes: number | null;
  high_demand_until: string | null;
};

export type StoreAvailability = {
  // Webstore (online ordering)
  isOpen: boolean;
  closureReasonCode: ClosureReasonCode | null;
  closureLabel: string | null;
  closureNote: string | null;
  closedUntil: string | null;
  // Physical store (walk-in café)
  physicalOpen: boolean;
  physicalReasonCode: ClosureReasonCode | null;
  physicalLabel: string | null;
  physicalNote: string | null;
  physicalClosedUntil: string | null;
  onSiteModesDisabled: boolean; // physical closed → dine-in unavailable online
  // High demand (independent)
  highDemand: boolean;
  highDemandUntil: string | null;
  prepBufferMinutes: number;
};

export function clampHighDemandMinutes(value: number): number {
  if (Number.isNaN(value)) return HIGH_DEMAND_DEFAULT_MINUTES;
  return Math.min(
    HIGH_DEMAND_MAX_MINUTES,
    Math.max(HIGH_DEMAND_MIN_MINUTES, Math.round(value))
  );
}

export function closureLabel(
  code: ClosureReasonCode | null,
  note: string | null
): string | null {
  if (!code) return null;
  if (code === "custom") return note?.trim() || CLOSURE_LABELS.custom;
  return CLOSURE_LABELS[code];
}

function isPast(iso: string | null, now: Date): boolean {
  return iso !== null && new Date(iso).getTime() <= now.getTime();
}

// Resolve one service's open state with in-memory expiry, mirroring the DB
// refresh so reads are correct before the persisted reset lands. `open` may be
// undefined when reading a row from a pre-migration DB; treat that as open.
function resolveService(
  open: boolean | undefined,
  reasonCode: ClosureReasonCode | null,
  note: string | null,
  until: string | null,
  now: Date
) {
  const reopened = open === false && isPast(until, now);
  const isOpen = open !== false || reopened;
  const closed = !isOpen;
  const code = closed ? reasonCode : null;
  return {
    isOpen,
    reasonCode: code,
    label: closureLabel(code, note),
    note: closed ? note : null,
    closedUntil: closed ? until : null,
  };
}

export function resolveStoreAvailability(
  row: StoreAvailabilityRow,
  now: Date = new Date()
): StoreAvailability {
  const web = resolveService(
    row.accepting_orders,
    row.closure_reason_code,
    row.closure_note,
    row.closed_until,
    now
  );
  const phys = resolveService(
    row.physical_open,
    row.physical_closure_reason_code,
    row.physical_closure_note,
    row.physical_closed_until,
    now
  );

  const highDemandActive =
    row.high_demand && !isPast(row.high_demand_until, now);

  return {
    isOpen: web.isOpen,
    closureReasonCode: web.reasonCode,
    closureLabel: web.label,
    closureNote: web.note,
    closedUntil: web.closedUntil,
    physicalOpen: phys.isOpen,
    physicalReasonCode: phys.reasonCode,
    physicalLabel: phys.label,
    physicalNote: phys.note,
    physicalClosedUntil: phys.closedUntil,
    onSiteModesDisabled: !phys.isOpen,
    highDemand: highDemandActive,
    highDemandUntil: highDemandActive ? row.high_demand_until : null,
    prepBufferMinutes: highDemandActive ? row.high_demand_minutes ?? 0 : 0,
  };
}
```

- [ ] **Step 5: Rewrite `tests/unit/store-availability.test.ts`**

Replace the whole file with:

```ts
import { describe, expect, it } from "vitest";
import {
  clampHighDemandMinutes,
  closureLabel,
  resolveStoreAvailability,
  type StoreAvailabilityRow,
} from "@/lib/store-availability";

const base: StoreAvailabilityRow = {
  accepting_orders: true,
  closure_reason_code: null,
  closure_note: null,
  closed_until: null,
  physical_open: true,
  physical_closure_reason_code: null,
  physical_closure_note: null,
  physical_closed_until: null,
  high_demand: false,
  high_demand_minutes: null,
  high_demand_until: null,
};

const now = new Date("2026-06-28T10:00:00Z");

describe("clampHighDemandMinutes", () => {
  it("clamps below floor", () => expect(clampHighDemandMinutes(2)).toBe(5));
  it("clamps above ceiling", () => expect(clampHighDemandMinutes(999)).toBe(60));
  it("passes through in range", () => expect(clampHighDemandMinutes(20)).toBe(20));
  it("defaults NaN", () => expect(clampHighDemandMinutes(NaN)).toBe(15));
  it("rounds", () => expect(clampHighDemandMinutes(7.6)).toBe(8));
});

describe("closureLabel", () => {
  it("maps unified codes", () => {
    expect(closureLabel("staff", null)).toBe("Staff unavailable");
    expect(closureLabel("high_volume", null)).toBe("High order volume");
  });
  it("custom uses note, falls back when blank", () => {
    expect(closureLabel("custom", "Burst pipe")).toBe("Burst pipe");
    expect(closureLabel("custom", null)).toBe("Temporarily closed");
  });
  it("null when open", () => expect(closureLabel(null, null)).toBeNull());
});

describe("resolveStoreAvailability", () => {
  it("all open by default", () => {
    const r = resolveStoreAvailability(base, now);
    expect(r.isOpen).toBe(true);
    expect(r.physicalOpen).toBe(true);
    expect(r.onSiteModesDisabled).toBe(false);
    expect(r.prepBufferMinutes).toBe(0);
  });

  it("webstore closed independently of physical", () => {
    const r = resolveStoreAvailability(
      { ...base, accepting_orders: false, closure_reason_code: "maintenance" },
      now
    );
    expect(r.isOpen).toBe(false);
    expect(r.closureLabel).toBe("Temporary maintenance");
    expect(r.physicalOpen).toBe(true);
    expect(r.onSiteModesDisabled).toBe(false);
  });

  it("physical closed disables on-site modes, webstore stays open", () => {
    const r = resolveStoreAvailability(
      { ...base, physical_open: false, physical_closure_reason_code: "staff" },
      now
    );
    expect(r.physicalOpen).toBe(false);
    expect(r.physicalLabel).toBe("Staff unavailable");
    expect(r.onSiteModesDisabled).toBe(true);
    expect(r.isOpen).toBe(true);
  });

  it("both closed", () => {
    const r = resolveStoreAvailability(
      {
        ...base,
        accepting_orders: false,
        closure_reason_code: "emergency",
        physical_open: false,
        physical_closure_reason_code: "emergency",
      },
      now
    );
    expect(r.isOpen).toBe(false);
    expect(r.physicalOpen).toBe(false);
  });

  it("auto-reopens each service when its until passes", () => {
    const r = resolveStoreAvailability(
      {
        ...base,
        accepting_orders: false,
        closure_reason_code: "high_volume",
        closed_until: "2026-06-28T09:00:00Z",
        physical_open: false,
        physical_closure_reason_code: "staff",
        physical_closed_until: "2026-06-28T11:00:00Z",
      },
      now
    );
    expect(r.isOpen).toBe(true); // webstore until passed
    expect(r.physicalOpen).toBe(false); // physical until still future
  });

  it("high demand independent and buffer reported while active", () => {
    const r = resolveStoreAvailability(
      {
        ...base,
        high_demand: true,
        high_demand_minutes: 20,
        high_demand_until: "2026-06-28T10:20:00Z",
      },
      now
    );
    expect(r.highDemand).toBe(true);
    expect(r.prepBufferMinutes).toBe(20);
  });
});
```

- [ ] **Step 6: Update the server reader fallback `lib/store-availability-data.ts`**

Replace the `OPEN_FALLBACK` object with the flat-additive shape:

```ts
const OPEN_FALLBACK: StoreAvailability = {
  isOpen: true,
  closureReasonCode: null,
  closureLabel: null,
  closureNote: null,
  closedUntil: null,
  physicalOpen: true,
  physicalReasonCode: null,
  physicalLabel: null,
  physicalNote: null,
  physicalClosedUntil: null,
  onSiteModesDisabled: false,
  highDemand: false,
  highDemandUntil: null,
  prepBufferMinutes: 0,
};
```

(The rest of the file is unchanged — `resolveStoreAvailability(data[0] as StoreAvailabilityRow)` now reads the new RPC columns.)

- [ ] **Step 7: Update the reason `z.enum` in `app/workspace/availability/actions.ts`**

Replace the `reasonCode` enum (lines ~18-25) with the unified codes, and DELETE the now-obsolete `today`→`endOfSlotISO` special-case in `setStoreClosed` (the `if (code === "today" && !closedUntil)` block) plus its `endOfSlotISO` import (it stays imported only if still used — it is not, so remove the import):

```ts
const reasonCode = z.enum([
  "end_of_hours",
  "maintenance",
  "staff",
  "inventory",
  "emergency",
  "high_volume",
  "custom",
]);
```

In `setStoreClosed`, replace:

```ts
  let closedUntil: string | null = until ?? null;
  // "today" defaults to end-of-slot, but an explicit `until` ...
  if (code === "today" && !closedUntil) {
    closedUntil = endOfSlotISO();
  }
  if (closedUntil && new Date(closedUntil).getTime() <= Date.now()) {
```

with:

```ts
  const closedUntil: string | null = until ?? null;
  if (closedUntil && new Date(closedUntil).getTime() <= Date.now()) {
```

And remove the `import { endOfSlotISO } from "@/lib/checkout";` line.

- [ ] **Step 8: Compile-fix the modal's REASONS + initializer (`components/admin/StoreAvailabilityModal.tsx`)**

Replace the `REASONS` array (lines ~23-30):

```ts
const REASONS: { value: ClosureReasonCode; label: string }[] = [
  { value: "end_of_hours", label: "End of operating hours" },
  { value: "maintenance", label: "Temporary maintenance" },
  { value: "staff", label: "Staff unavailable" },
  { value: "inventory", label: "Inventory shortage" },
  { value: "emergency", label: "Emergency issue" },
  { value: "high_volume", label: "High order volume" },
  { value: "custom", label: "Custom reason" },
];
```

And the reason initializer default (line ~44): change `state.closureReasonCode ?? "temporary"` to `state.closureReasonCode ?? "end_of_hours"`.

(The full physical/duration modal rewrite happens in Tasks 3–4; this step only keeps it compiling.)

- [ ] **Step 9: Run tests + build**

Run: `npm test`
Expected: PASS (smoke, staff-roles, checkout-slots, store-availability rewritten, duration new).
Run: `npm run build`
Expected: success — the whole project typechecks against the new shape.

- [ ] **Step 10: Commit**

```bash
git add lib/checkout.ts lib/store-availability.ts lib/store-availability-data.ts app/workspace/availability/actions.ts components/admin/StoreAvailabilityModal.tsx tests/unit/store-availability.test.ts tests/unit/duration.test.ts
git commit -m "feat: unified reasons, duration resolver, and physical-store status in availability logic"
```

---

### Task 3: Server actions for physical store + combined closure

**Files:**
- Modify: `app/workspace/availability/actions.ts`

**Interfaces:**
- Consumes: `requireStaffPermission`, `createAdminSessionClient`, the unified `reasonCode` enum (Task 2).
- Produces (server actions, result `StoreActionResult`):
  - `setWebstoreStatus(input: { open: boolean; reasonCode?: ClosureReasonCode; note?: string; until?: string | null })`
  - `setPhysicalStatus(input: { open: boolean; reasonCode?: ClosureReasonCode; note?: string; until?: string | null; webstore?: { reasonCode: ClosureReasonCode; note?: string; until?: string | null } })`
  - `setHighDemand(input: { enabled: boolean; minutes?: number })` (unchanged)
- Keep the existing `setStoreOpen`/`setStoreClosed` exports as thin wrappers (Task 4 modal migrates to the new names; wrappers avoid a broken intermediate build).

This task has no unit test (server + Supabase); verified by `npm run build` + `npm run lint`.

- [ ] **Step 1: Add a closure-fields helper + Zod schemas**

In `app/workspace/availability/actions.ts`, add Zod schemas near the existing ones:

```ts
const closureInput = z.object({
  reasonCode,
  note: z.string().trim().max(200).optional(),
  until: z.union([z.iso.datetime(), z.null()]).optional(),
});

const webstoreStatusSchema = z.object({
  open: z.boolean(),
  reasonCode: reasonCode.optional(),
  note: z.string().trim().max(200).optional(),
  until: z.union([z.iso.datetime(), z.null()]).optional(),
});

const physicalStatusSchema = z.object({
  open: z.boolean(),
  reasonCode: reasonCode.optional(),
  note: z.string().trim().max(200).optional(),
  until: z.union([z.iso.datetime(), z.null()]).optional(),
  webstore: closureInput.optional(),
});
```

Add a pure helper that validates one closure and returns its column patch (or an error):

```ts
function closureFields(
  prefix: "" | "physical_",
  code: ClosureReasonCode,
  note: string | undefined,
  until: string | null | undefined
): { ok: true; patch: Record<string, unknown> } | { ok: false; error: string } {
  if (code === "custom" && !note?.trim()) {
    return { ok: false, error: "Add a short reason for the closure." };
  }
  if (until && new Date(until).getTime() <= Date.now()) {
    return { ok: false, error: "Choose a future reopening time." };
  }
  const openCol = prefix === "" ? "accepting_orders" : "physical_open";
  return {
    ok: true,
    patch: {
      [openCol]: false,
      [`${prefix}closure_reason_code`]: code,
      [`${prefix}closure_note`]:
        code === "custom" ? note?.trim() ?? null : note?.trim() || null,
      [`${prefix}closed_until`]: until ?? null,
    },
  };
}
```

Add the `ClosureReasonCode` import at the top:

```ts
import {
  clampHighDemandMinutes,
  HIGH_DEMAND_DEFAULT_MINUTES,
  HIGH_DEMAND_WINDOW_MINUTES,
  type ClosureReasonCode,
} from "@/lib/store-availability";
```

- [ ] **Step 2: Add `setWebstoreStatus`**

```ts
export async function setWebstoreStatus(
  input: z.input<typeof webstoreStatusSchema>
): Promise<StoreActionResult> {
  const { profile } = await requireStaffPermission("store:availability");
  const parsed = webstoreStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the closure details." };
  const admin = await createAdminSessionClient();

  if (parsed.data.open) {
    const { error } = await admin
      .from("app_settings")
      .update({
        accepting_orders: true,
        closure_reason_code: null,
        closure_note: null,
        closed_until: null,
        high_demand: false,
        high_demand_minutes: null,
        high_demand_until: null,
      })
      .eq("id", 1);
    if (error) return { ok: false, error: "Could not reopen the webstore." };
    await audit(admin, profile.id, "store.webstore_opened", {});
    refresh();
    return { ok: true };
  }

  if (!parsed.data.reasonCode) {
    return { ok: false, error: "Choose a closure reason." };
  }
  const fields = closureFields(
    "",
    parsed.data.reasonCode,
    parsed.data.note,
    parsed.data.until
  );
  if (!fields.ok) return fields;
  const { error } = await admin
    .from("app_settings")
    .update({
      ...fields.patch,
      high_demand: false,
      high_demand_minutes: null,
      high_demand_until: null,
    })
    .eq("id", 1);
  if (error) return { ok: false, error: "Could not close the webstore." };
  await audit(admin, profile.id, "store.webstore_closed", fields.patch);
  refresh();
  return { ok: true };
}
```

- [ ] **Step 3: Add `setPhysicalStatus` (with combined closure)**

```ts
export async function setPhysicalStatus(
  input: z.input<typeof physicalStatusSchema>
): Promise<StoreActionResult> {
  const { profile } = await requireStaffPermission("store:availability");
  const parsed = physicalStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the closure details." };
  const admin = await createAdminSessionClient();

  if (parsed.data.open) {
    const { error } = await admin
      .from("app_settings")
      .update({
        physical_open: true,
        physical_closure_reason_code: null,
        physical_closure_note: null,
        physical_closed_until: null,
      })
      .eq("id", 1);
    if (error) return { ok: false, error: "Could not reopen the café." };
    await audit(admin, profile.id, "store.physical_opened", {});
    refresh();
    return { ok: true };
  }

  if (!parsed.data.reasonCode) {
    return { ok: false, error: "Choose a closure reason for the café." };
  }
  const physFields = closureFields(
    "physical_",
    parsed.data.reasonCode,
    parsed.data.note,
    parsed.data.until
  );
  if (!physFields.ok) return physFields;

  let patch: Record<string, unknown> = { ...physFields.patch };

  // Combined closure: also close the webstore in the same update.
  if (parsed.data.webstore) {
    const w = parsed.data.webstore;
    const webFields = closureFields("", w.reasonCode, w.note, w.until);
    if (!webFields.ok) return webFields;
    patch = {
      ...patch,
      ...webFields.patch,
      high_demand: false,
      high_demand_minutes: null,
      high_demand_until: null,
    };
  }

  const { error } = await admin.from("app_settings").update(patch).eq("id", 1);
  if (error) return { ok: false, error: "Could not close the café." };
  await audit(admin, profile.id, "store.physical_closed", patch);
  refresh();
  return { ok: true };
}
```

- [ ] **Step 4: Replace the old `setStoreOpen`/`setStoreClosed` with thin wrappers**

Delete the bodies of `setStoreOpen` and `setStoreClosed` and replace with wrappers so the modal keeps compiling until Task 4:

```ts
export async function setStoreOpen(): Promise<StoreActionResult> {
  return setWebstoreStatus({ open: true });
}

export async function setStoreClosed(
  input: { reasonCode: ClosureReasonCode; note?: string; until?: string | null }
): Promise<StoreActionResult> {
  return setWebstoreStatus({ open: false, ...input });
}
```

(Remove the now-unused `closedSchema` if nothing references it.)

- [ ] **Step 5: Lint + build**

Run: `npm run lint`
Expected: no errors in the file.
Run: `npm run build`
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add app/workspace/availability/actions.ts
git commit -m "feat: webstore + physical-store + combined-closure server actions"
```

---

### Task 4: Duration picker + full modal rewrite (physical, webstore, combined, high demand)

**Files:**
- Create: `components/admin/DurationPicker.tsx`
- Modify: `components/admin/StoreAvailabilityModal.tsx` (full rewrite)
- Modify: `components/admin/StoreAvailabilityControl.tsx` (dot/label severity for both services)

**Interfaces:**
- Consumes: `setWebstoreStatus`, `setPhysicalStatus`, `setHighDemand`; `resolveClosedUntil`, `DurationChoice`, `REASON_CODES`, `closureLabel`, constants, `StoreAvailability`.
- Produces: `DurationPicker` (controlled `{ value: DurationChoice; onChange }`), the rewritten modal, control severity.

No unit test (UI); verified by `npm run lint` + `npm run build` + manual checklist.

- [ ] **Step 1: Create `components/admin/DurationPicker.tsx`**

```tsx
"use client";

import type { DurationChoice } from "@/lib/store-availability";

const PRESETS: { label: string; choice: DurationChoice }[] = [
  { label: "Until I reopen", choice: { kind: "manual" } },
  { label: "Today only", choice: { kind: "today" } },
  { label: "Until tomorrow", choice: { kind: "tomorrow" } },
  { label: "30 min", choice: { kind: "preset", minutes: 30 } },
  { label: "1 hour", choice: { kind: "preset", minutes: 60 } },
  { label: "2 hours", choice: { kind: "preset", minutes: 120 } },
  { label: "4 hours", choice: { kind: "preset", minutes: 240 } },
];

function sameChoice(a: DurationChoice, b: DurationChoice): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "preset" && b.kind === "preset") return a.minutes === b.minutes;
  return a.kind !== "specific";
}

// `min` for the datetime input: now, in the browser's local wall clock.
function localNowValue(): string {
  const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
}

export function DurationPicker({
  value,
  onChange,
  disabled,
}: {
  value: DurationChoice;
  onChange: (choice: DurationChoice) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-zb-cream">How long?</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {PRESETS.map((p) => {
          const active = sameChoice(value, p.choice);
          return (
            <button
              key={p.label}
              type="button"
              disabled={disabled}
              onClick={() => onChange(p.choice)}
              className={`rounded-full border px-4 py-1.5 text-sm transition disabled:opacity-40 ${
                active
                  ? "border-zb-bone bg-zb-bone/15 text-zb-cream"
                  : "border-zb-sage/35 text-zb-cream/80 hover:border-zb-bone"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <label className="mt-3 block text-xs text-zb-cream/55">
        Or pick a specific day &amp; time
        <input
          type="datetime-local"
          min={localNowValue()}
          disabled={disabled}
          value={value.kind === "specific" && value.iso
            ? new Date(value.iso).toISOString().slice(0, 16)
            : ""}
          onChange={(e) =>
            onChange(
              e.target.value
                ? { kind: "specific", iso: new Date(e.target.value).toISOString() }
                : { kind: "manual" }
            )
          }
          className="mt-1 h-11 w-full rounded-xl border border-zb-sage/35 bg-zb-primary-dark/65 px-3 text-sm text-zb-cream focus:border-zb-bone focus:outline-none disabled:opacity-40"
        />
      </label>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `components/admin/StoreAvailabilityModal.tsx`**

Replace the entire file with the version below. It keeps the High Demand section as-is, adds a **Physical Store** section (Open / Close with "also close webstore" choice) and a **Webstore** section, each using a shared reason `Select` + `DurationPicker`. Closure choices resolve to an ISO `until` via `resolveClosedUntil` before calling the action.

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Minus, Plus, X } from "lucide-react";
import { Select } from "@base-ui/react/select";
import {
  setHighDemand,
  setPhysicalStatus,
  setWebstoreStatus,
} from "@/app/workspace/availability/actions";
import { DurationPicker } from "@/components/admin/DurationPicker";
import {
  closureLabel,
  resolveClosedUntil,
  HIGH_DEMAND_DEFAULT_MINUTES,
  HIGH_DEMAND_MAX_MINUTES,
  HIGH_DEMAND_MIN_MINUTES,
  HIGH_DEMAND_STEP_MINUTES,
  HIGH_DEMAND_WINDOW_MINUTES,
  type ClosureReasonCode,
  type DurationChoice,
  type StoreAvailability,
} from "@/lib/store-availability";

const REASONS: { value: ClosureReasonCode; label: string }[] = [
  { value: "end_of_hours", label: "End of operating hours" },
  { value: "maintenance", label: "Temporary maintenance" },
  { value: "staff", label: "Staff unavailable" },
  { value: "inventory", label: "Inventory shortage" },
  { value: "emergency", label: "Emergency issue" },
  { value: "high_volume", label: "High order volume" },
  { value: "custom", label: "Custom reason" },
];

function ReasonSelect({
  value,
  onChange,
  disabled,
}: {
  value: ClosureReasonCode;
  onChange: (v: ClosureReasonCode) => void;
  disabled?: boolean;
}) {
  return (
    <Select.Root
      items={REASONS}
      value={value}
      onValueChange={(v) => onChange(v as ClosureReasonCode)}
      disabled={disabled}
    >
      <Select.Trigger className="group flex h-12 w-full items-center rounded-xl border border-zb-sage/35 bg-zb-primary-dark/65 px-4 text-left text-sm text-zb-cream outline-none transition hover:border-zb-sage data-[popup-open]:border-zb-bone">
        <Select.Value placeholder="Choose a reason" className="flex-1" />
        <ChevronDown className="ml-3 size-4 text-zb-cream/50 transition group-data-[popup-open]:rotate-180" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={8} className="z-[70]">
          <Select.Popup className="w-[var(--anchor-width)] rounded-2xl border border-zb-bone/45 bg-zb-primary-dark p-2 text-zb-cream shadow-2xl outline-none">
            <Select.List>
              {REASONS.map((r) => (
                <Select.Item
                  key={r.value}
                  value={r.value}
                  className="grid min-h-10 cursor-default grid-cols-[1fr_auto] items-center rounded-xl px-3 text-sm text-zb-cream/75 outline-none data-[highlighted]:bg-zb-sage/25 data-[highlighted]:text-zb-cream data-[selected]:bg-zb-bone data-[selected]:font-semibold data-[selected]:text-zb-primary-dark"
                >
                  <Select.ItemText>{r.label}</Select.ItemText>
                  <Select.ItemIndicator className="ml-3">
                    <Check className="size-4" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

const inputClass =
  "h-12 w-full rounded-xl border border-zb-sage/35 bg-zb-primary-dark/65 px-4 text-sm text-zb-cream placeholder:text-zb-cream/35 focus:border-zb-bone focus:outline-none";

export function StoreAvailabilityModal({
  state,
  onClose,
}: {
  state: StoreAvailability;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Webstore close form
  const [webEditing, setWebEditing] = useState(false);
  const [webReason, setWebReason] = useState<ClosureReasonCode>(
    state.closureReasonCode ?? "end_of_hours"
  );
  const [webNote, setWebNote] = useState(state.closureNote ?? "");
  const [webDuration, setWebDuration] = useState<DurationChoice>({ kind: "manual" });

  // Physical close form
  const [physEditing, setPhysEditing] = useState(false);
  const [alsoWebstore, setAlsoWebstore] = useState(false);
  const [physReason, setPhysReason] = useState<ClosureReasonCode>(
    state.physicalReasonCode ?? "end_of_hours"
  );
  const [physNote, setPhysNote] = useState(state.physicalNote ?? "");
  const [physDuration, setPhysDuration] = useState<DurationChoice>({ kind: "manual" });

  // High demand
  const [minutes, setMinutes] = useState(
    state.prepBufferMinutes || HIGH_DEMAND_DEFAULT_MINUTES
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "Something went wrong.");
      else {
        router.refresh();
        onClose();
      }
    });
  }

  function resolveOrError(choice: DurationChoice): string | null | undefined {
    const r = resolveClosedUntil(choice);
    if (!r.ok) {
      setError(r.error);
      return undefined; // signal failure
    }
    return r.value;
  }

  function submitWebstoreClose() {
    const until = resolveOrError(webDuration);
    if (until === undefined && webDuration.kind === "specific") return;
    run(() =>
      setWebstoreStatus({
        open: false,
        reasonCode: webReason,
        note: webReason === "custom" ? webNote || undefined : undefined,
        until: until ?? null,
      })
    );
  }

  function submitPhysicalClose() {
    const until = resolveOrError(physDuration);
    if (until === undefined && physDuration.kind === "specific") return;
    let webstore;
    if (alsoWebstore) {
      const webUntil = resolveOrError(webDuration);
      if (webUntil === undefined && webDuration.kind === "specific") return;
      webstore = {
        reasonCode: webReason,
        note: webReason === "custom" ? webNote || undefined : undefined,
        until: webUntil ?? null,
      };
    }
    run(() =>
      setPhysicalStatus({
        open: false,
        reasonCode: physReason,
        note: physReason === "custom" ? physNote || undefined : undefined,
        until: until ?? null,
        webstore,
      })
    );
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onMouseDown={(e) => e.currentTarget === e.target && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Update store status"
        className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-zb-sage/25 bg-zb-primary-strong shadow-2xl sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-zb-sage/20 px-5 py-4">
          <div>
            <h2 className="font-display text-2xl text-zb-cream">Store status</h2>
            <p className="mt-1 text-sm text-zb-cream/55">
              Café {state.physicalOpen ? "open" : "closed"} · Webstore{" "}
              {state.isOpen ? "open" : "closed"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="grid size-9 place-items-center rounded-full border border-zb-sage/25 text-zb-cream/60 transition hover:bg-zb-primary hover:text-zb-cream"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {/* PHYSICAL STORE */}
          <section className="rounded-2xl border border-zb-sage/25 bg-zb-primary-dark/35 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={`size-3 rounded-full ${state.physicalOpen ? "bg-emerald-400" : "bg-zb-danger"}`}
                />
                <span className="font-semibold text-zb-cream">Physical store</span>
              </div>
              {state.physicalOpen ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setPhysEditing((v) => !v)}
                  className="rounded-lg border border-zb-bone/45 px-3 py-1 text-sm font-semibold text-zb-bone transition hover:bg-zb-bone/10 disabled:opacity-50"
                >
                  Close café
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => setPhysicalStatus({ open: true }))}
                  className="rounded-lg border border-emerald-400/60 px-3 py-1 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/10 disabled:opacity-50"
                >
                  Reopen café
                </button>
              )}
            </div>
            <p className="mt-1 pl-5 text-sm text-zb-cream/60">
              {state.physicalOpen
                ? "Open for walk-in customers"
                : state.physicalLabel ?? "Closed for walk-ins"}
            </p>

            {state.physicalOpen && physEditing && (
              <div className="mt-4 space-y-3">
                <ReasonSelect value={physReason} onChange={setPhysReason} disabled={pending} />
                {physReason === "custom" && (
                  <input
                    value={physNote}
                    onChange={(e) => setPhysNote(e.target.value)}
                    maxLength={200}
                    placeholder="Tell customers why (shown on the storefront)"
                    className={inputClass}
                  />
                )}
                <DurationPicker value={physDuration} onChange={setPhysDuration} disabled={pending} />

                <label className="flex items-center gap-2 text-sm text-zb-cream">
                  <input
                    type="checkbox"
                    checked={alsoWebstore}
                    onChange={(e) => setAlsoWebstore(e.target.checked)}
                    className="accent-zb-bone"
                  />
                  Also close the webstore (online ordering)
                </label>

                {alsoWebstore && (
                  <div className="space-y-3 rounded-xl border border-zb-danger/30 bg-zb-danger/5 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zb-cream/55">
                      Webstore closure
                    </p>
                    <ReasonSelect value={webReason} onChange={setWebReason} disabled={pending} />
                    {webReason === "custom" && (
                      <input
                        value={webNote}
                        onChange={(e) => setWebNote(e.target.value)}
                        maxLength={200}
                        placeholder="Webstore reason (shown to customers)"
                        className={inputClass}
                      />
                    )}
                    <DurationPicker value={webDuration} onChange={setWebDuration} disabled={pending} />
                  </div>
                )}

                <button
                  type="button"
                  disabled={pending}
                  onClick={submitPhysicalClose}
                  className="w-full rounded-xl bg-zb-danger py-2.5 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {alsoWebstore ? "Close café & webstore" : "Close café"}
                </button>
              </div>
            )}
          </section>

          {/* WEBSTORE */}
          <section className="rounded-2xl border border-zb-sage/25 bg-zb-primary-dark/35 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={`size-3 rounded-full ${state.isOpen ? "bg-emerald-400" : "bg-zb-danger"}`}
                />
                <span className="font-semibold text-zb-cream">Webstore</span>
              </div>
              {state.isOpen ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setWebEditing((v) => !v)}
                  className="rounded-lg border border-zb-bone/45 px-3 py-1 text-sm font-semibold text-zb-bone transition hover:bg-zb-bone/10 disabled:opacity-50"
                >
                  Close webstore
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => setWebstoreStatus({ open: true }))}
                  className="rounded-lg border border-emerald-400/60 px-3 py-1 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/10 disabled:opacity-50"
                >
                  Reopen webstore
                </button>
              )}
            </div>
            <p className="mt-1 pl-5 text-sm text-zb-cream/60">
              {state.isOpen
                ? "Receiving online orders as usual"
                : state.closureLabel ?? "Online ordering paused"}
            </p>

            {state.isOpen && webEditing && (
              <div className="mt-4 space-y-3">
                <ReasonSelect value={webReason} onChange={setWebReason} disabled={pending} />
                {webReason === "custom" && (
                  <input
                    value={webNote}
                    onChange={(e) => setWebNote(e.target.value)}
                    maxLength={200}
                    placeholder="Tell customers why (shown on the storefront)"
                    className={inputClass}
                  />
                )}
                <DurationPicker value={webDuration} onChange={setWebDuration} disabled={pending} />
                <button
                  type="button"
                  disabled={pending}
                  onClick={submitWebstoreClose}
                  className="w-full rounded-xl bg-zb-danger py-2.5 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  Close webstore
                </button>
              </div>
            )}
          </section>

          {/* HIGH DEMAND */}
          <section
            className={`rounded-2xl border p-4 transition ${
              state.highDemand ? "border-zb-bone/70 bg-zb-bone/10" : "border-zb-sage/25 bg-zb-primary-dark/35"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="block font-semibold text-zb-cream">High Demand mode</span>
                <span className="text-sm text-zb-cream/60">
                  Stay open with automatically increased preparation time
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={state.highDemand}
                aria-label="High demand mode"
                disabled={pending || !state.isOpen}
                onClick={() =>
                  state.highDemand
                    ? run(() => setHighDemand({ enabled: false }))
                    : run(() => setHighDemand({ enabled: true, minutes }))
                }
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                  state.highDemand ? "bg-emerald-500" : "bg-zb-primary/30"
                } disabled:opacity-40`}
              >
                <span
                  className={`absolute top-1 size-4 rounded-full bg-white shadow transition ${
                    state.highDemand ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>

            {state.isOpen && (
              <div className="mt-4">
                <p className="text-sm font-medium text-zb-cream">How much extra time do you need?</p>
                <div className="mt-2 rounded-xl border border-zb-bone/30 bg-zb-bone/10 px-3 py-2 text-xs leading-5 text-zb-cream/75">
                  For future orders only — this won&apos;t change the prep time of current orders.
                </div>
                <div className="mt-4 flex items-center justify-center gap-5">
                  <button
                    type="button"
                    aria-label="Decrease"
                    disabled={pending || minutes <= HIGH_DEMAND_MIN_MINUTES}
                    onClick={() => setMinutes((m) => Math.max(HIGH_DEMAND_MIN_MINUTES, m - HIGH_DEMAND_STEP_MINUTES))}
                    className="grid size-10 place-items-center rounded-full border border-zb-sage/30 text-zb-cream disabled:opacity-40"
                  >
                    <Minus className="size-4" />
                  </button>
                  <div className="text-center">
                    <span className="block font-display text-3xl text-zb-cream">{minutes}</span>
                    <span className="text-xs text-zb-cream/50">min</span>
                  </div>
                  <button
                    type="button"
                    aria-label="Increase"
                    disabled={pending || minutes >= HIGH_DEMAND_MAX_MINUTES}
                    onClick={() => setMinutes((m) => Math.min(HIGH_DEMAND_MAX_MINUTES, m + HIGH_DEMAND_STEP_MINUTES))}
                    className="grid size-10 place-items-center rounded-full border border-zb-sage/30 text-zb-cream disabled:opacity-40"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
                <p className="mt-3 text-center text-xs text-zb-cream/50">
                  Preparation time will be extended for the next {HIGH_DEMAND_WINDOW_MINUTES} minutes.
                </p>
                {state.highDemand && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => setHighDemand({ enabled: true, minutes }))}
                    className="mt-3 w-full rounded-xl border border-zb-bone/45 py-2 text-sm font-semibold text-zb-cream transition hover:bg-zb-bone/10"
                  >
                    Update extra time
                  </button>
                )}
              </div>
            )}
          </section>

          {error && (
            <p className="rounded-xl border border-zb-danger/45 bg-zb-danger/10 px-4 py-2 text-sm text-zb-cream">
              {error}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
```

Note: `closureLabel` import is used indirectly via state labels; if lint flags it as unused, remove it from the import.

- [ ] **Step 3: Update `StoreAvailabilityControl.tsx` severity**

Replace the `dot`/`label` derivation:

```tsx
  const bothClosed = !state.isOpen && !state.physicalOpen;
  const anyClosed = !state.isOpen || !state.physicalOpen;
  const dot = anyClosed ? "bg-zb-danger" : state.highDemand ? "bg-amber-400" : "bg-emerald-400";
  const label = bothClosed
    ? "Closed"
    : !state.isOpen
      ? "Webstore closed"
      : !state.physicalOpen
        ? "Café closed"
        : state.highDemand
          ? "High demand"
          : "Open";
```

- [ ] **Step 4: Lint + build**

Run: `npm run lint` → no errors in the new/changed files.
Run: `npm run build` → success.

- [ ] **Step 5: Manual verification checklist (deferred to controller/user — requires dev + migration 0044)**

- Modal shows Physical / Webstore / High Demand sections separately.
- Close café (keep webstore open): café dot red, webstore stays green; "Also close webstore" reveals a second reason+duration block.
- Duration presets + specific datetime (past blocked) set the reopen time.
- Reopen café / reopen webstore work; floating dot/label reflect severity.

- [ ] **Step 6: Commit**

```bash
git add components/admin/DurationPicker.tsx components/admin/StoreAvailabilityModal.tsx components/admin/StoreAvailabilityControl.tsx
git commit -m "feat: step-by-step modal for physical + webstore + duration, control severity"
```

---

### Task 5: Customer surface — notice + checkout on-site mode gating

**Files:**
- Modify: `components/shop/StoreClosedNotice.tsx`
- Modify: `app/(shop)/checkout/page.tsx` (pass physical props)
- Modify: `components/shop/CheckoutForm.tsx` (props + dine-in gating)

**Interfaces:**
- Consumes: `getStoreAvailability()` (now includes physical fields).
- Produces: `CheckoutForm` gains props `physicalOpen: boolean`, `physicalLabel: string | null`.

No unit test (RSC/UI); verified by `npm run lint` + `npm run build` + manual checklist.

- [ ] **Step 1: Rewrite `StoreClosedNotice.tsx` for the combinations**

Replace the body of the component (keep `formatUntil`):

```tsx
export async function StoreClosedNotice() {
  const state = await getStoreAvailability();

  if (!state.isOpen) {
    const until = formatUntil(state.closedUntil);
    const physClosed = !state.physicalOpen;
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-xl border border-zb-danger/50 bg-zb-danger/10 px-4 py-3 text-sm"
      >
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-zb-danger" />
        <div>
          <p className="font-semibold text-zb-cream">
            {physClosed
              ? "We're currently closed"
              : "Online ordering is currently unavailable"}
          </p>
          <p className="mt-0.5 leading-6 text-zb-cream/80">
            {state.closureLabel ? `${state.closureLabel}. ` : ""}
            {physClosed
              ? "Both our café and online ordering are paused"
              : "You can still visit us in person — only online orders are paused"}
            {until ? ` until around ${until}` : " for now"}.
          </p>
        </div>
      </div>
    );
  }

  if (!state.physicalOpen) {
    const until = formatUntil(state.physicalClosedUntil);
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-xl border border-zb-bone/50 bg-zb-bone/10 px-4 py-3 text-sm"
      >
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-zb-bone" />
        <div>
          <p className="font-semibold text-zb-bone">Our café is closed for walk-ins</p>
          <p className="mt-0.5 leading-6 text-zb-cream/80">
            {state.physicalLabel ? `${state.physicalLabel}. ` : ""}
            Online ordering is still open — pickup and delivery are available
            {until ? ` until we reopen around ${until}` : ""}.
          </p>
        </div>
      </div>
    );
  }

  if (state.highDemand) {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-xl border border-zb-bone/50 bg-zb-bone/10 px-4 py-3 text-sm"
      >
        <Clock3 className="mt-0.5 size-5 shrink-0 text-zb-bone" />
        <div>
          <p className="font-semibold text-zb-bone">Busier than usual</p>
          <p className="mt-0.5 leading-6 text-zb-cream/80">
            Orders are taking a little longer right now — thanks for your patience.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
```

- [ ] **Step 2: Pass physical props from `app/(shop)/checkout/page.tsx`**

The page already reads `storeAvailability`. Add to the `<CheckoutForm ... />` props:

```tsx
            webstoreOpen={storeAvailability.isOpen}
            closureLabel={storeAvailability.closureLabel}
            closedUntil={storeAvailability.closedUntil}
            prepBufferMinutes={storeAvailability.prepBufferMinutes}
            physicalOpen={storeAvailability.physicalOpen}
            physicalLabel={storeAvailability.physicalLabel}
```

- [ ] **Step 3: Add props + dine-in gating in `components/shop/CheckoutForm.tsx`**

(a) Extend the props type/destructuring (after `prepBufferMinutes`):

```ts
  prepBufferMinutes,
  physicalOpen,
  physicalLabel,
}: {
  // ...existing...
  prepBufferMinutes: number;
  physicalOpen: boolean;
  physicalLabel: string | null;
}) {
```

(b) When the café is closed, dine-in is unavailable. Add a single derived const alongside the other derived values (e.g. near `const isTakeOut = ...`):

```ts
  const dineInAvailable = physicalOpen;
```

No state-switching is needed: `mode` already defaults to `"pickup"` (`useState<ServiceMode>("pickup")`), and the dine-in button is filtered out below when `!dineInAvailable`, so a user cannot select dine-in while the café is closed. `physicalOpen` is a server-rendered prop, so it only changes on navigation/refresh (a fresh mount resets `mode` to `"pickup"`). Do NOT add a `setMode` effect or a render-time `setMode` — both would trip the project's `react-hooks/set-state-in-effect` lint rule.

(c) In the SERVICE MODE section, filter the dine-in top option and show a note. Replace the `topModes.map(...)` opening to skip dine-in when unavailable, and add a note under the grid:

Change the top-modes grid to:

```tsx
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {topModes
              .filter((entry) => dineInAvailable || entry.value !== "dine_in")
              .map((entry) => {
```

And immediately after that grid's closing `</div>` (before the `{isTakeOut && (` block), add:

```tsx
          {!dineInAvailable && (
            <p className="mt-3 rounded-xl border border-zb-bone/30 bg-zb-bone/10 px-3 py-2 text-xs leading-5 text-zb-cream/75">
              {physicalLabel ? `${physicalLabel}. ` : ""}Dine-in is unavailable
              while our café is closed — pickup and delivery are still open.
            </p>
          )}
```

- [ ] **Step 4: Lint + build**

Run: `npm run lint` → no errors; confirm `physicalOpen`/`physicalLabel` are used.
Run: `npm run build` → success.

- [ ] **Step 5: Manual verification checklist (deferred)**

- Physical closed (webstore open): `/menu` & `/cart` show "café closed for walk-ins"; checkout hides Dine-in, defaults to pickup, shows the note; pickup/delivery work.
- Webstore closed: online-unavailable gate (existing); if physical also closed, the notice says both are closed.
- High demand still works independently (buffer in pickup slots).

- [ ] **Step 6: Commit**

```bash
git add "components/shop/StoreClosedNotice.tsx" "app/(shop)/checkout/page.tsx" "components/shop/CheckoutForm.tsx"
git commit -m "feat: customer notices for physical/both closure and dine-in gating"
```

---

## Final verification

- [ ] Run `npm test` → all suites pass (smoke, staff-roles, checkout-slots, store-availability, duration).
- [ ] Run `npm run lint && npm run build` → both succeed.
- [ ] Apply `supabase/migrations/0044_physical_store_status.sql` to Supabase (manual; feature inert until applied). Verify a physical-close / combined-close / reopen round-trip and that `get_store_availability()` returns the new columns.

## Notes for the implementer

- `accepting_orders=false` is still enforced in `place_order` (hard webstore backstop). Physical-store closure is UX-layer only (no DB ordering enforcement) — it just hides on-site modes and shows notices.
- The reason set is shared by both statuses; "High order volume" is a *closure* reason and is distinct from High Demand mode (which keeps the store open with a longer ETA).
- Representation deviation from the spec ("nested"): this plan uses flat additive fields (`physical*`) on `StoreAvailability` to keep each task's build green. Functionally equivalent.
