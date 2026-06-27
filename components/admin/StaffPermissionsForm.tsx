"use client";

import { useActionState, useId, useMemo, useState, useSyncExternalStore } from "react";
import {
  ChevronDown,
  LayoutDashboard,
  Power,
  ReceiptText,
  SlidersHorizontal,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import {
  updateStaffPermissions,
  type TeamActionState,
} from "@/app/workspace/team/actions";
import {
  GRANTABLE_PERMISSIONS,
  roleDefaultPermissions,
  type GrantablePermission,
  type PermissionOverride,
  type StaffJobRole,
  type StaffPermission,
} from "@/lib/staff-roles";

const initial: TeamActionState = { status: "idle" };

const SECTIONS = ["Dashboard", "Orders", "Menu", "Store"] as const;

// Shared across members so collapsing one applies the preference everywhere,
// keeping the team list compact once the admin picks a reading mode.
const OPEN_STORAGE_KEY = "zb:staff-perms-open";

function getOpenSnapshot(): boolean {
  try {
    return window.localStorage.getItem(OPEN_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

const OPEN_EVENT = "zb:staff-perms-open-change";

function subscribeOpen(callback: () => void): () => void {
  window.addEventListener(OPEN_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(OPEN_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

const SECTION_META: Record<
  GrantablePermission["section"],
  { icon: LucideIcon }
> = {
  Dashboard: { icon: LayoutDashboard },
  Orders: { icon: ReceiptText },
  Menu: { icon: UtensilsCrossed },
  Store: { icon: Power },
};

// Custom gold switch — the recognizable element. Driven by the row's sr-only
// checkbox (the actual form input) via `checked`, with a focus ring forwarded
// from that input so the control stays keyboard-accessible.
function Switch({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-zb-bone/70 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-zb-primary ${
        on
          ? "border-zb-bone bg-zb-bone"
          : "border-zb-sage/35 bg-zb-primary-dark/70"
      }`}
    >
      <span
        className={`absolute size-3.5 rounded-full shadow-sm transition-all duration-200 ${
          on
            ? "translate-x-[19px] bg-zb-primary-dark"
            : "translate-x-[3px] bg-zb-cream/55"
        }`}
      />
    </span>
  );
}

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

  const defaults = useMemo(
    () => new Set(roleDefaultPermissions(staffRole)),
    [staffRole]
  );

  // Effective baseline = role defaults with each override forcing a permission
  // on or off. This seeds the live toggle state and the dirty comparison.
  const baseline = useMemo(() => {
    const overrideMap = new Map(
      overrides.map((entry) => [entry.permission, entry.granted])
    );
    const set = new Set<StaffPermission>();
    for (const entry of GRANTABLE_PERMISSIONS) {
      const isOn = overrideMap.has(entry.permission)
        ? overrideMap.get(entry.permission)!
        : defaults.has(entry.permission);
      if (isOn) set.add(entry.permission);
    }
    return set;
  }, [overrides, defaults]);

  const [enabled, setEnabled] = useState<Set<StaffPermission>>(
    () => new Set(baseline)
  );

  const toggle = (permission: StaffPermission) =>
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
      return next;
    });

  const dirty =
    enabled.size !== baseline.size ||
    [...enabled].some((permission) => !baseline.has(permission));

  const panelId = useId();
  const open = useSyncExternalStore(subscribeOpen, getOpenSnapshot, () => false);

  const toggleOpen = () => {
    try {
      window.localStorage.setItem(OPEN_STORAGE_KEY, open ? "0" : "1");
    } catch {
      // ignore unavailable storage
    }
    window.dispatchEvent(new Event(OPEN_EVENT));
  };

  return (
    <form
      action={action}
      className="mt-3 max-w-2xl overflow-hidden rounded-2xl border border-zb-sage/20 bg-gradient-to-b from-zb-primary-dark/45 to-zb-primary-strong/35 shadow-[inset_0_1px_0_rgba(229,192,123,0.06)]"
    >
      <input type="hidden" name="profileId" value={profileId} />

      {/* Header — doubles as the expand/collapse toggle */}
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-controls={panelId}
        className={`flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-zb-bone/[0.04] ${
          open ? "border-b border-zb-sage/15" : ""
        }`}
      >
        <span className="flex size-8 items-center justify-center rounded-lg bg-zb-bone/12 ring-1 ring-zb-bone/25">
          <SlidersHorizontal className="size-4 text-zb-bone" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight text-zb-cream">
            Manage permissions
          </p>
          <p className="text-[11px] leading-tight text-zb-cream/45">
            Override the role defaults for this member.
          </p>
        </div>
        <span className="ml-auto flex items-center gap-1.5 font-mono-tabular text-[11px] font-medium text-zb-cream/45">
          {dirty && (
            <span
              className="size-1.5 rounded-full bg-zb-bone"
              title="Unsaved changes"
            />
          )}
          {enabled.size}/{GRANTABLE_PERMISSIONS.length} on
        </span>
        <span className="flex items-center gap-1.5 border-l border-zb-sage/15 pl-2.5 text-[11px] font-semibold text-zb-cream/70">
          <span className="hidden sm:inline">
            {open ? "Hide" : "Show"} permissions
          </span>
          <ChevronDown
            className={`size-4 transition-transform duration-300 ${
              open ? "rotate-180" : ""
            }`}
          />
        </span>
      </button>

      {/* Collapsible body — grid-rows trick animates to/from auto height */}
      <div
        id={panelId}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          {/* Control groups */}
          <div className="divide-y divide-zb-sage/10">
        {SECTIONS.map((section) => {
          const items = GRANTABLE_PERMISSIONS.filter(
            (entry) => entry.section === section
          );
          if (items.length === 0) return null;
          const Icon = SECTION_META[section].icon;
          const onCount = items.filter((entry) =>
            enabled.has(entry.permission)
          ).length;

          return (
            <fieldset key={section} className="px-2 py-2.5">
              <legend className="flex w-full items-center gap-2 px-2 pb-1">
                <Icon className="size-3.5 text-zb-bone/80" />
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-zb-cream/55">
                  {section}
                </span>
                <span className="ml-auto font-mono-tabular text-[10px] text-zb-cream/35">
                  {onCount}/{items.length}
                </span>
              </legend>

              <div className="space-y-0.5">
                {items.map((entry) => {
                  const on = enabled.has(entry.permission);
                  const isDefault = defaults.has(entry.permission);
                  return (
                    <label
                      key={entry.permission}
                      className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-zb-bone/[0.05]"
                    >
                      <input
                        type="checkbox"
                        name={`perm:${entry.permission}`}
                        checked={on}
                        onChange={() => toggle(entry.permission)}
                        className="peer sr-only"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium text-zb-cream">
                            {entry.label}
                          </span>
                          {isDefault && (
                            <span className="shrink-0 rounded bg-zb-sage/15 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-zb-sage/90">
                              default
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-xs leading-snug text-zb-cream/45">
                          {entry.description}
                        </span>
                      </span>
                      <Switch on={on} />
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>

      {/* Action bar — status + save merged into one anchored footer */}
      <div className="flex flex-col gap-2.5 border-t border-zb-sage/15 bg-zb-primary-dark/25 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`text-xs ${
            state.status === "error"
              ? "text-zb-danger"
              : state.status === "success"
                ? "text-zb-bone"
                : dirty
                  ? "text-zb-cream/60"
                  : "text-zb-cream/35"
          }`}
        >
          {state.status !== "idle"
            ? state.message
            : dirty
              ? "Unsaved changes"
              : "All changes saved"}
        </p>
        <button
          disabled={pending || !dirty}
          className="inline-flex h-9 items-center justify-center rounded-lg bg-zb-bone px-4 text-xs font-semibold text-zb-primary-dark transition-opacity hover:bg-zb-bone-soft disabled:cursor-not-allowed disabled:opacity-45"
        >
          {pending ? "Saving…" : "Save permissions"}
        </button>
      </div>
        </div>
      </div>
    </form>
  );
}
