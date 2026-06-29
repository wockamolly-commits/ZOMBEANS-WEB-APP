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
