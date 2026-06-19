"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { isKitchenClosingSoon, minutesUntilClose } from "@/lib/checkout";

// "Kitchen Closing Soon" alert shown only during the final 15 minutes before
// the café closes, nudging customers to order before the kitchen stops taking
// orders. Renders nothing outside that window. Like OpenStatusBadge, it does a
// neutral first paint (null) to avoid a hydration mismatch on statically cached
// pages, then re-checks every 30s so it appears, counts down, and clears on its
// own without a reload.
export function KitchenClosingBanner() {
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);

  useEffect(() => {
    const refresh = () =>
      setMinutesLeft(isKitchenClosingSoon() ? minutesUntilClose() : null);
    refresh();
    const id = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(id);
  }, []);

  if (minutesLeft === null) return null;

  const countdown =
    minutesLeft <= 1 ? "less than a minute" : `about ${minutesLeft} minutes`;

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-zb-bone/50 bg-zb-bone/10 px-4 py-3 text-sm"
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-zb-bone" />
      <div>
        <p className="font-semibold text-zb-bone">Kitchen closing soon</p>
        <p className="mt-0.5 leading-6 text-zb-cream/80">
          We stop taking orders in {countdown}. Place your order now so we can
          get it brewing before close.
        </p>
      </div>
    </div>
  );
}
