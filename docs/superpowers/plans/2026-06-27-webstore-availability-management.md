# Webstore Availability Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give staff a floating workspace control to set the webstore Open/Closed (with reason + auto-reopen) and a time-bound High Demand mode, and surface the closed/high-demand state to customers while blocking ordering.

**Architecture:** Reuse the singleton `app_settings` row (extending it with closure + high-demand columns) as the source of truth; a `SECURITY DEFINER` RPC reads it for customers and auto-clears expired closures/high-demand. Staff mutate it through permission-gated server actions written with the admin session client. A client modal (floating button) drives those actions; server-rendered notices and a checkout gate reflect the state to customers.

**Tech Stack:** Next.js 16 (App Router, RSC), React 19, TypeScript (strict), Supabase (Postgres + RLS), Base UI (`@base-ui/react`), Tailwind v4, Zod v4. Tests: Vitest (added in Task 1).

## Global Constraints

- This is a customized Next.js — consult `node_modules/next/dist/docs/` before using framework APIs; heed deprecation notices (per `AGENTS.md`).
- Path alias: `@/*` → repo root (`tsconfig.json`).
- Server-only modules import `"server-only"` and must NOT be imported by Vitest tests; keep all unit-tested logic in modules with no `"server-only"` / no Supabase import.
- DB writes from server actions use `createAdminSessionClient()` (`@/lib/supabase/admin-session`); customer reads use the anon server client (`@/lib/supabase/server` → `createClient`).
- Action result shape mirrors `MenuActionResult`: `{ ok: true; message?: string } | { ok: false; error: string }`.
- Theme tokens: `zb-primary`, `zb-primary-strong`, `zb-primary-dark`, `zb-cream`, `zb-bone`, `zb-bone-soft`, `zb-sage`, `zb-danger`. Use these, not raw colors.
- Permission strings are the `StaffPermission` union; gate staff actions with `requireStaffPermission(...)` and UI with `hasStaffPermission(profile, ...)`.
- Timezone for all store-time math is `Asia/Manila` (see `lib/checkout.ts`).
- Migrations are numbered SQL files in `supabase/migrations/`; they are applied to Supabase manually (note this at hand-off — the feature is inert until migration `0043` is applied).
- High-demand stepper: min 5, max 60, step 5, default 15 minutes; auto-expiry window 30 minutes.
- Reason codes: `today | temporary | kitchen | inventory | maintenance | custom`.

---

### Task 1: Add Vitest test runner

**Files:**
- Modify: `package.json` (scripts + devDependency)
- Create: `vitest.config.ts`
- Create: `tests/unit/smoke.test.ts`

**Interfaces:**
- Produces: a working `npm test` command running `tests/unit/**/*.test.ts`, with `@/*` resolving to repo root.

- [ ] **Step 1: Install Vitest**

Run: `npm install -D vitest@^3`
Expected: `vitest` added under devDependencies; lockfile updates.

- [ ] **Step 2: Create the Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
```

- [ ] **Step 3: Add test scripts**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write a smoke test**

Create `tests/unit/smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";

