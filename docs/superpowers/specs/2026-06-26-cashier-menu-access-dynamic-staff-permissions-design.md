# Cashier Menu Access + Dynamic Staff Permissions — Design

**Date:** 2026-06-26
**Status:** Approved (design)

## Problem

Cashier accounts need access to the Menu Dashboard to manage day-to-day product
availability, but must be kept out of core menu configuration (adding/editing/
deleting products, categories, and options, and linking modifiers). Separately,
Super Admins need a Staff Access Management feature to customize each staff
member's permissions dynamically and update them anytime without recreating
accounts.

## Current state

- `lib/staff-roles.ts` holds a **static** role→permission map. `cashier` maps to
  `["dashboard:view", "orders:view", "orders:manage"]` — no menu access at all.
- `hasStaffPermission(profile, permission)` checks that static map. Super Admins
  (`profile.role === "admin"`) always pass.
- `app/workspace/menu/page.tsx` **and every menu server action** in
  `app/workspace/menu/actions.ts` call `requireSuperAdmin`. The menu is fully
  Super-Admin-only today. `menu:manage` is a single coarse permission.
- `app/workspace/layout.tsx` gates nav links on permissions; the Menu link uses
  `menu:manage`. The Team link uses `team:manage`.
- `/workspace/team` and its actions are Super-Admin-only.

## Goals

1. Cashiers can open the Menu Dashboard, view products/categories/options, and
   toggle availability — but cannot add/edit/delete or link modifiers.
2. Super Admins can grant/revoke individual permissions per staff member,
   stored in the DB, editable anytime. Role defaults provide safe starting
   points; per-staff overrides provide flexibility.

## Approach (chosen)

**Permission model:** Role defaults (in code) + per-staff overrides (in DB).
New staff start from their role's default permission set; Super Admins adjust
individual permissions per person. Effective permission =
`override if present, else role default`. Super Admin always passes everything.

**Granularity:** Per-section, with the menu split into three permissions so that
"toggle availability" is separable from "configure the catalog."

## Design

### 1. Permission catalog (`lib/staff-roles.ts`)

Replace the single `menu:manage` with three menu permissions. Final
`StaffPermission` union:

| Permission        | Meaning                                                        |
| ----------------- | ------------------------------------------------------------- |
| `dashboard:view`  | See the workspace dashboard                                   |
| `orders:view`     | View orders                                                   |
| `orders:manage`   | Act on orders                                                 |
| `menu:view`       | Open Menu Dashboard; view products, categories, options       |
| `menu:availability` | Toggle product/option availability (stock on/off)           |
| `menu:configure`  | Add/edit/delete products, categories, options; link modifiers |
| `team:manage`     | Staff Access Management (NOT grantable — see Decisions)        |
| `deliveries:view` / `deliveries:manage` | Unchanged (rider, still unavailable)    |

Role defaults:

- `cashier → [dashboard:view, orders:view, orders:manage, menu:view, menu:availability]`
  (deliberately **excludes** `menu:configure`)
- `rider → [deliveries:view, deliveries:manage]` (unchanged)

A `GRANTABLE_PERMISSIONS` list (the catalog the Super Admin UI exposes) includes
every permission **except** `team:manage` and the `deliveries:*` set (rider not
yet available). Each grantable entry has a label/description and the section it
belongs to, for rendering the management UI.

### 2. Dynamic overrides (database)

New migration `supabase/migrations/0041_staff_permission_overrides.sql`:

- Table `staff_permission_overrides`:
  - `profile_id uuid` references `profiles(id)` on delete cascade
  - `permission text not null`
  - `granted boolean not null`
  - `updated_by uuid` references `profiles(id)`
  - `updated_at timestamptz not null default now()`
  - Primary key `(profile_id, permission)`
- Explicit `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated` (the
  project does not rely on default privileges — new tables need explicit grants
  or you get `42501`).
