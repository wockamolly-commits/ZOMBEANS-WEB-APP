"use client";

import { BellPlus, Smartphone, Volume2 } from "lucide-react";
import { usePushSubscription } from "@/lib/use-push-subscription";

/**
 * Opt-in affordance for locked-screen/backgrounded order alerts (Web Push).
 * Supplements — does not replace — the in-tab audio+toast alerts driven by
 * CustomerOrderNotificationsProvider. Mirrors that provider's "tap to enable
 * sound alerts" pill pattern: explicit tap, no auto-prompt.
 */
export function CustomerPushOptIn({ orderCode }: { orderCode: string }) {
  const { status, subscribe, isIos } = usePushSubscription({
    role: "customer",
    orderCode,
  });

  if (status === "ios-install-required") {
    return (
      <div className="fixed inset-x-0 bottom-36 z-[80] flex justify-center px-4">
        <div className="zb-reveal flex max-w-md flex-col gap-1.5 rounded-2xl border border-zb-bone/45 bg-zb-primary-dark/95 px-4 py-3 text-xs font-semibold text-zb-bone shadow-[0_18px_50px_rgba(0,0,0,0.5)] backdrop-blur">
          <span className="flex items-center gap-2">
            <Smartphone className="size-4 shrink-0" aria-hidden />
            Add Zombeans to your Home Screen to get order alerts when your phone
            is locked.
          </span>
          <span className="flex items-center gap-2 text-[11px] font-medium text-zb-bone/70">
            <Volume2 className="size-3.5 shrink-0" aria-hidden />
            Flip the silent switch off so the alert sound plays.
          </span>
        </div>
      </div>
    );
  }

  // On iOS, notification sound and haptics follow the hardware ringer/silent
  // switch and iOS notification settings — the web app can't override them, so
  // tell the customer how to make sure they'll hear the alert.
  if (status === "subscribed" && isIos) {
    return (
      <div className="fixed inset-x-0 bottom-36 z-[80] flex justify-center px-4">
        <div className="zb-reveal flex max-w-md items-center gap-2 rounded-full border border-zb-bone/40 bg-zb-primary-dark/90 px-4 py-2 text-[11px] font-medium text-zb-bone/80 shadow-[0_18px_50px_rgba(0,0,0,0.5)] backdrop-blur">
          <Volume2 className="size-3.5 shrink-0" aria-hidden />
          Order alerts are on. Keep your ringer on (silent switch off) to hear
          them.
        </div>
      </div>
    );
  }

  if (status !== "default") return null;

  return (
    <div className="fixed inset-x-0 bottom-36 z-[80] flex justify-center px-4">
      <button
        type="button"
        onClick={subscribe}
        className="zb-reveal inline-flex items-center gap-2 rounded-full border border-zb-bone/50 bg-zb-primary-dark/95 px-4 py-2.5 text-sm font-semibold text-zb-bone shadow-[0_18px_50px_rgba(0,0,0,0.5)] backdrop-blur transition hover:border-zb-bone/80 hover:bg-zb-primary-dark"
      >
        <BellPlus className="size-4" aria-hidden />
        Get alerts even when your phone is locked
      </button>
    </div>
  );
}