describe("vitest", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run the smoke test**

Run: `npm test`
Expected: PASS — 1 passed.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests/unit/smoke.test.ts
git commit -m "test: add Vitest runner for unit tests"
```

---

### Task 2: Database migration — store availability columns + read RPC

**Files:**
- Create: `supabase/migrations/0043_store_availability.sql`

**Interfaces:**
- Produces: `app_settings` columns `closure_reason_code text`, `closure_note text`, `closed_until timestamptz`, `high_demand boolean not null default false`, `high_demand_minutes int`, `high_demand_until timestamptz`; SQL functions `refresh_expired_store_availability()` and `get_store_availability()` (returns one row of the fields below), executable by `anon, authenticated`.

This task has no unit test (SQL); it is verified by review and applied manually to Supabase. Keep the SQL self-consistent with the columns consumed in Tasks 4–5.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0043_store_availability.sql`:

```sql
-- Webstore availability: manual Open/Closed override (layered on top of the
-- time-based operating hours) plus a time-bound High Demand mode. Reuses the
-- singleton app_settings row; accepting_orders is the master Open/Closed switch
-- (already enforced in place_order).

alter table app_settings
  add column if not exists closure_reason_code text
    check (closure_reason_code in
      ('today','temporary','kitchen','inventory','maintenance','custom')),
  add column if not exists closure_note text,
  add column if not exists closed_until timestamptz,
  add column if not exists high_demand boolean not null default false,
  add column if not exists high_demand_minutes int,
  add column if not exists high_demand_until timestamptz;

-- Auto-clears expired states so the store reopens / leaves high-demand on its
-- own. Mirrors refresh_expired_menu_item_availability.
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
  set high_demand = false,
      high_demand_minutes = null,
      high_demand_until = null
  where id = 1
    and high_demand = true
    and high_demand_until is not null
    and high_demand_until <= now();
end;
$$;

-- Narrow public read for the storefront. Refreshes expiries first, then returns
-- only the availability fields (no other app_settings columns leak to anon).
create or replace function get_store_availability()
returns table (
  accepting_orders boolean,
  closure_reason_code text,
  closure_note text,
  closed_until timestamptz,
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
         s.high_demand,
         s.high_demand_minutes,
         s.high_demand_until
  from app_settings s
  where s.id = 1;
end;
$$;

grant execute on function get_store_availability() to anon, authenticated;
grant execute on function refresh_expired_store_availability() to anon, authenticated;
```

- [ ] **Step 2: Review against existing patterns**

Run: `git show 0040_storefront_availability_rpc.sql:supabase/migrations/0040_storefront_availability_rpc.sql 2>/dev/null || cat supabase/migrations/0040_storefront_availability_rpc.sql`
Expected: confirm the new RPC mirrors the `SECURITY DEFINER` + `set search_path = public` + `grant execute ... to anon, authenticated` pattern.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0043_store_availability.sql
git commit -m "feat(db): add webstore availability columns and read RPC"
```

---

### Task 3: Permission — `store:availability`

**Files:**
- Modify: `lib/staff-roles.ts`
- Modify: `components/admin/StaffPermissionsForm.tsx:27` (SECTIONS) and `:33-40` (SECTION_META)
- Test: `tests/unit/staff-roles.test.ts`

**Interfaces:**
- Produces: `"store:availability"` as a member of `StaffPermission`; a `GRANTABLE_PERMISSIONS` entry with `section: "Store"`; `GrantablePermission["section"]` now includes `"Store"`.
- Consumes: existing `isStaffPermission`, `resolvePermissions`, `roleDefaultPermissions`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/staff-roles.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  GRANTABLE_PERMISSIONS,
  isStaffPermission,
  resolvePermissions,
  roleDefaultPermissions,
} from "@/lib/staff-roles";

describe("store:availability permission", () => {
  it("is a recognized staff permission", () => {
    expect(isStaffPermission("store:availability")).toBe(true);
  });

  it("is grantable under the Store section", () => {
    const entry = GRANTABLE_PERMISSIONS.find(
      (p) => p.permission === "store:availability"
    );
    expect(entry?.section).toBe("Store");
  });

  it("is not a cashier default", () => {
    expect(roleDefaultPermissions("cashier")).not.toContain(
      "store:availability"
    );
  });

  it("can be granted via an override", () => {
    const resolved = resolvePermissions("cashier", [
      { permission: "store:availability", granted: true },
    ]);
    expect(resolved).toContain("store:availability");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- staff-roles`
Expected: FAIL — `isStaffPermission("store:availability")` is `false` / no Store entry.

- [ ] **Step 3: Add the permission to the union and key record**

In `lib/staff-roles.ts`, add to the `StaffPermission` union (after `team:manage`):

```ts
  | "team:manage"
  | "store:availability"
  | "deliveries:view"
```

Add to `PERMISSION_KEYS`:

```ts
  "team:manage": true,
  "store:availability": true,
  "deliveries:view": true,
```

- [ ] **Step 4: Add the Store section and grantable entry**

In `lib/staff-roles.ts`, extend the `GrantablePermission.section` union:

```ts
  section: "Dashboard" | "Orders" | "Menu" | "Store";
```

Append to `GRANTABLE_PERMISSIONS` (after the menu entries):

```ts
  {
    permission: "store:availability",
    section: "Store",
    label: "Manage store availability",
    description:
      "Open or close the webstore and toggle high-demand mode.",
  },
```

- [ ] **Step 5: Register the section in the permissions form**

In `components/admin/StaffPermissionsForm.tsx`, add `Store` to `SECTIONS` (line 27):

```ts
const SECTIONS = ["Dashboard", "Orders", "Menu", "Store"] as const;
```

Add a `Store` icon to the imports (line 4-11), e.g. `Power`:

```ts
  LayoutDashboard,
  Power,
  ReceiptText,
```

Add to `SECTION_META`:

```ts
  Menu: { icon: UtensilsCrossed },
  Store: { icon: Power },
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -- staff-roles`
Expected: PASS — 4 passed.

- [ ] **Step 7: Typecheck/lint the form change**

Run: `npm run lint`
Expected: no errors in `staff-roles.ts` / `StaffPermissionsForm.tsx`.

- [ ] **Step 8: Commit**

```bash
git add lib/staff-roles.ts components/admin/StaffPermissionsForm.tsx tests/unit/staff-roles.test.ts
git commit -m "feat: add grantable store:availability permission"
```

---

### Task 4: Pure availability logic (`lib/store-availability.ts`)

**Files:**
- Create: `lib/store-availability.ts`
- Test: `tests/unit/store-availability.test.ts`

**Interfaces:**
- Produces (pure, no `"server-only"`, no Supabase import):
  - Constants: `HIGH_DEMAND_MIN_MINUTES = 5`, `HIGH_DEMAND_MAX_MINUTES = 60`, `HIGH_DEMAND_STEP_MINUTES = 5`, `HIGH_DEMAND_DEFAULT_MINUTES = 15`, `HIGH_DEMAND_WINDOW_MINUTES = 30`.
  - Types: `ClosureReasonCode`, `StoreAvailabilityRow`, `StoreAvailability`.
  - `clampHighDemandMinutes(value: number): number`
  - `closureLabel(code: ClosureReasonCode | null, note: string | null): string | null`
  - `resolveStoreAvailability(row: StoreAvailabilityRow, now?: Date): StoreAvailability`
- Consumed by: Task 5 (actions), Task 7 (modal), Task 8 (notice + checkout).

`resolveStoreAvailability` applies expiry in-memory (so the resolver is correct even before the DB refresh runs) and derives `isOpen`, the resolved label, `highDemand` (active only while not expired), and `prepBufferMinutes`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/store-availability.test.ts`:

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
  high_demand: false,
  high_demand_minutes: null,
  high_demand_until: null,
};

const now = new Date("2026-06-27T10:00:00Z");

describe("clampHighDemandMinutes", () => {
  it("clamps below the floor", () => {
    expect(clampHighDemandMinutes(2)).toBe(5);
  });
  it("clamps above the ceiling", () => {
    expect(clampHighDemandMinutes(999)).toBe(60);
  });
  it("passes through in-range values", () => {
    expect(clampHighDemandMinutes(20)).toBe(20);
  });
});

describe("closureLabel", () => {
  it("maps known codes", () => {
    expect(closureLabel("kitchen", null)).toBe("Kitchen unavailable");
  });
  it("uses the note for custom", () => {
    expect(closureLabel("custom", "Burst pipe")).toBe("Burst pipe");
  });
  it("returns null when open", () => {
    expect(closureLabel(null, null)).toBeNull();
  });
});

describe("resolveStoreAvailability", () => {
  it("reports open with no buffer by default", () => {
    const r = resolveStoreAvailability(base, now);
    expect(r.isOpen).toBe(true);
    expect(r.prepBufferMinutes).toBe(0);
    expect(r.highDemand).toBe(false);
  });

  it("reports closed with a resolved label", () => {
    const r = resolveStoreAvailability(
      { ...base, accepting_orders: false, closure_reason_code: "maintenance" },
      now
    );
    expect(r.isOpen).toBe(false);
    expect(r.closureLabel).toBe("Under maintenance");
  });

  it("auto-reopens when closed_until has passed", () => {
    const r = resolveStoreAvailability(
      {
        ...base,
        accepting_orders: false,
        closure_reason_code: "today",
        closed_until: "2026-06-27T09:00:00Z",
      },
      now
    );
    expect(r.isOpen).toBe(true);
    expect(r.closureLabel).toBeNull();
  });

  it("exposes the high-demand buffer while active", () => {
    const r = resolveStoreAvailability(
      {
        ...base,
        high_demand: true,
        high_demand_minutes: 20,
        high_demand_until: "2026-06-27T10:20:00Z",
      },
      now
    );
    expect(r.highDemand).toBe(true);
    expect(r.prepBufferMinutes).toBe(20);
  });

  it("ignores expired high demand", () => {
    const r = resolveStoreAvailability(
      {
        ...base,
        high_demand: true,
        high_demand_minutes: 20,
        high_demand_until: "2026-06-27T09:30:00Z",
      },
      now
    );
    expect(r.highDemand).toBe(false);
    expect(r.prepBufferMinutes).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- store-availability`
Expected: FAIL — cannot find module `@/lib/store-availability`.

- [ ] **Step 3: Implement the pure module**

Create `lib/store-availability.ts`:

```ts
export const HIGH_DEMAND_MIN_MINUTES = 5;
export const HIGH_DEMAND_MAX_MINUTES = 60;
export const HIGH_DEMAND_STEP_MINUTES = 5;
export const HIGH_DEMAND_DEFAULT_MINUTES = 15;
export const HIGH_DEMAND_WINDOW_MINUTES = 30;

export type ClosureReasonCode =
  | "today"
  | "temporary"
  | "kitchen"
  | "inventory"
  | "maintenance"
  | "custom";

export type StoreAvailabilityRow = {
  accepting_orders: boolean;
  closure_reason_code: ClosureReasonCode | null;
  closure_note: string | null;
  closed_until: string | null;
  high_demand: boolean;
  high_demand_minutes: number | null;
  high_demand_until: string | null;
};

export type StoreAvailability = {
  isOpen: boolean;
  closureReasonCode: ClosureReasonCode | null;
  closureLabel: string | null;
  closureNote: string | null;
  closedUntil: string | null;
  highDemand: boolean;
  highDemandUntil: string | null;
  prepBufferMinutes: number;
};

const CLOSURE_LABELS: Record<ClosureReasonCode, string> = {
  today: "Unavailable for today",
  temporary: "Temporarily closed",
  kitchen: "Kitchen unavailable",
  inventory: "Inventory shortage",
  maintenance: "Under maintenance",
  custom: "Temporarily closed",
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

export function resolveStoreAvailability(
  row: StoreAvailabilityRow,
  now: Date = new Date()
): StoreAvailability {
  // Mirror the DB refresh in-memory so the UI is correct before the next read.
  const reopened = !row.accepting_orders && isPast(row.closed_until, now);
  const isOpen = row.accepting_orders || reopened;

  const closed = !isOpen;
  const reasonCode = closed ? row.closure_reason_code : null;

  const highDemandActive =
    row.high_demand && !isPast(row.high_demand_until, now);
  const prepBufferMinutes = highDemandActive
    ? row.high_demand_minutes ?? 0
    : 0;

  return {
    isOpen,
    closureReasonCode: reasonCode,
    closureLabel: closureLabel(reasonCode, row.closure_note),
    closureNote: closed ? row.closure_note : null,
    closedUntil: closed ? row.closed_until : null,
    highDemand: highDemandActive,
    highDemandUntil: highDemandActive ? row.high_demand_until : null,
    prepBufferMinutes,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- store-availability`
Expected: PASS — all assertions green.

- [ ] **Step 5: Commit**

```bash
git add lib/store-availability.ts tests/unit/store-availability.test.ts
git commit -m "feat: add pure store-availability resolver and constants"
```

---

### Task 5: Server reader + actions

**Files:**
- Create: `lib/store-availability-data.ts` (server-only reader)
- Create: `app/workspace/availability/actions.ts` (server actions)

**Interfaces:**
- Consumes: `resolveStoreAvailability`, `clampHighDemandMinutes`, `HIGH_DEMAND_*` from `@/lib/store-availability`; `requireStaffPermission` from `@/lib/admin`; `createAdminSessionClient`; `createClient` (anon).
- Produces:
  - `getStoreAvailability(): Promise<StoreAvailability>` (reads via `get_store_availability` RPC, then `resolveStoreAvailability`).
  - Actions returning `StoreActionResult` (`{ ok: true } | { ok: false; error: string }`):
    - `setStoreOpen(): Promise<StoreActionResult>`
    - `setStoreClosed(input: { reasonCode: ClosureReasonCode; note?: string; until?: string | null }): Promise<StoreActionResult>`
    - `setHighDemand(input: { enabled: boolean; minutes?: number }): Promise<StoreActionResult>`

No unit test (touches Supabase + `server-only`); verified by `npm run build` + `npm run lint` and manual checks in Task 7/8. Keep the closed-duration/validation logic small and obvious.

- [ ] **Step 1: Implement the server reader**

Create `lib/store-availability-data.ts`:

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  resolveStoreAvailability,
  type StoreAvailability,
  type StoreAvailabilityRow,
} from "@/lib/store-availability";

