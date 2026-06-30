"use client";

import { useState, useTransition } from "react";
import {
  Bike,
  Check,
  ChevronDown,
  Loader2,
  UserRoundCheck,
  UserRoundX,
} from "lucide-react";
import { Select } from "@base-ui/react/select";
import {
  assignRider,
  type ActionResult,
  type OrderStatus,
} from "@/app/workspace/orders/actions";
import type { RiderAssignment, RiderOption } from "@/components/admin/OrderCard";

const NO_RIDER_VALUE = "__choose_rider__";

function riderLabel(rider: RiderOption) {
  return [rider.display_name, rider.vehicle_type, rider.plate_no]
    .filter(Boolean)
    .join(" - ");
}

export function RiderAssignmentControl({
  orderId,
  status,
  riders,
  assignment,
}: {
  orderId: string;
  status: OrderStatus;
  riders: RiderOption[];
  assignment: RiderAssignment | null;
}) {
  const [selected, setSelected] = useState(() =>
    assignment && riders.some((rider) => rider.id === assignment.rider_profile_id)
      ? assignment.rider_profile_id
      : ""
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const locked = status === "out_for_delivery" || status === "completed";
  const selectedRider = riders.find((rider) => rider.id === selected);

  function run(fn: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error);
    });
  }

  if (locked) {
    return assignment ? (
      <p className="mt-3 flex items-center gap-1.5 rounded-lg border border-zb-sage/25 bg-zb-primary px-3 py-2 text-xs text-zb-cream/75">
        <Bike className="size-3.5 text-zb-bone" /> Rider: {assignment.display_name}
      </p>
    ) : null;
  }

  return (
    <div className="mt-3 rounded-xl border border-zb-sage/25 bg-zb-primary/60 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-zb-cream/60">
        <Bike className="size-3.5 text-zb-bone" /> Delivery rider
      </p>
      {riders.length > 0 ? (
        <div className="mt-2 flex gap-2">
          <Select.Root
            value={selected || NO_RIDER_VALUE}
            onValueChange={(value) =>
              setSelected(value === NO_RIDER_VALUE || !value ? "" : value)
            }
            disabled={pending}
          >
            <Select.Trigger
              aria-label="Delivery rider"
              className="group flex h-9 min-w-0 flex-1 items-center rounded-md border border-zb-sage/30 bg-zb-primary px-2.5 text-left text-xs font-semibold text-zb-cream shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition hover:border-zb-sage/55 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-55 data-[popup-open]:border-zb-bone/70 data-[popup-open]:ring-2 data-[popup-open]:ring-zb-bone/10 focus-visible:border-zb-bone/70 focus-visible:ring-2 focus-visible:ring-zb-bone/15"
            >
              <span className="min-w-0 flex-1 truncate">
                {selectedRider ? riderLabel(selectedRider) : "Choose rider"}
              </span>
              <ChevronDown className="ml-2 size-3.5 shrink-0 text-zb-cream/50 transition group-data-[popup-open]:rotate-180 group-data-[popup-open]:text-zb-bone" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner
                sideOffset={6}
                align="start"
                alignItemWithTrigger={false}
                className="z-[80]"
              >
                <Select.Popup className="w-[var(--anchor-width)] min-w-64 origin-[var(--transform-origin)] overflow-hidden rounded-lg border border-zb-bone/35 bg-zb-primary-dark p-1.5 text-zb-cream shadow-[0_20px_55px_rgba(0,0,0,0.55)] outline-none transition data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
                  <Select.List className="max-h-60 overflow-y-auto overscroll-contain [scrollbar-color:rgba(229,192,123,0.6)_transparent] [scrollbar-width:thin]">
                    <Select.Item
                      value={NO_RIDER_VALUE}
                      className="grid min-h-9 cursor-default grid-cols-[1fr_auto] items-center gap-3 rounded-md px-2.5 text-xs font-semibold text-zb-cream/58 outline-none transition data-[highlighted]:bg-zb-sage/18 data-[highlighted]:text-zb-cream data-[selected]:bg-zb-bone data-[selected]:text-zb-primary-dark"
                    >
                      <Select.ItemText>Choose rider</Select.ItemText>
                      <Select.ItemIndicator>
                        <Check className="size-3.5" />
                      </Select.ItemIndicator>
                    </Select.Item>
                    {riders.map((rider) => (
                      <Select.Item
                        key={rider.id}
                        value={rider.id}
                        className="group grid min-h-11 cursor-default grid-cols-[1fr_auto] items-center gap-3 rounded-md px-2.5 py-1.5 text-xs text-zb-cream/80 outline-none transition data-[highlighted]:bg-zb-sage/22 data-[highlighted]:text-zb-cream data-[selected]:bg-zb-bone data-[selected]:text-zb-primary-dark"
                      >
                        <Select.ItemText>
                          <span className="block truncate font-semibold">
                            {rider.display_name}
                          </span>
                          {(rider.vehicle_type || rider.plate_no) && (
                            <span className="mt-0.5 block truncate text-[11px] text-zb-cream/45 group-data-[selected]:text-zb-primary-dark/70">
                              {[rider.vehicle_type, rider.plate_no]
                                .filter(Boolean)
                                .join(" - ")}
                            </span>
                          )}
                        </Select.ItemText>
                        <Select.ItemIndicator>
                          <Check className="size-3.5" />
                        </Select.ItemIndicator>
                      </Select.Item>
                    ))}
                  </Select.List>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
          <button
            type="button"
            disabled={pending || !selected || selected === assignment?.rider_profile_id}
            onClick={() => run(() => assignRider(orderId, selected))}
            className="inline-flex items-center gap-1 rounded-md bg-zb-bone px-2.5 py-1.5 text-xs font-semibold text-zb-primary-dark transition hover:bg-zb-bone/85 disabled:opacity-45"
          >
            <UserRoundCheck className="size-3.5" />
            {assignment ? "Reassign" : "Assign"}
          </button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-zb-cream/45">No active, available riders.</p>
      )}

      {assignment && (
        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
          <span className="text-zb-cream/65">Assigned to {assignment.display_name}</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => assignRider(orderId, null))}
            className="inline-flex items-center gap-1 font-semibold text-zb-danger hover:underline disabled:opacity-45"
          >
            <UserRoundX className="size-3.5" /> Unassign
          </button>
        </div>
      )}

      {pending && <Loader2 className="mt-2 size-4 animate-spin text-zb-cream/50" />}
      {error && <p className="mt-2 text-xs text-zb-danger">{error}</p>}
    </div>
  );
}
