# Cashier Menu Access + Dynamic Staff Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Cashier staff open the Menu Dashboard and toggle product/option availability while blocking catalog configuration, and give Super Admins a Staff Access Management UI to grant/revoke individual permissions per staff member, stored in the database and editable anytime.

**Architecture:** Permissions come from role defaults in code merged with per-staff override rows in a new `staff_permission_overrides` table. The merged set is resolved when the staff profile loads and carried on `StaffProfile.permissions`. Existing `hasStaffPermission` / `requireStaffPermission` gates read that set; Super Admin (`role: "admin"`) always passes. The coarse `menu:manage` permission is split into `menu:view`, `menu:availability`, and `menu:configure`, and each menu server action is gated on the right one.

**Tech Stack:** Next.js 16 (App Router, React 19 server components + server actions), TypeScript, Zod v4, Supabase (Postgres + RLS, `@supabase/ssr`), Tailwind, Base UI, lucide-react.

## Global Constraints

- **Read the Next.js guides first.** Per `AGENTS.md`, this is a modified Next.js — read the relevant guide under `node_modules/next/dist/docs/` before writing App Router / server-action code; heed deprecation notices.
- **No JS unit-test runner exists** (scripts are only `dev`, `build`, `lint`). Do NOT add one. Verify TypeScript with `npx tsc --noEmit`, `npm run lint`, and `npm run build`. Verify SQL with transaction-style tests under `supabase/tests/` run via `supabase test db`. Verify behavior manually per each task's steps.
- **New tables need explicit GRANTs.** This project does not rely on default privileges — a new table without `grant ... to authenticated` / `to service_role` yields `42501`. Always add grants.
- **Two Supabase clients, two paths:** the RLS-enforced user session client is `createAdminSessionClient()` (anon key, used for reading the signed-in staffer's own data); the service-role client is `createAdminClient()` (bypasses RLS, used for Super-Admin management reads/writes). Pick the matching one.
- **Server actions are the authoritative authorization boundary.** UI hiding is UX only; never rely on it for security.
- **Migrations are sequential.** The next free number is `0041`. Audit-log privileged mutations to `audit_logs` following existing call sites.
- **Currency/labels:** match existing copy tone; peso formatting and styling already established in components — reuse, don't reinvent.

---

### Task 1: Split the permission catalog and add resolution + grantable catalog

**Files:**
- Modify: `lib/staff-roles.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `type StaffPermission` — now includes `"menu:view" | "menu:availability" | "menu:configure"` and no longer includes `"menu:manage"`.
  - `type PermissionOverride = { permission: StaffPermission; granted: boolean }`
  - `type GrantablePermission = { permission: StaffPermission; label: string; description: string; section: "Dashboard" | "Orders" | "Menu" }`
  - `const GRANTABLE_PERMISSIONS: readonly GrantablePermission[]`
  - `function isStaffPermission(value: unknown): value is StaffPermission`
  - `function roleDefaultPermissions(role: StaffJobRole | null): readonly StaffPermission[]`
  - `function resolvePermissions(role: StaffJobRole | null, overrides: readonly PermissionOverride[]): StaffPermission[]`
  - `roleHasPermission(role, permission)` and `STAFF_ROLES`, `isStaffJobRole`, `isStaffRoleAvailable` remain unchanged in signature.

- [ ] **Step 1: Replace the permission type, role map, and add the new exports**

Replace the body of `lib/staff-roles.ts` from the `StaffPermission` type downward with:

```ts
export const STAFF_ROLES = {
  cashier: {
    label: "Cashier",
    description: "Manage incoming orders, payments, and order progress.",
    available: true,
  },
  rider: {
    label: "Rider",
    description: "Handle assigned deliveries and delivery status updates.",
    available: false,
  },
} as const;

export type StaffJobRole = keyof typeof STAFF_ROLES;

export type StaffPermission =
  | "dashboard:view"
  | "orders:view"
  | "orders:manage"
  | "menu:view"
  | "menu:availability"
  | "menu:configure"
  | "team:manage"
  | "deliveries:view"
  | "deliveries:manage";

const ROLE_PERMISSIONS: Record<StaffJobRole, readonly StaffPermission[]> = {
  cashier: [
    "dashboard:view",
    "orders:view",
    "orders:manage",
    "menu:view",
    "menu:availability",
  ],
  rider: ["deliveries:view", "deliveries:manage"],
};

const ALL_PERMISSIONS: readonly StaffPermission[] = [
  "dashboard:view",
  "orders:view",
  "orders:manage",
  "menu:view",
  "menu:availability",
  "menu:configure",
  "team:manage",
  "deliveries:view",
  "deliveries:manage",
];

export type PermissionOverride = {
  permission: StaffPermission;
  granted: boolean;
};

export type GrantablePermission = {
  permission: StaffPermission;
  label: string;
  description: string;
  section: "Dashboard" | "Orders" | "Menu";
};

// Permissions a Super Admin may grant/revoke per staff member. `team:manage`
// and the rider `deliveries:*` permissions are intentionally excluded: team
// management stays Super-Admin-exclusive, and the rider role is not yet
// available.
export const GRANTABLE_PERMISSIONS: readonly GrantablePermission[] = [
  {
    permission: "dashboard:view",
    section: "Dashboard",
    label: "View dashboard",
    description: "Open the workspace dashboard.",
  },
  {
    permission: "orders:view",
    section: "Orders",
    label: "View orders",
    description: "See incoming and past orders.",
  },
  {
    permission: "orders:manage",
    section: "Orders",
    label: "Manage orders",
    description: "Advance order stages and record payments.",
  },
  {
    permission: "menu:view",
    section: "Menu",
    label: "View menu",
    description: "Open the Menu Dashboard and browse the catalog.",
  },
  {
    permission: "menu:availability",
    section: "Menu",
    label: "Toggle availability",
    description: "Mark products and options in or out of stock.",
  },
  {
    permission: "menu:configure",
    section: "Menu",
    label: "Configure menu",
    description:
      "Add, edit, delete, and link products, categories, and options.",
  },
];

export function isStaffJobRole(value: unknown): value is StaffJobRole {
  return typeof value === "string" && value in STAFF_ROLES;
}

export function isStaffRoleAvailable(role: StaffJobRole): boolean {
  return STAFF_ROLES[role].available;
}

export function isStaffPermission(value: unknown): value is StaffPermission {
  return (
    typeof value === "string" &&
    ALL_PERMISSIONS.includes(value as StaffPermission)
  );
}

export function roleDefaultPermissions(
  role: StaffJobRole | null
): readonly StaffPermission[] {
  return role ? ROLE_PERMISSIONS[role] : [];
}

export function roleHasPermission(
  role: StaffJobRole,
  permission: StaffPermission
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

// Effective permissions = role defaults, with each override row forcing a
// single permission on (granted=true) or off (granted=false).
export function resolvePermissions(
  role: StaffJobRole | null,
  overrides: readonly PermissionOverride[]
): StaffPermission[] {
  const set = new Set<StaffPermission>(roleDefaultPermissions(role));
  for (const override of overrides) {
    if (override.granted) set.add(override.permission);
    else set.delete(override.permission);
  }
  return [...set];
}
```

- [ ] **Step 2: Type-check (expect failures in dependent files — that is the signal)**

Run: `npx tsc --noEmit`
Expected: errors only about `menu:manage` no longer existing (e.g. in `app/workspace/layout.tsx`) and `hasStaffPermission` usage — those are fixed in later tasks. No errors *inside* `lib/staff-roles.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/staff-roles.ts
git commit -m "feat: split menu permission and add per-staff permission resolution"
```

---

### Task 2: Create the `staff_permission_overrides` table (migration + test)

**Files:**
- Create: `supabase/migrations/0041_staff_permission_overrides.sql`
- Create: `supabase/tests/0041_staff_permission_overrides.test.sql`

**Interfaces:**
- Produces: table `staff_permission_overrides(profile_id uuid, permission text, granted boolean, updated_by uuid, updated_at timestamptz)` PK `(profile_id, permission)`, RLS enabled, self-select policy, grants to `authenticated` (select) and `service_role` (all).

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0041_staff_permission_overrides.sql`:

```sql
-- Per-staff permission overrides layered on top of role defaults. A row forces
-- a single permission ON (granted = true) or OFF (granted = false) for one
-- operations profile. Role defaults and the merge live in app code
-- (lib/staff-roles.ts); this table only stores the deltas a Super Admin sets.
create table staff_permission_overrides (
  profile_id uuid not null references profiles(id) on delete cascade,
  permission text not null,
  granted boolean not null,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  primary key (profile_id, permission)
);

alter table staff_permission_overrides enable row level security;

-- Operations users resolve their own effective permissions through the
-- RLS-enforced session client, so they must be able to read their own rows.
create policy staff_permission_overrides_self_select
  on staff_permission_overrides
  for select
  to authenticated
  using (profile_id = auth.uid());

grant select on staff_permission_overrides to authenticated;
grant select, insert, update, delete on staff_permission_overrides to service_role;
```

- [ ] **Step 2: Write the test**

Create `supabase/tests/0041_staff_permission_overrides.test.sql`:

```sql
begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  created_at, raw_app_meta_data, raw_user_meta_data, updated_at
)
values
  (
    '41000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'perm-override-self@zombeans.local', '',
    now(), '{}', '{}', now()
  ),
  (
    '41000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'perm-override-other@zombeans.local', '',
    now(), '{}', '{}', now()
  );

insert into profiles (id, role, staff_role, display_name, is_active)
values
  ('41000000-0000-0000-0000-000000000001', 'staff', 'cashier', 'Override Self', true),
  ('41000000-0000-0000-0000-000000000002', 'staff', 'cashier', 'Override Other', true);

insert into staff_permission_overrides (profile_id, permission, granted, updated_by)
values
  ('41000000-0000-0000-0000-000000000001', 'menu:configure', true,
   '41000000-0000-0000-0000-000000000001'),
  ('41000000-0000-0000-0000-000000000002', 'menu:configure', true,
   '41000000-0000-0000-0000-000000000002');

select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
  v_self_count integer;
  v_other_count integer;
begin
  set local role authenticated;

  select count(*) into v_self_count
  from staff_permission_overrides
  where profile_id = '41000000-0000-0000-0000-000000000001';

  select count(*) into v_other_count
  from staff_permission_overrides
  where profile_id = '41000000-0000-0000-0000-000000000002';

  reset role;

  if v_self_count <> 1 then
    raise exception 'TEST FAILED: user could not read their own override (got %)', v_self_count;
  end if;

  if v_other_count <> 0 then
    raise exception 'TEST FAILED: RLS leaked another profile''s overrides (got %)', v_other_count;
  end if;

  raise notice 'PASS: staff_permission_overrides self-select RLS holds';
end
$$;

rollback;
```

- [ ] **Step 3: Run the migration + test**

Run: `supabase test db`
Expected: the new test outputs `PASS: staff_permission_overrides self-select RLS holds` and the run reports success. (If `supabase` CLI is unavailable locally, apply `0041` to the dev database and run the test file with `psql -f supabase/tests/0041_staff_permission_overrides.test.sql`, expecting the same `PASS` notice and no `TEST FAILED`.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0041_staff_permission_overrides.sql supabase/tests/0041_staff_permission_overrides.test.sql
git commit -m "feat: add staff_permission_overrides table with self-select RLS"
```

---

### Task 3: Resolve overrides into `StaffProfile.permissions` and update `hasStaffPermission`

**Files:**
- Modify: `lib/admin.ts`

**Interfaces:**
- Consumes: `resolvePermissions`, `PermissionOverride`, `isStaffPermission`, `StaffPermission` from `lib/staff-roles.ts` (Task 1); table from Task 2.
- Produces:
  - `type StaffProfile` gains `permissions: StaffPermission[]`.
  - `hasStaffPermission(profile: Pick<StaffProfile, "role" | "permissions">, permission: StaffPermission): boolean`.

- [ ] **Step 1: Update imports**

In `lib/admin.ts`, replace the import block from `@/lib/staff-roles`:

```ts
import {
  resolvePermissions,
  type PermissionOverride,
  type StaffJobRole,
  type StaffPermission,
} from "@/lib/staff-roles";
import { isStaffPermission } from "@/lib/staff-roles";
```

(Keep the existing `createAdminSessionClient`, `safeNextPath`, React `cache`, `redirect`, and type imports as they are.)

- [ ] **Step 2: Add `permissions` to `StaffProfile`**

Change the `StaffProfile` type:

```ts
export type StaffProfile = {
  id: string;
  role: StaffRole;
  staff_role: StaffJobRole | null;
  display_name: string;
  full_name: string | null;
  permissions: StaffPermission[];
};
```

- [ ] **Step 3: Rewrite `hasStaffPermission` to read the resolved set**

Replace the existing `hasStaffPermission`:

```ts
export function hasStaffPermission(
  profile: Pick<StaffProfile, "role" | "permissions">,
  permission: StaffPermission
): boolean {
  if (profile.role === "admin") return true;
  return profile.permissions.includes(permission);
}
```

- [ ] **Step 4: Add the override loader and wire it into `getStaffProfile`**

Add this helper above `getStaffProfile`:

```ts
async function loadPermissionOverrides(
  supabase: SupabaseClient,
  userId: string
): Promise<PermissionOverride[]> {
  const result = await supabase
    .from("staff_permission_overrides")
    .select("permission, granted")
    .eq("profile_id", userId);
  if (result.error) {
    console.error(
      "[auth] permission overrides lookup failed:",
      result.error.message
    );
    return [];
  }
  return (result.data ?? [])
    .filter((row) => isStaffPermission(row.permission))
    .map((row) => ({
      permission: row.permission as StaffPermission,
      granted: Boolean(row.granted),
    }));
}
```

Then replace the `getStaffProfile` body:

```ts
export const getStaffProfile = cache(async (): Promise<StaffProfile | null> => {
  const supabase = await createAdminSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const profile = await getTeamProfileForUser(supabase, user.id);
  if (!profile || !isOperationsRole(profile.role)) return null;
  const overrides = await loadPermissionOverrides(supabase, user.id);
  return {
    id: profile.id,
    role: profile.role,
    staff_role: profile.staff_role,
    display_name: profile.display_name,
    full_name: profile.full_name,
    permissions: resolvePermissions(profile.staff_role, overrides),
  };
});
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `lib/admin.ts`. (Remaining error: `app/workspace/layout.tsx` still references `menu:manage` — fixed in Task 6.)

- [ ] **Step 6: Commit**

```bash
git add lib/admin.ts
git commit -m "feat: resolve per-staff permission overrides onto StaffProfile"
```

---

### Task 4: Gate the menu page and server actions on the new permissions

**Files:**
- Modify: `app/workspace/menu/page.tsx`
- Modify: `app/workspace/menu/actions.ts`

**Interfaces:**
- Consumes: `requireStaffPermission` (already in `lib/admin.ts`), `getStaffProfile` + `hasStaffPermission` for the page's UI prop.
- Produces: `menu:availability` gates the two availability actions; `menu:configure` gates the five mutation actions; the page passes a `can` prop (defined in Task 5's interface) to `MenuManager`.

- [ ] **Step 1: Re-gate the page and compute the `can` prop**

Replace `app/workspace/menu/page.tsx` with:

```tsx
import { MenuManager } from "@/components/admin/menu/MenuManager";
import { hasStaffPermission, requireStaffPermission } from "@/lib/admin";
import { getMenuManagementData } from "@/lib/menu-management";

export const dynamic = "force-dynamic";
export const metadata = { title: "Menu management" };

export default async function MenuManagementPage() {
  const { profile } = await requireStaffPermission("menu:view", "/workspace/menu");
  const data = await getMenuManagementData();
  const can = {
    configure: hasStaffPermission(profile, "menu:configure"),
    availability: hasStaffPermission(profile, "menu:availability"),
  };
  return <MenuManager initialData={data} can={can} />;
}
```

- [ ] **Step 2: Swap the action gates**

In `app/workspace/menu/actions.ts`:

1. Change the import line `import { requireSuperAdmin } from "@/lib/admin";` to:

```ts
import { requireStaffPermission } from "@/lib/admin";
```

2. In `setProductAvailability` and `setOptionAvailability`, replace:

```ts
  const { profile } = await requireSuperAdmin("/workspace/menu");
```

with:

```ts
  const { profile } = await requireStaffPermission("menu:availability", "/workspace/menu");
```

3. In `saveCategory`, `saveProduct`, `saveOptionGroup`, `saveOption`, and `linkOptionGroup`, replace the same `requireSuperAdmin("/workspace/menu")` line with:

```ts
  const { profile } = await requireStaffPermission("menu:configure", "/workspace/menu");
```

(There are seven call sites total — two availability, five configure. `requireSuperAdmin` must no longer appear in this file.)

- [ ] **Step 3: Verify no stale references and type-check**

Run: `grep -n "requireSuperAdmin" app/workspace/menu/actions.ts ; npx tsc --noEmit`
Expected: `grep` prints nothing for this file; `tsc` shows only the `MenuManager` `can`-prop error (fixed in Task 5) and the `app/workspace/layout.tsx` `menu:manage` error (fixed in Task 6).

- [ ] **Step 4: Commit**

```bash
git add app/workspace/menu/page.tsx app/workspace/menu/actions.ts
git commit -m "feat: gate menu dashboard and actions on view/availability/configure"
```

---

### Task 5: Hide configuration UI for staff without `menu:configure`

**Files:**
- Modify: `components/admin/menu/MenuManager.tsx`

**Interfaces:**
- Consumes: `can` prop from Task 4.
- Produces: `MenuManager({ initialData, can }: { initialData: MenuManagementData; can: { configure: boolean; availability: boolean } })`.

- [ ] **Step 1: Accept the `can` prop**

Change the component signature:

```tsx
export function MenuManager({
  initialData,
  can,
}: {
  initialData: MenuManagementData;
  can: { configure: boolean; availability: boolean };
}) {
```

- [ ] **Step 2: Gate the "Add category / option group" sidebar button**

Wrap the existing sidebar add button (the `<button>` calling `setModal(tab === "products" ? { kind: "category" } : { kind: "group" })`) so it only renders when configuring:

```tsx
{can.configure && (
  <button
    onClick={() =>
      setModal(tab === "products" ? { kind: "category" } : { kind: "group" })
    }
    className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-zb-bone px-4 py-3 text-sm font-bold text-zb-primary-dark shadow-lg transition hover:bg-zb-bone-soft"
  >
    <Plus className="size-4" />
    Add {tab === "products" ? "category" : "option group"}
  </button>
)}
```

- [ ] **Step 3: Gate the category header edit + "Add product" controls**

In the products header, wrap the category-edit pencil button (`setModal({ kind: "category", category: selectedCategory })`) and the "Add product" button (`setModal({ kind: "product", categoryId: selectedCategory.id })`) each in `{can.configure && ( ... )}`.

- [ ] **Step 4: Make product rows non-editable without configure**

In the product `<article>`, the whole card opens the edit modal via `onClick`/`onKeyDown` and `role="button"`. Make those conditional so cashiers cannot open the editor. Replace the article's interactive props with computed ones:

```tsx
<article
  key={item.id}
  {...(can.configure
    ? {
        role: "button" as const,
        tabIndex: 0,
        "aria-label": `Edit ${item.name}`,
        onClick: () =>
          setModal({ kind: "product", item, categoryId: item.category_id }),
        onKeyDown: (event: React.KeyboardEvent) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setModal({ kind: "product", item, categoryId: item.category_id });
          }
        },
      }
    : {})}
  className={`group overflow-hidden rounded-2xl border border-zb-primary/10 bg-[#f7eee6] shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zb-bone ${
    can.configure
      ? "cursor-pointer hover:-translate-y-0.5 hover:border-zb-sage/50 hover:shadow-md"
      : ""
  }`}
>
```

Inside that card, wrap the "Edit product" hint span (the `<span>` containing `<Pencil className="size-3" /> Edit product`) and the "View options" button inside the expanded sizes block in `{can.configure && ( ... )}`. Leave the `Toggle` (availability) and the "Show/Hide sizes" button untouched.

- [ ] **Step 5: Disable the availability Toggle when availability is not granted**

The product `Toggle` already takes a `disabled` prop. Change its `disabled` to also respect the permission:

```tsx
<Toggle
  checked={item.is_active}
  disabled={pendingId === item.id || !can.availability}
  label={`${item.is_active ? "Disable" : "Enable"} ${item.name}`}
  onChange={(active) => toggleItem(item, active)}
/>
```

Apply the same `|| !can.availability` change to the option `Toggle` in the options panel.

- [ ] **Step 6: Gate the options panel controls**

In the options `<header>`, wrap the option-group edit pencil (`setModal({ kind: "group", group: selectedGroup })`), the "Add option" button (`setModal({ kind: "option", groupId: selectedGroup.id })`), and the "Link products" button (`setModal({ kind: "links", group: selectedGroup })`) each in `{can.configure && ( ... )}`.

- [ ] **Step 7: Make option cards non-editable without configure**

Apply the same conditional-interaction pattern from Step 4 to the option `<div role="button">` card: only attach `role`/`tabIndex`/`aria-label`/`onClick`/`onKeyDown` and the `cursor-pointer` hover classes when `can.configure`, and wrap its "Edit option" hint span in `{can.configure && ( ... )}`.

- [ ] **Step 8: Type-check, lint, and build**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors in `components/admin/menu/MenuManager.tsx`. (Remaining: `app/workspace/layout.tsx` `menu:manage` — Task 6.)

- [ ] **Step 9: Commit**

```bash
git add components/admin/menu/MenuManager.tsx
git commit -m "feat: hide menu configuration controls without menu:configure"
```

---

### Task 6: Show the Menu nav link on `menu:view`

**Files:**
- Modify: `app/workspace/layout.tsx`

**Interfaces:**
- Consumes: `hasStaffPermission` with the new permission set.

- [ ] **Step 1: Update the Menu nav gate**

In `app/workspace/layout.tsx`, change the Menu entry in the `nav` array from `menu:manage` to `menu:view`:

```tsx
    ...(hasStaffPermission(profile, "menu:view")
      ? [{ href: "/workspace/menu", label: "Menu", icon: MenuSquare }]
      : []),
```

Leave the `team:manage` Team entry as-is.

- [ ] **Step 2: Type-check, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all pass with no errors. (`menu:manage` no longer appears anywhere — confirm with `grep -rn "menu:manage" app lib components`, expecting no matches.)

- [ ] **Step 3: Commit**

```bash
git add app/workspace/layout.tsx
git commit -m "feat: surface Menu nav link for staff with menu:view"
```

---

### Task 7: Add `updateStaffPermissions` action and expose overrides in management data

**Files:**
- Modify: `lib/staff-invitations.ts`
- Modify: `app/workspace/team/actions.ts`

**Interfaces:**
- Consumes: `GRANTABLE_PERMISSIONS`, `roleDefaultPermissions`, `isStaffPermission`, `PermissionOverride` from `lib/staff-roles.ts`; `requireSuperAdmin` from `lib/admin.ts`; `createAdminClient`.
- Produces:
  - `ManagedStaff` gains `permission_overrides: PermissionOverride[]`.
  - `updateStaffPermissions(_previous: TeamActionState, formData: FormData): Promise<TeamActionState>` — reads `profileId` and one form field per grantable permission (`perm:<permission>` = `"on"` when granted), diffs against role defaults, upserts/deletes override rows, audit-logs, revalidates.

- [ ] **Step 1: Return each member's overrides from `getStaffManagementData`**

In `lib/staff-invitations.ts`:

1. Update the import to include the override type:

```ts
import type { PermissionOverride, StaffJobRole } from "@/lib/staff-roles";
import { isStaffPermission } from "@/lib/staff-roles";
```

2. Add to `ManagedStaff`:

```ts
export type ManagedStaff = {
  id: string;
  email: string;
  display_name: string;
  full_name: string | null;
  role: "admin" | "staff" | "rider";
  staff_role: StaffJobRole | null;
  is_active: boolean;
  created_at: string;
  permission_overrides: PermissionOverride[];
};
```

3. After the `invitationsResult` query and its error check, fetch overrides for the resolved staff ids and attach them. Replace the final `return { staff: ... , invitations: ... }` block with:

```ts
  const overridesResult = await admin
    .from("staff_permission_overrides")
    .select("profile_id, permission, granted");
  if (overridesResult.error) throw overridesResult.error;

  const overridesByProfile = new Map<string, PermissionOverride[]>();
  for (const row of overridesResult.data ?? []) {
    if (!isStaffPermission(row.permission)) continue;
    const list = overridesByProfile.get(row.profile_id) ?? [];
    list.push({ permission: row.permission, granted: Boolean(row.granted) });
    overridesByProfile.set(row.profile_id, list);
  }

  return {
    staff: ((profilesResult.data ?? []) as ManagedStaffRow[])
      .filter((profile) => activeUsersById.has(profile.id))
      .map((profile) => ({
        ...profile,
        full_name: profile.full_name ?? null,
        email: activeUsersById.get(profile.id) ?? "Unknown email",
        permission_overrides: overridesByProfile.get(profile.id) ?? [],
      })),
    invitations: ((invitationsResult.data ?? []) as StaffInvitation[]).map(
      (invite) => ({
        ...invite,
        is_expired: new Date(invite.expires_at).getTime() <= Date.now(),
      })
    ),
  };
```

- [ ] **Step 2: Add the `updateStaffPermissions` server action**

In `app/workspace/team/actions.ts`:

1. Extend the `@/lib/staff-roles` import:

```ts
import {
  GRANTABLE_PERMISSIONS,
  isStaffJobRole,
  isStaffRoleAvailable,
  roleDefaultPermissions,
  STAFF_ROLES,
} from "@/lib/staff-roles";
```

2. Append this action to the file:

```ts
export async function updateStaffPermissions(
  _previous: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  const { profile: actor } = await requireSuperAdmin("/workspace/team");
  const targetId = idSchema.safeParse(formData.get("profileId"));
  if (!targetId.success || targetId.data === actor.id) {
    return { status: "error", message: "That team member could not be found." };
  }

  const admin = createAdminClient();
  const target = await admin
    .from("profiles")
    .select("id, role, staff_role, is_active")
    .eq("id", targetId.data)
    .maybeSingle();
  if (target.error) {
    console.error("[team] permission target lookup failed:", target.error.message);
    return { status: "error", message: "Could not load that team member." };
  }
  if (!target.data || !target.data.is_active) {
    return { status: "error", message: "That team member could not be found." };
  }
  if (target.data.role === "admin") {
    return {
      status: "error",
      message: "Super Admin permissions cannot be edited here.",
    };
  }

  const defaults = new Set(
    roleDefaultPermissions(
      isStaffJobRole(target.data.staff_role) ? target.data.staff_role : null
    )
  );

  const toUpsert: {
    profile_id: string;
    permission: string;
    granted: boolean;
    updated_by: string;
    updated_at: string;
  }[] = [];
  const toClear: string[] = [];
  const now = new Date().toISOString();
  const effective: Record<string, boolean> = {};

  for (const entry of GRANTABLE_PERMISSIONS) {
    const desired = formData.get(`perm:${entry.permission}`) === "on";
    effective[entry.permission] = desired;
    const isDefault = defaults.has(entry.permission);
    if (desired === isDefault) {
      toClear.push(entry.permission);
    } else {
      toUpsert.push({
        profile_id: targetId.data,
        permission: entry.permission,
        granted: desired,
        updated_by: actor.id,
        updated_at: now,
      });
    }
  }

  if (toClear.length) {
    const cleared = await admin
      .from("staff_permission_overrides")
      .delete()
      .eq("profile_id", targetId.data)
      .in("permission", toClear);
    if (cleared.error) {
      console.error("[team] permission clear failed:", cleared.error.message);
      return { status: "error", message: "Could not update permissions." };
    }
  }

  if (toUpsert.length) {
    const upserted = await admin
      .from("staff_permission_overrides")
      .upsert(toUpsert, { onConflict: "profile_id,permission" });
    if (upserted.error) {
      console.error("[team] permission upsert failed:", upserted.error.message);
      return { status: "error", message: "Could not update permissions." };
    }
  }

  await admin.from("audit_logs").insert({
    actor_profile_id: actor.id,
    action: "staff_permissions.updated",
    target_table: "profiles",
    target_id: targetId.data,
    diff: { permissions: effective },
  });

  revalidatePath("/workspace", "layout");
  revalidatePath("/workspace/team");
  return { status: "success", message: "Permissions updated." };
}
```

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/staff-invitations.ts app/workspace/team/actions.ts
git commit -m "feat: add updateStaffPermissions action and expose overrides in team data"
```

---

### Task 8: Staff Access Management UI on the Team page

**Files:**
- Create: `components/admin/StaffPermissionsForm.tsx`
- Modify: `app/workspace/team/page.tsx`

**Interfaces:**
- Consumes: `updateStaffPermissions` + `TeamActionState` from `app/workspace/team/actions.ts`; `GRANTABLE_PERMISSIONS`, `roleDefaultPermissions`, `STAFF_ROLES` from `lib/staff-roles.ts`; `ManagedStaff.permission_overrides`.
- Produces: `StaffPermissionsForm` client component rendered per non-admin member.

- [ ] **Step 1: Build the permissions form component**

Create `components/admin/StaffPermissionsForm.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { SlidersHorizontal } from "lucide-react";
import {
  updateStaffPermissions,
  type TeamActionState,
} from "@/app/workspace/team/actions";
import {
  GRANTABLE_PERMISSIONS,
  roleDefaultPermissions,
  type PermissionOverride,
  type StaffJobRole,
} from "@/lib/staff-roles";

const initial: TeamActionState = { status: "idle" };

export function StaffPermissionsForm({
  profileId,
  staffRole,
  overrides,
}: {
  profileId: string;
  staffRole: StaffJobRole | null;
  overrides: PermissionOverride[];
}) {
  const [state, action, pending] = useActionState(
    updateStaffPermissions,
    initial
  );

  const defaults = new Set(roleDefaultPermissions(staffRole));
  const overrideMap = new Map(
    overrides.map((entry) => [entry.permission, entry.granted])
  );
  const effective = (permission: string, isDefault: boolean) =>
    overrideMap.has(permission) ? overrideMap.get(permission)! : isDefault;

  const sections = ["Dashboard", "Orders", "Menu"] as const;

  return (
    <form
      action={action}
      className="mt-3 rounded-xl border border-zb-sage/20 bg-zb-primary-dark/30 p-4"
    >
      <input type="hidden" name="profileId" value={profileId} />
      <div className="flex items-center gap-2 text-zb-cream/75">
        <SlidersHorizontal className="size-4 text-zb-bone" />
        <span className="text-sm font-semibold">Manage permissions</span>
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        {sections.map((section) => (
          <fieldset key={section} className="space-y-2">
            <legend className="text-[11px] font-bold uppercase tracking-[0.12em] text-zb-cream/45">
              {section}
            </legend>
            {GRANTABLE_PERMISSIONS.filter(
              (entry) => entry.section === section
            ).map((entry) => {
              const isDefault = defaults.has(entry.permission);
              return (
                <label
                  key={entry.permission}
                  className="flex items-start gap-2 rounded-lg border border-zb-sage/15 bg-zb-primary/40 p-2 text-sm"
                >
                  <input
                    type="checkbox"
                    name={`perm:${entry.permission}`}
                    defaultChecked={effective(entry.permission, isDefault)}
                    className="mt-0.5 size-4 accent-zb-bone"
                  />
                  <span>
                    <span className="block font-medium text-zb-cream">
                      {entry.label}
                      {isDefault && (
                        <span className="ml-1 text-[10px] uppercase text-zb-cream/40">
                          default
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-zb-cream/45">
                      {entry.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>
        ))}
      </div>
      {state.status !== "idle" && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className="mt-3 rounded-lg border border-zb-bone/30 px-3 py-2 text-xs"
        >
          {state.message}
        </p>
      )}
      <button
        disabled={pending}
        className="mt-3 h-9 rounded-lg bg-zb-bone px-4 text-xs font-semibold text-zb-primary-dark disabled:opacity-55"
      >
        {pending ? "Saving…" : "Save permissions"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Render the form for each non-admin member**

In `app/workspace/team/page.tsx`:

1. Add the import:

```tsx
import { StaffPermissionsForm } from "@/components/admin/StaffPermissionsForm";
```

2. In the team-members list, the current layout puts member info and the revoke control in a flex row. Below that row (still inside the member's wrapping `<div key={member.id} ...>`), render the permissions form for every active non-admin member that is not the current user. Change the wrapper `<div>` to stack vertically and append the form. Replace the member block's inner content so the existing info/`RevokeStaffAccessForm` row stays in a sub-row and the form follows:

```tsx
<div
  key={member.id}
  className="border-b border-zb-sage/20 bg-zb-primary-strong/45 p-4 last:border-b-0"
>
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold">{member.display_name}</p>
        <span className="rounded-full bg-zb-bone/10 px-2 py-0.5 text-[10px] font-bold uppercase text-zb-bone">
          {roleLabel}
        </span>
        {!member.is_active && (
          <span className="text-xs text-zb-danger">Revoked</span>
        )}
      </div>
      {member.full_name && member.full_name !== member.display_name && (
        <p className="text-sm text-zb-cream/70">{member.full_name}</p>
      )}
      <p className="text-sm text-zb-cream/55">{member.email}</p>
    </div>
    {member.id === current.id ? (
      <span className="text-xs text-zb-cream/45">Your account</span>
    ) : (
      <RevokeStaffAccessForm profileId={member.id} />
    )}
  </div>
  {member.role !== "admin" &&
    member.is_active &&
    member.id !== current.id && (
      <StaffPermissionsForm
        profileId={member.id}
        staffRole={member.staff_role}
        overrides={member.permission_overrides}
      />
    )}
</div>
```

- [ ] **Step 3: Type-check, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all pass, no errors.

- [ ] **Step 4: Manual verification (end-to-end)**

Run the app (`npm run dev`) and verify, signed in as the Super Admin:

1. `/workspace/team` shows a "Manage permissions" panel for the cashier, with `View menu` and `Toggle availability` checked (defaults) and `Configure menu` unchecked.
2. Sign in as the cashier (separate session): the **Menu** nav link is visible; `/workspace/menu` loads; availability toggles work; no Add/Edit/Link controls appear; product/option cards do not open editors.
3. As cashier, confirm a configure mutation is server-blocked — e.g. via devtools the `saveCategory` action returns the generic failure / redirect (it must not create a category).
4. As Super Admin, check `Configure menu` for the cashier and Save. As the cashier (after refresh), the Add/Edit/Link controls now appear and `saveCategory` succeeds.
5. As Super Admin, uncheck `Configure menu` (back to default) and Save; confirm the override row is removed (cashier loses edit again).
6. As Super Admin, uncheck a default like `Toggle availability` and Save; confirm the cashier's availability toggles become disabled (force-off override works).

- [ ] **Step 5: Commit**

```bash
git add components/admin/StaffPermissionsForm.tsx app/workspace/team/page.tsx
git commit -m "feat: add Staff Access Management permissions UI to team page"
```

---

## Self-Review Notes

- **Spec coverage:** §1 catalog → Task 1; §2 overrides table → Task 2; resolution onto profile → Task 3; §3 menu enforcement (page + actions + UI) → Tasks 4–5; §5 nav → Task 6; §4 management action + data → Task 7, management UI → Task 8; §6 testing → Task 2 (pgTAP) + Task 8 Step 4 (manual matrix). Decisions (`team:manage` not grantable, `menu:configure` grantable-but-off, app-code resolution) are enforced in Tasks 1, 3, 7.
- **Type consistency:** `permissions: StaffPermission[]` (Task 3) is read by `hasStaffPermission` (Task 3) and produced by `resolvePermissions` (Task 1). `can: { configure, availability }` is produced in Task 4 and consumed in Task 5. `permission_overrides: PermissionOverride[]` is produced in Task 7 and consumed in Task 8. Form field convention `perm:<permission>` matches between Task 7 (read) and Task 8 (write). `onConflict: "profile_id,permission"` matches the PK from Task 2.
- **No JS test runner:** intentional per Global Constraints; TS verified by `tsc`/`lint`/`build`, SQL by `supabase test db`, behavior by the manual matrix.
</content>
