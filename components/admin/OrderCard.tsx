"use client";

import { useState, useTransition } from "react";
import { Check, Clock, Loader2, MapPin, Phone } from "lucide-react";
import { formatPeso } from "@/lib/peso";
import { RiderAssignmentControl } from "@/components/admin/RiderAssignmentControl";
import {
  advanceOrder,
  recordPayment,
  setOrderStatus,
  type ActionResult,
  type OrderStatus,
} from "@/app/workspace/orders/actions";

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
  payment: { method: string; status: string } | null;
  assignment: RiderAssignment | null;
};

const SERVICE_LABEL: Record<AdminOrder["service_mode"], string> = {
  dine_in: "Dine-in",
  take_out: "Take Out",
  pickup: "Pickup",
  delivery: "Delivery",
};

function nextAction(order: AdminOrder) {
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
      label: order.payment?.method === "cash" && order.payment.status !== "paid"
        ? "Complete & mark paid"
        : "Complete",
      disabled: false,
    };
  }
  if (order.status === "out_for_delivery") {
    return {
      label: order.payment?.method === "cash" && order.payment.status !== "paid"
        ? "Delivered & mark paid"
        : "Mark delivered",
      disabled: false,
    };
  }
  return null;
}

function canRecordManualPayment(order: AdminOrder) {
  return order.status === "ready" || order.status === "out_for_delivery";
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
  const [reason, setReason] = useState("");

  function run(fn: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
      else setRejecting(false);
    });
  }

  const paid = order.payment?.status === "paid";
  const action = nextAction(order);
  const placed = new Date(order.placed_at).toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <article className="rounded-2xl border border-zb-sage/25 bg-zb-primary-strong/70 p-4 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono-tabular text-base font-bold text-zb-cream">
            {order.short_code}
          </p>
          {order.is_test && (
            <span className="mt-1 inline-flex rounded-full border border-zb-bone/45 bg-zb-bone/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zb-bone">
              Test order
            </span>
          )}
          <p className="mt-0.5 flex items-center gap-1 text-xs text-zb-cream/55">
            <Clock className="size-3" /> {placed} · {SERVICE_LABEL[order.service_mode]}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono-tabular font-bold text-zb-bone">
            {formatPeso(order.total_cents)}
          </p>
          <span
            className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              paid
                ? "bg-zb-sage/25 text-zb-cream"
                : "bg-zb-danger/15 text-zb-danger"
            }`}
          >
            {order.payment?.method ?? "—"} · {paid ? "paid" : "unpaid"}
          </span>
        </div>
      </div>

      <ul className="mt-3 space-y-1 text-xs text-zb-cream/80">
        {order.items.map((line, index) => (
          <li key={`${line.name}-${line.variation}-${index}`}>
            {line.qty}× {line.name}
            <span className="text-zb-cream/45"> · {line.variation}</span>
            {line.options.length ? (
              <span className="block pl-4 text-zb-cream/40">
                {line.options.join(", ")}
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-zb-cream/65">
        {order.customer_name}
        {order.customer_phone && (
          <a
            href={`tel:${order.customer_phone}`}
            className="ml-2 inline-flex items-center gap-1 text-zb-cream hover:text-zb-bone"
          >
            <Phone className="size-3" /> {order.customer_phone}
          </a>
        )}
      </p>
      {order.pickup_time && (
        <p className="mt-1 flex items-center gap-1 text-xs text-zb-bone">
          <Clock className="size-3" /> Pickup{" "}
          {new Date(order.pickup_time).toLocaleTimeString("en-PH", {
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      )}
      {order.notes && (
        <p className="mt-1 flex items-start gap-1 text-xs text-zb-cream/55">
          <MapPin className="mt-0.5 size-3 shrink-0" /> {order.notes}
        </p>
      )}

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

      {error && <p className="mt-3 text-xs text-zb-danger">{error}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {order.status === "pending" && !rejecting && (
          <>
            <ActionBtn disabled={pending} onClick={() => setRejecting(true)}>
              Reject
            </ActionBtn>
          </>
        )}
        {order.status === "pending" && rejecting && (
          <div className="flex w-full flex-col gap-2">
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reason (optional)"
              className="w-full rounded-md border border-zb-sage/30 bg-zb-primary px-2.5 py-1.5 text-xs text-zb-cream placeholder:text-zb-cream/35 focus:border-zb-bone focus:outline-none"
            />
            <div className="flex gap-2">
              <ActionBtn
                danger
                disabled={pending}
                onClick={() =>
                  run(() => setOrderStatus(order.id, "rejected", reason))
                }
              >
                Confirm reject
              </ActionBtn>
              <ActionBtn disabled={pending} onClick={() => setRejecting(false)}>
                Cancel
              </ActionBtn>
            </div>
          </div>
        )}
        {action && !rejecting && (
          <ActionBtn
            primary
            disabled={pending || action.disabled}
            onClick={() => run(() => advanceOrder(order.id))}
          >
            {action.label}
          </ActionBtn>
        )}

        {!paid &&
          order.payment &&
          order.payment.method === "cash" &&
          canRecordManualPayment(order) && (
            <ActionBtn
              disabled={pending}
              onClick={() => run(() => recordPayment(order.id))}
            >
              <Check className="size-3.5" /> Mark paid
            </ActionBtn>
          )}

        {pending && <Loader2 className="size-4 animate-spin text-zb-cream/50" />}
      </div>
    </article>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
  primary,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  const tone = danger
    ? "bg-zb-danger text-zb-cream hover:bg-zb-danger/85"
    : primary
      ? "bg-zb-bone text-zb-primary-dark hover:bg-zb-bone/85"
      : "border border-zb-sage/35 text-zb-cream/85 hover:bg-zb-primary";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${tone}`}
    >
      {children}
    </button>
  );
}
