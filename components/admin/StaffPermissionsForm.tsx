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
  type StaffPermission,
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
  const effective = (permission: StaffPermission, isDefault: boolean) =>
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
