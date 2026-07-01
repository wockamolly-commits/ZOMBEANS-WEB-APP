"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellRing, CheckCircle2, Loader2, MapPin, PackageCheck } from "lucide-react";
import {
  markDelivered,
  markPickedUp,
  notifyRiderOutside,
  type RiderActionResult,
} from "@/app/rider/actions";

type Props = {
  orderId: string;
  status: "ready" | "out_for_delivery" | "completed";
  pickedUpAt: string | null;
  arrivedAt: string | null;
  customerRingAt: string | null;
  paymentMethod: string | null;
  paymentStatus: string | null;
};

const NOTIFY_AGAIN_COOLDOWN_MS = 30_000;

export function RiderDeliveryActions({
  orderId,
  status,
  pickedUpAt,
  arrivedAt,
  customerRingAt,
  paymentMethod,
  paymentStatus,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notifying, startNotifying] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [outsideNotified, setOutsideNotified] = useState(Boolean(arrivedAt));
  const [lastNotifiedAt, setLastNotifiedAt] = useState<number | null>(() => {
    const parsed = Date.parse(customerRingAt ?? arrivedAt ?? "");
    return Number.isFinite(parsed) ? parsed : null;
  });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!outsideNotified) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [outsideNotified]);

  function run(action: () => Promise<RiderActionResult>, donePath?: string) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
      if (result.ok && donePath) router.replace(donePath);
    });
  }

  function notifyOutside() {
    setError(null);
    startNotifying(async () => {
      const result = await notifyRiderOutside(orderId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOutsideNotified(true);
      setLastNotifiedAt(Date.now());
      setNow(Date.now());
    });
  }

  const canPickUp = status === "ready" || (status === "out_for_delivery" && !pickedUpAt);
  const canDeliver = status === "out_for_delivery";
  const notifyAgainRemainingMs =
    outsideNotified && lastNotifiedAt
      ? Math.max(0, NOTIFY_AGAIN_COOLDOWN_MS - (now - lastNotifiedAt))
      : 0;
  const notifyDisabled =
    notifying || (outsideNotified && notifyAgainRemainingMs > 0);
  const notifyAgainSeconds = Math.ceil(notifyAgainRemainingMs / 1_000);
  const deliveryLabel =
    paymentMethod === "cash" && paymentStatus !== "paid"
      ? "Collect & deliver"
      : "Delivered";

  return (
    <div className="space-y-2">
      {error && (
        <p role="alert" className="rounded-lg bg-zb-danger/10 px-3 py-2 text-sm text-[#e89a90]">
          {error}
        </p>
      )}
      {canDeliver && (
        <button
          type="button"
          disabled={notifyDisabled}
          onClick={notifyOutside}
          aria-live="polite"
          className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition disabled:opacity-45 ${
            outsideNotified
              ? "border-zb-bone/60 bg-zb-bone/20 text-zb-bone hover:bg-zb-bone/25"
              : "border-zb-bone/45 bg-zb-bone/10 text-zb-bone hover:bg-zb-bone/15"
          }`}
        >
          {notifying ? (
            <Loader2 className="size-4 animate-spin" />
          ) : outsideNotified ? (
            <BellRing className="size-4" />
          ) : (
            <MapPin className="size-4" />
          )}
          {notifying
            ? "Ringing customer..."
            : outsideNotified && notifyAgainRemainingMs > 0
              ? `Notify again in ${notifyAgainSeconds}s`
            : outsideNotified
              ? "Notify Again"
              : "I'm outside - notify customer"}
        </button>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={pending || !canPickUp}
          onClick={() => run(() => markPickedUp(orderId))}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-zb-sage/35 px-4 text-sm font-semibold text-zb-cream transition hover:bg-zb-primary disabled:opacity-45"
        >
          {pending && canPickUp ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <PackageCheck className="size-4 text-zb-bone" />
          )}
          Picked up
        </button>
        <button
          type="button"
          disabled={pending || !canDeliver}
          onClick={() => run(() => markDelivered(orderId), "/rider")}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-zb-bone px-4 text-sm font-semibold text-zb-primary-dark transition hover:bg-zb-bone-soft disabled:opacity-45"
        >
          {pending && canDeliver ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          {deliveryLabel}
        </button>
      </div>
    </div>
  );
}
