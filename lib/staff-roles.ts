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
  | "menu:manage"
  | "team:manage"
  | "deliveries:view"
  | "deliveries:manage";

const ROLE_PERMISSIONS: Record<StaffJobRole, readonly StaffPermission[]> = {
  cashier: ["dashboard:view", "orders:view", "orders:manage"],
  rider: ["deliveries:view", "deliveries:manage"],
};

export function isStaffJobRole(value: unknown): value is StaffJobRole {
  return typeof value === "string" && value in STAFF_ROLES;
}

export function isStaffRoleAvailable(role: StaffJobRole): boolean {
  return STAFF_ROLES[role].available;
}

export function roleHasPermission(
  role: StaffJobRole,
  permission: StaffPermission
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