const OPEN_FALLBACK: StoreAvailability = {
  isOpen: true,
  closureReasonCode: null,
  closureLabel: null,
  closureNote: null,
  closedUntil: null,
  highDemand: false,
  highDemandUntil: null,
  prepBufferMinutes: 0,
};

export async function getStoreAvailability(): Promise<StoreAvailability> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_store_availability");
  if (error || !data || data.length === 0) {
    if (error) console.error("[store-availability]", error.message);
    return OPEN_FALLBACK;
  }
  return resolveStoreAvailability(data[0] as StoreAvailabilityRow);
}
```

- [ ] **Step 2: Implement the server actions**

Create `app/workspace/availability/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { requireStaffPermission } from "@/lib/admin";
import { getCloseHour } from "@/lib/checkout";
import {
  clampHighDemandMinutes,
  HIGH_DEMAND_DEFAULT_MINUTES,
  HIGH_DEMAND_WINDOW_MINUTES,
  type ClosureReasonCode,
} from "@/lib/store-availability";
import { createAdminSessionClient } from "@/lib/supabase/admin-session";

export type StoreActionResult =
  | { ok: true }
  | { ok: false; error: string };

const reasonCode = z.enum([
  "today",
  "temporary",
  "kitchen",
  "inventory",
  "maintenance",
  "custom",
]);

