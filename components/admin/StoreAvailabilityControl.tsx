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
