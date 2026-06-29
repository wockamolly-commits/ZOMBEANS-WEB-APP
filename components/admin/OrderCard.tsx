"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Bike,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Phone,
  ShoppingBag,
  Store,
  Timer,
  Utensils,
  X,
} from "lucide-react";
import { formatPeso } from "@/lib/peso";
import { RiderAssignmentControl } from "@/components/admin/RiderAssignmentControl";
import {
  advanceOrder,
  recordPayment,
  rejectOrder,
  type ActionResult,
  type OrderStatus,
} from "@/app/workspace/orders/actions";
import {
  ORDER_REJECTION_REASONS,
  type OrderRejectionReason,
} from "@/lib/order-rejection";

export type RiderOption = {
  id: string;
  display_name: string;
  vehicle_type: string | null;
  plate_no: string | null;
};

export type RiderAssignment = {
  rider_profile_id: string;
  display_name: string;
};

export type AdminOrder = {
  id: string;
  short_code: string;
  status: OrderStatus;
  service_mode: "dine_in" | "take_out" | "pickup" | "delivery";
  customer_name: string;
  customer_phone: string | null;
  total_cents: number;
  notes: string | null;
  pickup_time: string | null;
  placed_at: string;
  is_test: boolean;
  items: Array<{
    qty: number;
    name: string;
    variation: string;
    options: string[];
  }>;
  deliveryAddress: {
    submitted: string;
    landmark: string | null;
    notes: string | null;
    detected: string;
    googlePlaceId: string | null;
  } | null;
  payment: { method: string; status: string } | null;
  assignment: RiderAssignment | null;
};

const SERVICE_META: Record<
  AdminOrder["service_mode"],
  { label: string; icon: typeof Utensils }
> = {
  dine_in: { label: "Dine-in", icon: Utensils },
  take_out: { label: "Take Out", icon: ShoppingBag },
  pickup: { label: "Pickup", icon: Store },
  delivery: { label: "Delivery", icon: Bike },
};

const ACTIVE_STATUSES: OrderStatus[] = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
];

function nextAction(order: AdminOrder) {
  const isCashDelivery =
    order.service_mode === "delivery" && order.payment?.method === "cash";

  if (order.status === "pending" || order.status === "accepted") {
    return { label: "Start preparing", disabled: false };
  }
  if (order.status === "preparing") {
    return { label: "Mark ready", disabled: false };
  }
  if (order.status === "ready" && order.service_mode === "delivery") {
    return { label: "Send out", disabled: !order.assignment };
  }
  if (order.status === "ready") {
    return {
      label:
        order.payment?.method === "cash" && order.payment.status !== "paid"
          ? "Complete & mark paid"
          : "Complete",
      disabled: false,
    };
  }
  if (order.status === "out_for_delivery") {
    if (isCashDelivery) return null;

    return {
      label:
        order.payment?.method === "cash" && order.payment.status !== "paid"
          ? "Delivered & mark paid"
          : "Mark delivered",
      disabled: false,
    };
  }
  return null;
}

function canRecordManualPayment(order: AdminOrder) {
  if (order.service_mode === "delivery" && order.payment?.method === "cash") {
    return false;
  }

  return order.status === "ready" || order.status === "out_for_delivery";
}

function formatClock(value: string) {
  return new Date(value).toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatAge(ms: number) {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function deliveryLocationLabel(order: AdminOrder) {
  const address = order.deliveryAddress;
  if (!address) return null;
  return (
    <div className="space-y-1.5 rounded-md bg-zb-primary/50 px-2 py-1.5 text-zb-cream/60">
      <p>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-zb-cream/35">
          Submitted address
        </span>
        {address.submitted}
        {address.landmark && (
          <span className="block text-[11px] text-zb-cream/40">
            Landmark: {address.landmark}
          </span>
        )}
        {address.notes && (
          <span className="block text-[11px] text-zb-cream/40">
            Notes: {address.notes}
          </span>
        )}
      </p>
      <p>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-zb-cream/35">
          Auto-detected pin
        </span>
        <span className="font-mono-tabular text-zb-cream/70">
          {address.detected}
        </span>
      </p>
    </div>
  );
}

/** Live, ticking elapsed time. Returns null until mounted to avoid a
 *  server/client hydration mismatch on the timestamp. */
function useElapsed(sinceISO: string) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const raf = window.requestAnimationFrame(tick);
    const id = window.setInterval(tick, 30_000);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearInterval(id);
    };
  }, []);
  return now === null ? null : now - new Date(sinceISO).getTime();
}