const closedSchema = z.object({
  reasonCode,
  note: z.string().trim().max(200).optional(),
  until: z.union([z.iso.datetime(), z.null()]).optional(),
});

const highDemandSchema = z.object({
  enabled: z.boolean(),
  minutes: z.number().int().optional(),
});

function refresh() {
  revalidatePath("/workspace", "layout");
  revalidatePath("/menu");
  revalidatePath("/cart");
  revalidatePath("/checkout");
}

async function audit(
  actorId: string,
  action: string,
  diff: Record<string, unknown>
) {
  const admin = await createAdminSessionClient();
  const { error } = await admin.from("audit_logs").insert({
    actor_profile_id: actorId,
    action,
    target_table: "app_settings",
    target_id: "1",
    diff,
  });
  if (error) console.error("[store-availability] audit failed:", error.message);
}

// End of today's operating window in Asia/Manila, as an ISO timestamp.
function endOfSlotISO(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const closeHour = getCloseHour(dayMap[get("weekday")] ?? now.getDay());
  // Build the Manila wall-clock close time, then convert to UTC by comparing
  // the Manila offset. Manila has no DST (UTC+8), so a fixed offset is safe.
  const iso = `${get("year")}-${get("month")}-${get("day")}T${String(
    closeHour
  ).padStart(2, "0")}:00:00+08:00`;
  return new Date(iso).toISOString();
}

export async function setStoreOpen(): Promise<StoreActionResult> {
  const { profile } = await requireStaffPermission("store:availability");
  const admin = await createAdminSessionClient();
  const { error } = await admin
    .from("app_settings")
    .update({
      accepting_orders: true,
      closure_reason_code: null,
      closure_note: null,
      closed_until: null,
    })
    .eq("id", 1);
  if (error) return { ok: false, error: "Could not reopen the store." };
  await audit(profile.id, "store.opened", { accepting_orders: true });
  refresh();
  return { ok: true };
}

export async function setStoreClosed(
  input: z.input<typeof closedSchema>
): Promise<StoreActionResult> {
  const { profile } = await requireStaffPermission("store:availability");
  const parsed = closedSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the closure details." };
  const { reasonCode: code, note, until } = parsed.data;

  if (code === "custom" && !note?.trim()) {
    return { ok: false, error: "Add a short reason for the closure." };
  }

  let closedUntil: string | null = until ?? null;
  if (code === "today" && !closedUntil) {
    closedUntil = endOfSlotISO();
  }
  if (closedUntil && new Date(closedUntil).getTime() <= Date.now()) {
    return { ok: false, error: "Choose a future reopening time." };
  }

  const admin = await createAdminSessionClient();
  const { error } = await admin
    .from("app_settings")
    .update({
      accepting_orders: false,
      closure_reason_code: code,
      closure_note: code === "custom" ? note?.trim() ?? null : note?.trim() || null,
      closed_until: closedUntil,
      high_demand: false,
      high_demand_minutes: null,
      high_demand_until: null,
    })
    .eq("id", 1);
  if (error) return { ok: false, error: "Could not close the store." };
  await audit(profile.id, "store.closed", {
    closure_reason_code: code,
    closed_until: closedUntil,
  });
  refresh();
  return { ok: true };
}

