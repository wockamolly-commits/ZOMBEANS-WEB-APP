"use client";

import { useState, useTransition } from "react";
import { Bike, Loader2, UserRoundCheck, UserRoundX } from "lucide-react";
import {
  assignRider,
  type ActionResult,
  type OrderStatus,
} from "@/app/workspace/orders/actions";
import type { RiderAssignment, RiderOption } from "@/components/admin/OrderCard";

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
          <select
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            disabled={pending}
            aria-label="Delivery rider"
            className="min-w-0 flex-1 rounded-md border border-zb-sage/30 bg-zb-primary px-2.5 py-1.5 text-xs text-zb-cream focus:border-zb-bone focus:outline-none"
          >
            <option value="">Choose rider</option>
            {riders.map((rider) => (
              <option key={rider.id} value={rider.id}>
                {rider.display_name}{rider.vehicle_type ? ` · ${rider.vehicle_type}` : ""}{rider.plate_no ? ` · ${rider.plate_no}` : ""}
              </option>
            ))}
          </select>
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