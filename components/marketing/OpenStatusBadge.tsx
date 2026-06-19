"use client";

import { useEffect, useState } from "react";
import { isStoreOpen } from "@/lib/checkout";

const SCHEDULE = "8 AM – 8 PM (WEEKENDS TIL 9)";

// Live open/closed indicator for the hero. Renders a neutral first paint
// (matching the server) to avoid a hydration mismatch on statically cached
// pages, then reflects real status on mount and re-checks every 30s so it
// flips on its own at opening and closing time.
export function OpenStatusBadge() {
  const [open, setOpen] = useState<boolean | null>(null);

  useEffect(() => {
    const refresh = () => setOpen(isStoreOpen());
    refresh();
    const id = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const label =
    open === null
      ? `OPEN DAILY · ${SCHEDULE}`
      : open
        ? `OPEN NOW · ${SCHEDULE}`
        : "CLOSED · OPENS 8 AM";

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-zb-sage/40 bg-zb-primary-strong/60 px-3 py-1 text-xs font-semibold tracking-widest text-zb-bone">
      <span
        className={`size-2 rounded-full ${
          open === false ? "bg-zb-cream/40" : "bg-emerald-400 animate-pulse"
        }`}
      />
      {label}
    </div>
  );
}
