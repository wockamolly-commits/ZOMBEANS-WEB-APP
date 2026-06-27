import { AlertTriangle, Clock3 } from "lucide-react";
import { getStoreAvailability } from "@/lib/store-availability-data";

function formatUntil(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date(iso));
}

export async function StoreClosedNotice() {
  const state = await getStoreAvailability();

  if (!state.isOpen) {
    const until = formatUntil(state.closedUntil);
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-xl border border-zb-danger/50 bg-zb-danger/10 px-4 py-3 text-sm"
      >
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-zb-danger" />
        <div>
          <p className="font-semibold text-zb-cream">Currently closed</p>
          <p className="mt-0.5 leading-6 text-zb-cream/80">
            {state.closureLabel ?? "We've paused online orders for now."}
            {until ? ` We expect to reopen around ${until}.` : ""}
          </p>
        </div>
      </div>
    );
  }

  if (state.highDemand) {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-xl border border-zb-bone/50 bg-zb-bone/10 px-4 py-3 text-sm"
      >
        <Clock3 className="mt-0.5 size-5 shrink-0 text-zb-bone" />
        <div>
          <p className="font-semibold text-zb-bone">Busier than usual</p>
          <p className="mt-0.5 leading-6 text-zb-cream/80">
            Orders are taking a little longer right now — thanks for your
            patience.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
