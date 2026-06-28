"use client";

import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useTransition } from "react";

type RiderRefreshButtonProps = {
  label?: string;
};

export function RiderRefreshButton({
  label = "Refresh",
}: RiderRefreshButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-zb-sage/30 bg-zb-primary-strong px-3 text-xs font-semibold text-zb-cream/80 transition hover:bg-zb-primary hover:text-zb-cream disabled:cursor-wait disabled:opacity-65"
      aria-label="Refresh deliveries"
    >
      <RefreshCw
        className={`size-4 text-zb-bone ${pending ? "animate-spin" : ""}`}
        aria-hidden
      />
      <span>{pending ? "Refreshing" : label}</span>
    </button>
  );
}