- A row means "force this permission ON (`granted=true`) or OFF (`granted=false`)
  for this person," overriding the role default.

Resolution: the merged set is computed in application code (`lib/admin.ts`),
not via SQL view, to keep the existing `getTeamProfileForUser` /
`getStaffProfile` flow. `StaffProfile` gains a resolved
`permissions: StaffPermission[]` field built from role defaults merged with
override rows. `hasStaffPermission` reads that resolved set. Super Admin still
short-circuits to `true`.

### 3. Enforce on the menu

- `app/workspace/menu/page.tsx`: `requireSuperAdmin` → `requireStaffPermission("menu:view")`.
- `app/workspace/menu/actions.ts`, per action:
  - `setProductAvailability`, `setOptionAvailability` → `requireStaffPermission("menu:availability")`
  - `saveCategory`, `saveProduct`, `saveOptionGroup`, `saveOption`, `linkOptionGroup` → `requireStaffPermission("menu:configure")`
- `MenuManager` receives `can: { configure: boolean; availability: boolean }`.
  When `configure` is false (cashier): hide "Add category/product/option", the
  edit pencil buttons, and "Link products"; make product/option cards
  non-interactive for editing. Keep the availability `Toggle` and the
  availability modal active when `availability` is true. **Server actions are
  the authoritative guard; UI hiding is UX only.**

### 4. Staff Access Management UI (Super Admin)

On `/workspace/team`, each team member row gains a **Manage permissions** panel:
a checklist of `GRANTABLE_PERMISSIONS` grouped by section, each showing its
effective state with the role default as baseline, plus a "Reset to role
default" action.

New server action `updateStaffPermissions` (in `app/workspace/team/actions.ts`,
Super-Admin-only, audit-logged):

- Input: `profileId`, and the desired state per grantable permission.
- For each permission: if desired state equals the role default, delete any
  override row (back to default); otherwise upsert an override row with
  `granted` = desired state and `updated_by` = actor.
- Cannot target a Super Admin account; cannot grant `team:manage`.
- Writes an `audit_logs` entry and `revalidatePath("/workspace", "layout")` +
  `/workspace/team` so nav and gates refresh.

`getStaffManagementData` (`lib/staff-invitations.ts`) is extended to return each
member's current override rows so the UI can render effective state.

### 5. Navigation (`app/workspace/layout.tsx`)

- Menu link shows when `menu:view` is present (cashiers now see it).
- Team link stays `role: "admin"` only (Super-Admin-exclusive).

### Decisions

- **`team:manage` is Super-Admin-exclusive and not in the grantable catalog.**
  Granting permission-management to a non-admin would undermine "Super Admins
  maintain full control." Only `role: "admin"` reaches Team/permissions.
- **`menu:configure` is grantable** — a Super Admin may give a trusted cashier
  full menu editing via an override, but it is OFF by default.
- **Resolution lives in app code**, not a SQL view, to reuse the existing
  profile-loading path with minimal churn.

## Testing

- pgTAP test `supabase/tests/0041_staff_permission_overrides.test.sql`:
  table exists, grants present, override ON/OFF rows resolve as expected against
  role defaults (verifying the contract the app relies on).
- Application-level: unit-test the permission resolution helper (role default vs.
  override ON vs. override OFF, Super Admin short-circuit).
- Manual verification:
  1. Cashier opens Menu, toggles availability — succeeds.
  2. Cashier attempts `saveProduct`/`saveCategory`/etc. — rejected (no
     `menu:configure`); configure UI is hidden.
  3. Super Admin grants `menu:configure` to that cashier — cashier gains edit.
  4. Super Admin resets to role default — edit access removed again.

## Out of scope

- Rider role / deliveries permissions (still unavailable).
- Changing how invitations assign initial roles (cashier remains the only
  available invite role).
- Per-permission audit history UI (we log to `audit_logs` but do not surface a
  timeline).
</content>
</invoke>
