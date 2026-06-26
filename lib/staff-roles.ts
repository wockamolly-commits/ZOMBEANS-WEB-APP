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