export async function setHighDemand(
  input: z.input<typeof highDemandSchema>
): Promise<StoreActionResult> {
  const { profile } = await requireStaffPermission("store:availability");
  const parsed = highDemandSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid high-demand request." };
  const admin = await createAdminSessionClient();

  if (!parsed.data.enabled) {
    const { error } = await admin
      .from("app_settings")
      .update({
        high_demand: false,
        high_demand_minutes: null,
        high_demand_until: null,
      })
      .eq("id", 1);
    if (error) return { ok: false, error: "Could not update high-demand mode." };
    await audit(profile.id, "store.high_demand_off", {});
    refresh();
    return { ok: true };
  }

  // Guard: high demand only makes sense while the store is accepting orders.
  const current = await admin
    .from("app_settings")
    .select("accepting_orders")
    .eq("id", 1)
    .single();
  if (current.error) return { ok: false, error: "Could not update high-demand mode." };
  if (!current.data.accepting_orders) {
    return { ok: false, error: "Open the store before enabling high demand." };
  }

  const minutes = clampHighDemandMinutes(
    parsed.data.minutes ?? HIGH_DEMAND_DEFAULT_MINUTES
  );
  const until = new Date(
    Date.now() + HIGH_DEMAND_WINDOW_MINUTES * 60_000
  ).toISOString();

  const { error } = await admin
    .from("app_settings")
    .update({
      high_demand: true,
      high_demand_minutes: minutes,
      high_demand_until: until,
    })
    .eq("id", 1);
  if (error) return { ok: false, error: "Could not update high-demand mode." };
  await audit(profile.id, "store.high_demand_on", { minutes, until });
  refresh();
  return { ok: true };
}
```

- [ ] **Step 3: Confirm `getCloseHour` is exported**

Run: `grep -n "export function getCloseHour" lib/checkout.ts`
Expected: one match (it is exported). If not, export it.

- [ ] **Step 4: Typecheck + lint**

Run: `npm run lint`
Expected: no errors in the two new files.

- [ ] **Step 5: Commit**

```bash
git add lib/store-availability-data.ts app/workspace/availability/actions.ts
git commit -m "feat: add store availability reader and staff actions"
```

---

### Task 6: High-demand prep buffer in pickup slots

**Files:**
- Modify: `lib/checkout.ts` (`generatePickupSlots`)
- Test: `tests/unit/checkout-slots.test.ts`

**Interfaces:**
- Produces: `generatePickupSlots(now?: Date, extraPrepMinutes?: number): PickupSlot[]` — the earliest slot honors `DEFAULT_PREP_MINUTES + extraPrepMinutes`.
- Consumed by: Task 8 (CheckoutForm passes `prepBufferMinutes`).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/checkout-slots.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { generatePickupSlots } from "@/lib/checkout";

// A weekday mid-morning Manila time well inside operating hours.
const now = new Date("2026-06-29T03:00:00Z"); // 11:00 Manila

describe("generatePickupSlots extra prep buffer", () => {
  it("pushes the earliest slot later when a buffer is supplied", () => {
    const base = generatePickupSlots(now, 0);
    const buffered = generatePickupSlots(now, 30);
    expect(base.length).toBeGreaterThan(0);
    expect(buffered.length).toBeGreaterThan(0);
    expect(new Date(buffered[0].value).getTime()).toBeGreaterThan(
      new Date(base[0].value).getTime()
    );
  });

  it("defaults the buffer to zero", () => {
    const a = generatePickupSlots(now);
    const b = generatePickupSlots(now, 0);
    expect(a[0]?.value).toBe(b[0]?.value);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- checkout-slots`
Expected: FAIL — buffered earliest slot equals base (param not yet honored).

- [ ] **Step 3: Add the parameter**

In `lib/checkout.ts`, change the signature and the `earliest` computation:

```ts
export function generatePickupSlots(
  now = new Date(),
  extraPrepMinutes = 0
): PickupSlot[] {
  // Earliest valid pickup honours the prep estimate (plus any high-demand
  // buffer); the grid then rounds up to the next slot boundary.
  const earliest = new Date(
    now.getTime() + (DEFAULT_PREP_MINUTES + extraPrepMinutes) * 60_000
  );
  earliest.setSeconds(0, 0);
```

(Leave the rest of the function unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- checkout-slots`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/checkout.ts tests/unit/checkout-slots.test.ts
git commit -m "feat: support extra prep buffer in pickup slot generation"
```

---

### Task 7: Staff UI — floating button + modal

**Files:**
- Create: `components/admin/StoreAvailabilityModal.tsx` (client)
- Create: `components/admin/StoreAvailabilityControl.tsx` (client; floating button + modal state)
- Modify: `app/workspace/layout.tsx` (render the control, gated by permission)

**Interfaces:**
- Consumes: `StoreAvailability` (from `@/lib/store-availability`), the three actions from `@/app/workspace/availability/actions`, `HIGH_DEMAND_*` constants; `getStoreAvailability` + `hasStaffPermission` in the layout.
- Produces: a floating control rendered in the workspace shell.

No unit test (client UI); verified by `npm run build`, `npm run lint`, and the manual checklist in Step 6.

- [ ] **Step 1: Build the modal**

Create `components/admin/StoreAvailabilityModal.tsx`:

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, ChevronDown, Minus, Plus, X } from "lucide-react";
import { Select } from "@base-ui/react/select";
import {
  setHighDemand,
  setStoreClosed,
  setStoreOpen,
} from "@/app/workspace/availability/actions";
import {
  HIGH_DEMAND_DEFAULT_MINUTES,
  HIGH_DEMAND_MAX_MINUTES,
  HIGH_DEMAND_MIN_MINUTES,
  HIGH_DEMAND_STEP_MINUTES,
  HIGH_DEMAND_WINDOW_MINUTES,
  type ClosureReasonCode,
  type StoreAvailability,
} from "@/lib/store-availability";

const REASONS: { value: ClosureReasonCode; label: string }[] = [
  { value: "today", label: "Unavailable for today" },
  { value: "temporary", label: "Temporarily closed" },
  { value: "kitchen", label: "Kitchen unavailable" },
  { value: "inventory", label: "Inventory shortage" },
  { value: "maintenance", label: "Maintenance" },
  { value: "custom", label: "Custom reason" },
];

