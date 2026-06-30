"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, PackageCheck } from "lucide-react";
import {
  markDelivered,
  markPickedUp,
  type RiderActionResult,
} from "@/app/rider/actions";

type Props = {
  orderId: string;
  status: "ready" | "out_for_delivery" | "completed";
  pickedUpAt: string | null;
  paymentMethod: string | null;
  paymentStatus: string | null;
};

export function RiderDeliveryActions({
  orderId,
  status,
  pickedUpAt,
  paymentMethod,
  paymentStatus,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<RiderActionResult>, donePath?: string) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
      if (result.ok && donePath) router.replace(donePath);
    });
  }

  const canPickUp = status === "ready" || (status === "out_for_delivery" && !pickedUpAt);
  const canDeliver = status === "out_for_delivery";
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