export function OrderCard({
  order,
  riders,
}: {
  order: AdminOrder;
  riders: RiderOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [selectedReason, setSelectedReason] =
    useState<OrderRejectionReason | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");

  function run(fn: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
      else {
        setRejecting(false);
        setSelectedReason(null);
        setRejectionNote("");
      }
    });
  }

  const paid = order.payment?.status === "paid";
  const action = nextAction(order);
  const service = SERVICE_META[order.service_mode];
  const ServiceIcon = service.icon;
  const isActive = ACTIVE_STATUSES.includes(order.status);

  const elapsed = useElapsed(order.placed_at);
  const minutes = elapsed === null ? 0 : Math.floor(elapsed / 60_000);
  // Aging tiers (active orders only): calm → due → late.
  const tier = !isActive || minutes < 8 ? "calm" : minutes < 20 ? "due" : "late";
  const agePill =
    tier === "late"
      ? "bg-zb-danger/15 text-[#e89a90] ring-1 ring-zb-danger/40"
      : tier === "due"
        ? "bg-zb-bone/15 text-zb-bone ring-1 ring-zb-bone/30"
        : "bg-zb-cream/5 text-zb-cream/55 ring-1 ring-zb-sage/20";

  return (
    <article className="zb-order-card group rounded-xl border border-zb-sage/20 bg-zb-primary-strong/60 p-3.5 text-sm shadow-sm transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-zb-sage/40 hover:shadow-md hover:shadow-black/20">
      {/* Header: code + service · live age */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono-tabular text-[15px] font-bold leading-none tracking-tight text-zb-cream">
              {order.short_code}
            </span>
            {order.is_test && (
              <span className="rounded border border-zb-bone/40 bg-zb-bone/10 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-zb-bone">
                Test
              </span>
            )}
          </div>
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-zb-cream/55">
            <ServiceIcon className="size-3.5 text-zb-sage" />
            {service.label}
            <span className="text-zb-cream/25">·</span>
            {formatClock(order.placed_at)}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${agePill}`}
        >
          {isActive ? <Timer className="size-3" /> : null}
          {elapsed === null
            ? formatClock(order.placed_at)
            : isActive
              ? formatAge(elapsed)
              : "done"}
        </span>
      </div>

      {/* Items */}
      <ul className="mt-3 space-y-1.5 border-t border-zb-sage/15 pt-3 text-xs text-zb-cream/85">
        {order.items.map((line, index) => (
          <li
            key={`${line.name}-${line.variation}-${index}`}
            className="flex gap-2 leading-snug"
          >
            <span className="font-mono-tabular font-semibold text-zb-bone">
              {line.qty}×
            </span>
            <span className="min-w-0">
              {line.name}
              {line.variation && (
                <span className="text-zb-cream/40"> · {line.variation}</span>
              )}
              {line.options.length > 0 && (
                <span className="mt-0.5 block text-[11px] text-zb-cream/40">
                  <span className="font-medium uppercase tracking-wide text-zb-sage/90">
                    Add-ons:
                  </span>{" "}
                  {line.options.join(", ")}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {/* Customer & fulfilment meta */}
      <div className="mt-3 space-y-1 text-xs">
        <p className="flex items-center justify-between gap-2 text-zb-cream/70">
          <span className="truncate">{order.customer_name}</span>
          {order.customer_phone && (
            <a
              href={`tel:${order.customer_phone}`}
              className="inline-flex shrink-0 items-center gap-1 text-zb-cream/60 transition hover:text-zb-bone"
            >
              <Phone className="size-3" /> {order.customer_phone}
            </a>
          )}
        </p>
        {order.pickup_time && (
          <p className="inline-flex items-center gap-1.5 text-zb-bone/90">
            <Clock className="size-3" /> Pickup {formatClock(order.pickup_time)}
          </p>
        )}
        {order.deliveryAddress ? (
          deliveryLocationLabel(order)
        ) : order.notes ? (
          <p className="flex items-start gap-1.5 rounded-md bg-zb-primary/50 px-2 py-1.5 text-zb-cream/60">
            <MapPin className="mt-0.5 size-3 shrink-0 text-zb-sage" />
            <span className="min-w-0">{order.notes}</span>
          </p>
        ) : null}
      </div>

      {/* Total + payment */}
      <div className="mt-3 flex items-center justify-between border-t border-zb-sage/15 pt-3">
        <span className="font-mono-tabular text-base font-bold text-zb-bone">
          {formatPeso(order.total_cents)}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            paid
              ? "bg-zb-sage/25 text-zb-cream/90"
              : "bg-zb-danger/15 text-[#e89a90]"
          }`}
        >
          {paid ? (
            <CheckCircle2 className="size-3" />
          ) : (
            <Clock className="size-3" />
          )}
          {order.payment?.method ?? "—"} · {paid ? "paid" : "unpaid"}
        </span>
      </div>

      {order.service_mode === "delivery" &&
        !["pending", "rejected", "cancelled"].includes(order.status) && (
          <RiderAssignmentControl
            key={order.assignment?.rider_profile_id ?? "unassigned"}
            orderId={order.id}
            status={order.status}
            riders={riders}
            assignment={order.assignment}
          />
        )}

      {error && (
        <p className="mt-3 rounded-md bg-zb-danger/10 px-2.5 py-1.5 text-xs text-[#e89a90]">
          {error}
        </p>
      )}

      {/* Actions */}
      {order.status === "pending" && rejecting ? (
        <div className="mt-3 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-1.5">
            {ORDER_REJECTION_REASONS.map((preset) => {
              const selected = selectedReason === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  disabled={pending}
                  onClick={() => setSelectedReason(preset)}
                  className={`rounded-md border px-2 py-1.5 text-left text-[11px] font-semibold leading-tight transition ${
                    selected
                      ? "border-zb-bone bg-zb-bone text-zb-primary-dark"
                      : "border-zb-sage/25 bg-zb-primary/55 text-zb-cream/75 hover:border-zb-sage/45 hover:text-zb-cream"
                  }`}
                >
                  {preset}
                </button>
              );
            })}
          </div>
          <textarea
            value={rejectionNote}
            onChange={(event) => setRejectionNote(event.target.value)}
            placeholder="Optional note"
            rows={2}
            className="w-full resize-none rounded-md border border-zb-sage/30 bg-zb-primary px-2.5 py-1.5 text-xs text-zb-cream placeholder:text-zb-cream/35 focus:border-zb-bone focus:outline-none"
          />
          <div className="flex gap-2">
            <ActionBtn
              danger
              grow
              disabled={pending || !selectedReason}
              onClick={() =>
                selectedReason
                  ? run(() =>
                      rejectOrder(order.id, selectedReason, rejectionNote)
                    )
                  : undefined
              }
            >
              Confirm reject
            </ActionBtn>
            <ActionBtn
              disabled={pending}
              onClick={() => {
                setRejecting(false);
                setSelectedReason(null);
                setRejectionNote("");
              }}
            >
              Cancel
            </ActionBtn>
          </div>
        </div>
      ) : (
        (action ||
          order.status === "pending" ||
          (!paid &&
            order.payment?.method === "cash" &&
            canRecordManualPayment(order))) && (
          <div className="mt-3 flex items-center gap-2">
            {action && (
              <ActionBtn
                primary
                grow
                disabled={pending || action.disabled}
                onClick={() => run(() => advanceOrder(order.id))}
              >
                {pending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}
                {action.label}
              </ActionBtn>
            )}
            {!paid &&
              order.payment?.method === "cash" &&
              canRecordManualPayment(order) && (
                <ActionBtn
                  disabled={pending}
                  onClick={() => run(() => recordPayment(order.id))}
                >
                  <Check className="size-3.5" /> Mark paid
                </ActionBtn>
              )}
            {order.status === "pending" && (
              <ActionBtn
                disabled={pending}
                onClick={() => setRejecting(true)}
                aria-label="Reject order"
              >
                <X className="size-3.5" />
              </ActionBtn>
            )}
          </div>
        )
      )}
    </article>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
  primary,
  danger,
  grow,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
  grow?: boolean;
  "aria-label"?: string;
}) {
  const tone = danger
    ? "bg-zb-danger text-zb-cream hover:bg-zb-danger/85 active:bg-zb-danger/70"
    : primary
      ? "bg-zb-bone text-zb-primary-dark hover:bg-zb-bone-soft active:bg-zb-bone/80"
      : "border border-zb-sage/35 text-zb-cream/85 hover:bg-zb-primary hover:text-zb-cream active:bg-zb-primary/70";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors duration-150 disabled:opacity-50 ${
        grow ? "flex-1" : ""
      } ${tone}`}
    >
      {children}
    </button>
  );
}