export function StoreAvailabilityModal({
  state,
  onClose,
}: {
  state: StoreAvailability;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingClosed, setEditingClosed] = useState(!state.isOpen);
  const [reason, setReason] = useState<ClosureReasonCode>(
    state.closureReasonCode ?? "temporary"
  );
  const [note, setNote] = useState(state.closureNote ?? "");
  const [until, setUntil] = useState("");
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
      else onClose();
    });
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
            <h2 className="font-display text-2xl text-zb-cream">Update your status</h2>
            <p className="mt-1 text-sm text-zb-cream/55">
              The webstore is {state.isOpen ? "open" : "closed"}.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full border border-zb-sage/25 text-zb-cream/60 transition hover:bg-zb-primary hover:text-zb-cream"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
          {/* OPEN */}
          <button
            type="button"
            disabled={pending}
            onClick={() => run(setStoreOpen)}
            className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${
              state.isOpen
                ? "border-emerald-400/70 bg-emerald-400/10"
                : "border-zb-sage/25 bg-zb-primary-dark/35 hover:border-zb-sage"
            }`}
          >
            <span className="mt-1 size-3 shrink-0 rounded-full bg-emerald-400" />
            <span>
              <span className="block font-semibold text-zb-cream">Open</span>
              <span className="text-sm text-zb-cream/60">
                Receive incoming orders as usual
              </span>
            </span>
          </button>

          {/* HIGH DEMAND */}
          <div
            className={`rounded-2xl border p-4 transition ${
              state.highDemand
                ? "border-zb-bone/70 bg-zb-bone/10"
                : "border-zb-sage/25 bg-zb-primary-dark/35"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="block font-semibold text-zb-cream">
                  High Demand mode
                </span>
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
                <p className="text-sm font-medium text-zb-cream">
                  How much extra time do you need?
                </p>
                <div className="mt-2 rounded-xl border border-zb-bone/30 bg-zb-bone/10 px-3 py-2 text-xs leading-5 text-zb-cream/75">
                  For future orders only — this won&apos;t change the prep time of
                  current orders.
                </div>
                <div className="mt-4 flex items-center justify-center gap-5">
                  <button
                    type="button"
                    aria-label="Decrease"
                    disabled={minutes <= HIGH_DEMAND_MIN_MINUTES}
                    onClick={() =>
                      setMinutes((m) =>
                        Math.max(HIGH_DEMAND_MIN_MINUTES, m - HIGH_DEMAND_STEP_MINUTES)
                      )
                    }
                    className="grid size-10 place-items-center rounded-full border border-zb-sage/30 text-zb-cream disabled:opacity-40"
                  >
                    <Minus className="size-4" />
                  </button>
                  <div className="text-center">
                    <span className="block font-display text-3xl text-zb-cream">
                      {minutes}
                    </span>
                    <span className="text-xs text-zb-cream/50">min</span>
                  </div>
                  <button
                    type="button"
                    aria-label="Increase"
                    disabled={minutes >= HIGH_DEMAND_MAX_MINUTES}
                    onClick={() =>
                      setMinutes((m) =>
                        Math.min(HIGH_DEMAND_MAX_MINUTES, m + HIGH_DEMAND_STEP_MINUTES)
                      )
                    }
                    className="grid size-10 place-items-center rounded-full border border-zb-sage/30 text-zb-cream disabled:opacity-40"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
                <p className="mt-3 text-center text-xs text-zb-cream/50">
                  Preparation time will be extended for the next{" "}
                  {HIGH_DEMAND_WINDOW_MINUTES} minutes.
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
          </div>

          {/* CLOSED */}
          <div
            className={`rounded-2xl border p-4 transition ${
              !state.isOpen
                ? "border-zb-danger/70 bg-zb-danger/10"
                : "border-zb-sage/25 bg-zb-primary-dark/35"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="mt-1 size-3 shrink-0 rounded-full bg-zb-danger" />
                <div>
                  <span className="block font-semibold text-zb-cream">Closed</span>
                  <span className="text-sm text-zb-cream/60">
                    {state.closureLabel ?? "Pause incoming online orders"}
                  </span>
                </div>
              </div>
              {!editingClosed && (
                <button
                  type="button"
                  onClick={() => setEditingClosed(true)}
                  className="rounded-lg border border-zb-bone/45 px-3 py-1 text-sm font-semibold text-zb-bone transition hover:bg-zb-bone/10"
                >
                  Edit
                </button>
              )}
            </div>

            {editingClosed && (
              <div className="mt-4 space-y-3">
                <Select.Root
                  items={REASONS}
                  value={reason}
                  onValueChange={(v) => setReason(v as ClosureReasonCode)}
                >
                  <Select.Trigger className="group flex h-12 w-full items-center rounded-xl border border-zb-sage/35 bg-zb-primary-dark/65 px-4 text-left text-sm text-zb-cream outline-none transition hover:border-zb-sage data-[popup-open]:border-zb-bone">
                    <Select.Value placeholder="Choose a reason" className="flex-1" />
                    <ChevronDown className="ml-3 size-4 text-zb-cream/50 transition group-data-[popup-open]:rotate-180" />
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Positioner sideOffset={8} className="z-[70]">
                      <Select.Popup className="w-[var(--anchor-width)] rounded-2xl border border-zb-bone/45 bg-zb-primary-dark p-2 text-zb-cream shadow-2xl outline-none">
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
                      </Select.Popup>
                    </Select.Positioner>
                  </Select.Portal>
                </Select.Root>

                {reason === "custom" && (
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={200}
                    placeholder="Tell customers why (shown on the storefront)"
                    className="h-12 w-full rounded-xl border border-zb-sage/35 bg-zb-primary-dark/65 px-4 text-sm text-zb-cream placeholder:text-zb-cream/35 focus:border-zb-bone focus:outline-none"
                  />
                )}

                <div>
                  <p className="text-sm font-medium text-zb-cream">
                    How long do you want to be closed?
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setUntil(new Date(Date.now() + 30 * 60_000).toISOString())
                      }
                      className="rounded-full border border-zb-sage/35 px-4 py-1.5 text-sm text-zb-cream transition hover:border-zb-bone"
                    >
                      30 min
                    </button>
                    <button
                      type="button"
                      onClick={() => setUntil("")}
                      className="rounded-full border border-zb-sage/35 px-4 py-1.5 text-sm text-zb-cream transition hover:border-zb-bone"
                    >
                      End of slot
                    </button>
                  </div>
                  <label className="mt-3 block text-xs text-zb-cream/55">
                    Or reopen at a specific time (optional)
                    <input
                      type="datetime-local"
                      onChange={(e) =>
                        setUntil(
                          e.target.value
                            ? new Date(e.target.value).toISOString()
                            : ""
                        )
                      }
                      className="mt-1 h-11 w-full rounded-xl border border-zb-sage/35 bg-zb-primary-dark/65 px-3 text-sm text-zb-cream focus:border-zb-bone focus:outline-none"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(() =>
                      setStoreClosed({
                        reasonCode: reason,
                        note: note || undefined,
                        until: until || null,
                      })
                    )
                  }
                  className="w-full rounded-xl bg-zb-danger py-2.5 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  Close the webstore
                </button>
              </div>
            )}
          </div>

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

- [ ] **Step 2: Build the floating control**

Create `components/admin/StoreAvailabilityControl.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Store } from "lucide-react";
import { StoreAvailabilityModal } from "@/components/admin/StoreAvailabilityModal";
import type { StoreAvailability } from "@/lib/store-availability";

export function StoreAvailabilityControl({
  state,
}: {
  state: StoreAvailability;
}) {
  const [open, setOpen] = useState(false);

  const dot = !state.isOpen
    ? "bg-zb-danger"
    : state.highDemand
      ? "bg-amber-400"
      : "bg-emerald-400";
  const label = !state.isOpen
    ? "Closed"
    : state.highDemand
      ? "High demand"
      : "Open";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full border border-zb-sage/30 bg-zb-primary-strong/95 px-4 py-3 text-sm font-semibold text-zb-cream shadow-2xl backdrop-blur transition hover:border-zb-bone"
        aria-label={`Store status: ${label}. Update store availability.`}
      >
        <span className={`size-2.5 rounded-full ${dot}`} />
        <Store className="size-4" />
        <span className="hidden sm:inline">{label}</span>
      </button>
      {open && (
        <StoreAvailabilityModal state={state} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
```

- [ ] **Step 3: Wire it into the workspace layout**

In `app/workspace/layout.tsx`, add imports:

```ts
import { StoreAvailabilityControl } from "@/components/admin/StoreAvailabilityControl";
import { getStoreAvailability } from "@/lib/store-availability-data";
```

Inside the component, after `const { profile } = await requireStaff();`, read state:

```ts
  const storeAvailability = hasStaffPermission(profile, "store:availability")
    ? await getStoreAvailability()
    : null;
```

Then before the closing `</div>` of the root wrapper (after `<main>...</main>`), render:

```tsx
      {storeAvailability && (
        <StoreAvailabilityControl state={storeAvailability} />
      )}
```

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors in the new components / layout.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: build succeeds (compiles the new client components and layout).

- [ ] **Step 6: Manual verification checklist**

Run the app (`npm run dev`), sign in as a Super Admin, open `/workspace`:
- Floating button appears bottom-right with a green dot when open.
- Modal opens; toggling **High Demand** shows the stepper, "for future orders only" note, and the 30-minute line; enabling persists (dot turns amber after reload).
- **Closed → Edit**: pick a reason, optionally custom note + duration preset, confirm; button dot turns red; reason shows in the header summary.
- **Open** card reopens.
- Sign in as a Cashier WITHOUT the permission: the floating button is absent.

- [ ] **Step 7: Commit**

```bash
git add components/admin/StoreAvailabilityModal.tsx components/admin/StoreAvailabilityControl.tsx app/workspace/layout.tsx
git commit -m "feat: floating webstore availability control and modal"
```

---

### Task 8: Customer surface — closed notice + checkout gate

**Files:**
- Create: `components/shop/StoreClosedNotice.tsx` (server)
- Modify: `app/(shop)/menu/page.tsx` (render notice; force dynamic)
- Modify: `app/(shop)/cart/page.tsx` (render notice; force dynamic)
- Modify: `app/(shop)/checkout/page.tsx` (pass availability props)
- Modify: `components/shop/CheckoutForm.tsx` (consume props: gate + buffer)

**Interfaces:**
- Consumes: `getStoreAvailability` (`@/lib/store-availability-data`), `StoreAvailability`.
- Produces: a `<StoreClosedNotice />` server component; `CheckoutForm` gains props `webstoreOpen: boolean`, `closureLabel: string | null`, `closedUntil: string | null`, `prepBufferMinutes: number`.

No unit test (RSC/UI); verified by `npm run build`, `npm run lint`, manual checklist.

- [ ] **Step 1: Build the notice component**

Create `components/shop/StoreClosedNotice.tsx`:

```tsx
import { AlertTriangle, Clock3 } from "lucide-react";
import { getStoreAvailability } from "@/lib/store-availability-data";

function formatUntil(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date(iso));
}

export async function StoreClosedNotice() {
  const state = await getStoreAvailability();

  if (!state.isOpen) {
    const until = formatUntil(state.closedUntil);
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-xl border border-zb-danger/50 bg-zb-danger/10 px-4 py-3 text-sm"
      >
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-zb-danger" />
        <div>
          <p className="font-semibold text-zb-cream">Currently closed</p>
          <p className="mt-0.5 leading-6 text-zb-cream/80">
            {state.closureLabel ?? "We've paused online orders for now."}
            {until ? ` We expect to reopen around ${until}.` : ""}
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
            Orders are taking a little longer right now — thanks for your
            patience.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
```

- [ ] **Step 2: Add the notice to the menu page**

In `app/(shop)/menu/page.tsx`: add `export const dynamic = "force-dynamic";` near the metadata, import the notice, and render `<StoreClosedNotice />` just above `<KitchenClosingBanner />` (line 30):

```tsx
import { StoreClosedNotice } from "@/components/shop/StoreClosedNotice";
```
```tsx
            <StoreClosedNotice />
            <KitchenClosingBanner />
```

- [ ] **Step 3: Add the notice to the cart page**

In `app/(shop)/cart/page.tsx`: add `export const dynamic = "force-dynamic";`, import the notice, and render `<StoreClosedNotice />` just above `<KitchenClosingBanner />` (line 23).

- [ ] **Step 4: Pass availability props from the checkout page**

In `app/(shop)/checkout/page.tsx`, import and read availability:

```ts
import { getStoreAvailability } from "@/lib/store-availability-data";
```
```ts
  const storeAvailability = await getStoreAvailability();
```

Extend the `<CheckoutForm ... />` props:

```tsx
            operationsRole={user ? null : operationsProfile?.role ?? null}
            webstoreOpen={storeAvailability.isOpen}
            closureLabel={storeAvailability.closureLabel}
            closedUntil={storeAvailability.closedUntil}
            prepBufferMinutes={storeAvailability.prepBufferMinutes}
```

- [ ] **Step 5: Consume the props in CheckoutForm**

In `components/shop/CheckoutForm.tsx`:

(a) Extend the props type and destructuring (after `operationsRole`):

```ts
  operationsRole,
  webstoreOpen,
  closureLabel,
  closedUntil,
  prepBufferMinutes,
}: {
  isLoggedIn: boolean;
  email: string | null;
  profile: { display_name: string | null; phone: string | null };
  savedAddresses: SavedAddress[];
  operationsRole: "admin" | "staff" | null;
  webstoreOpen: boolean;
  closureLabel: string | null;
  closedUntil: string | null;
  prepBufferMinutes: number;
}) {
```

(b) Feed the buffer into the initial and refreshed slot generation:

```ts
  const [pickupSlots, setPickupSlots] = useState<PickupSlot[]>(() =>
    generatePickupSlots(new Date(), prepBufferMinutes)
  );
```

In the refresh effect (around line 130):

```ts
    const refresh = () => {
      setPickupSlots(generatePickupSlots(new Date(), prepBufferMinutes));
      setStoreOpen(isStoreOpen());
    };
```

And add `prepBufferMinutes` to that effect's dependency array: `}, [prepBufferMinutes]);`

(c) Gate ordering on the manual switch too. Change the closed check (line 187) to also trigger when manually closed, and show the reason. Replace:

```ts
  if (!storeOpen && !isTestOrder) {
```
with:
```ts
  if ((!storeOpen || !webstoreOpen) && !isTestOrder) {
```

Inside that closed block, when `!webstoreOpen`, prefer the manual reason. Add, just under the `<h1>...THE CAFÉ IS CLOSED...</h1>` paragraph, a manual-closure line:

```tsx
        {!webstoreOpen && (
          <p className="mt-2 text-sm text-zb-bone">
            {closureLabel ?? "Online ordering is paused right now."}
            {closedUntil
              ? ` Reopening around ${new Intl.DateTimeFormat("en-PH", {
                  weekday: "short",
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: "Asia/Manila",
                }).format(new Date(closedUntil))}.`
              : ""}
          </p>
        )}
```

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: no errors; `webstoreOpen`/`prepBufferMinutes` are used (no unused-var warnings).

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: build succeeds; menu/cart pages render dynamically.

- [ ] **Step 8: Manual verification checklist**

With the store set to Closed via the workspace modal:
- `/menu` and `/cart` show the red "Currently closed" notice with reason (+ reopen time when set).
- `/checkout` shows the closed screen with the manual reason and blocks submission.
- Set High Demand on (store open): `/menu` shows the "Busier than usual" note; on `/checkout`, the earliest pickup slot is pushed out by the configured minutes.
- Reopen / disable: notices disappear and checkout works normally.

- [ ] **Step 9: Commit**

```bash
git add components/shop/StoreClosedNotice.tsx "app/(shop)/menu/page.tsx" "app/(shop)/cart/page.tsx" "app/(shop)/checkout/page.tsx" components/shop/CheckoutForm.tsx
git commit -m "feat: surface webstore closed/high-demand state to customers"
```

---

## Final verification

- [ ] **Run the full unit suite**

Run: `npm test`
Expected: all tests pass (smoke, staff-roles, store-availability, checkout-slots).

- [ ] **Lint + build gate**

Run: `npm run lint && npm run build`
Expected: both succeed.

- [ ] **Apply the migration**

Apply `supabase/migrations/0043_store_availability.sql` to Supabase (manual step — the feature is inert until then). Verify `get_store_availability()` returns one row and that closing/reopening from the workspace modal round-trips.

## Notes for the implementer

- The DB `place_order` already raises `NOT_ACCEPTING` when `accepting_orders=false` — this is the hard backstop; the customer-side gate in Task 8 is UX only.
- `getStoreAvailability` falls back to "open" on any RPC error so a transient DB issue never strands the storefront in a closed state.
- The in-memory expiry in `resolveStoreAvailability` (Task 4) and the DB `refresh_expired_store_availability` (Task 2) are intentionally redundant: the DB function persists the reset; the resolver guarantees correctness on the read that triggers it.
