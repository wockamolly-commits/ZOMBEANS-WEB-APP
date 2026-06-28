import { requireStaffPermission } from "@/lib/admin";
import { createAdminSessionClient } from "@/lib/supabase/admin-session";
import Link from "next/link";
import { History } from "lucide-react";
import {
  OrderCard,
  type AdminOrder,
  type RiderOption,
} from "@/components/admin/OrderCard";
import { AdminOrdersPoller } from "@/components/admin/AdminOrdersPoller";
import { manilaTodayStartISO } from "@/lib/admin-order-dates";
import type { OrderStatus } from "@/app/workspace/orders/actions";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  short_code: string;
  status: OrderStatus;
  service_mode: AdminOrder["service_mode"];
  customer_name: string;
  customer_phone: string | null;
  total_cents: number;
  notes: string | null;
  pickup_time: string | null;
  placed_at: string;
  is_test: boolean;
  order_items: Array<{
    qty: number;
    item_name_snapshot: string;
    variation_label_snapshot: string;
    order_item_options: Array<{
      name_snapshot: string;
      quantity: number | null;
    }> | null;
  }> | null;
  delivery_addresses:
    | Array<{
        street: string;
        barangay: string | null;
        city: string;
        landmark: string | null;
        delivery_notes: string | null;
        lat: number | string;
        lng: number | string;
        google_place_id: string | null;
        detected_lat: number | string | null;
        detected_lng: number | string | null;
        detected_address: string | null;
      }>
    | {
        street: string;
        barangay: string | null;
        city: string;
        landmark: string | null;
        delivery_notes: string | null;
        lat: number | string;
        lng: number | string;
        google_place_id: string | null;
        detected_lat: number | string | null;
        detected_lng: number | string | null;
        detected_address: string | null;
      }
    | null;
  payments: Array<{ method: string; status: string }> | null;
};

type RiderRow = {
  id: string;
  display_name: string;
  riders:
    | {
        vehicle_type: string | null;
        plate_no: string | null;
        is_available: boolean;
      }
    | Array<{
        vehicle_type: string | null;
        plate_no: string | null;
        is_available: boolean;
      }>;
};

type AssignmentRow = { order_id: string; rider_profile_id: string };

function recentSinceISO(): string {
  return new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
}

function firstEmbedded<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function coordsLabel(lat: number | string, lng: number | string): string {
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
    return "Pin unavailable";
  }
  return `${parsedLat.toFixed(6)}, ${parsedLng.toFixed(6)}`;
}

const COLUMNS: Array<{
  key: string;
  label: string;
  statuses: OrderStatus[];
  accent: string;
  empty: string;
}> = [
  {
    key: "pending",
    label: "New",
    statuses: ["pending"],
    accent: "#e5c07b",
    empty: "No new orders",
  },
  {
    key: "preparing",
    label: "Preparing",
    statuses: ["accepted", "preparing"],
    accent: "#84b6e8",
    empty: "Nothing on the line",
  },
  {
    key: "ready",
    label: "Ready",
    statuses: ["ready"],
    accent: "#7fd6a0",
    empty: "Nothing waiting",
  },
  {
    key: "out_for_delivery",
    label: "Out for delivery",
    statuses: ["out_for_delivery"],
    accent: "#c2a3ec",
    empty: "No riders out",
  },
  {
    key: "completed",
    label: "Completed",
    statuses: ["completed"],
    accent: "#9fb0a0",
    empty: "None yet today",
  },
  {
    key: "cancelled",
    label: "Cancelled",
    statuses: ["rejected", "cancelled"],
    accent: "#d98a80",
    empty: "None",
  },
];

const ACTIVE_STATUSES: OrderStatus[] = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
];
const TERMINAL_STATUSES: OrderStatus[] = ["completed", "rejected", "cancelled"];

function toOrder(
  row: Row,
  assignments: Map<string, AdminOrder["assignment"]>
): AdminOrder {
  const deliveryAddress = firstEmbedded(row.delivery_addresses);
  return {
    id: row.id,
    short_code: row.short_code,
    status: row.status,
    service_mode: row.service_mode,
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    total_cents: row.total_cents,
    notes: row.notes,
    pickup_time: row.pickup_time,
    placed_at: row.placed_at,
    is_test: row.is_test,
    items: (row.order_items ?? []).map((item) => ({
      qty: item.qty,
      name: item.item_name_snapshot,
      variation: item.variation_label_snapshot,
      options: (item.order_item_options ?? []).map((option) =>
        option.quantity && option.quantity > 1
          ? `${option.name_snapshot} x${option.quantity}`
          : option.name_snapshot
      ),
    })),
    deliveryAddress: deliveryAddress
      ? {
          submitted: [
            deliveryAddress.street,
            deliveryAddress.barangay,
            deliveryAddress.city,
          ]
            .filter(Boolean)
            .join(", "),
          landmark: deliveryAddress.landmark,
          notes: deliveryAddress.delivery_notes,
          // Prefer the separately-captured device GPS reading; fall back to the
          // delivery coordinates for orders placed before detected_* existed.
          detected:
            deliveryAddress.detected_address ??
            (deliveryAddress.detected_lat != null &&
            deliveryAddress.detected_lng != null
              ? coordsLabel(
                  deliveryAddress.detected_lat,
                  deliveryAddress.detected_lng
                )
              : coordsLabel(deliveryAddress.lat, deliveryAddress.lng)),
          googlePlaceId: deliveryAddress.google_place_id,
        }
      : null,
    payment: row.payments?.[0]
      ? { method: row.payments[0].method, status: row.payments[0].status }
      : null,
    assignment: assignments.get(row.id) ?? null,
  };
}

export default async function AdminOrdersPage() {
  await requireStaffPermission("orders:view", "/workspace/orders");
  const supabase = await createAdminSessionClient();
  const since = recentSinceISO();
  const todayStart = manilaTodayStartISO();

  const [ordersResult, ridersResult] = await Promise.all([
    supabase
      .from("orders")
      .select(
        `id, short_code, status, service_mode, customer_name, customer_phone,
         total_cents, notes, pickup_time, placed_at, is_test,
         order_items (
           qty,
           item_name_snapshot,
           variation_label_snapshot,
           order_item_options ( name_snapshot, quantity )
         ),
         delivery_addresses (
           street, barangay, city, landmark, delivery_notes,
           lat, lng, google_place_id,
           detected_lat, detected_lng, detected_address
         ),
         payments ( method, status )`
      )
      .gte("placed_at", since)
      .order("placed_at", { ascending: true }),
    supabase
      .from("profiles")
      .select(
        "id, display_name, riders!inner(vehicle_type, plate_no, is_available)"
      )
      .eq("role", "rider")
      .eq("is_active", true)
      .order("display_name"),
  ]);

  const rows = (ordersResult.data as Row[] | null) ?? [];
  const riderRows = (ridersResult.data as RiderRow[] | null) ?? [];
  const riderById = new Map(riderRows.map((rider) => [rider.id, rider]));
  const riders: RiderOption[] = riderRows.flatMap((rider) => {
    const details = Array.isArray(rider.riders) ? rider.riders[0] : rider.riders;
    if (!details?.is_available) return [];
    return [
      {
        id: rider.id,
        display_name: rider.display_name,
        vehicle_type: details.vehicle_type,
        plate_no: details.plate_no,
      },
    ];
  });

  const assignmentResult = rows.length
    ? await supabase
        .from("rider_assignments")
        .select("order_id, rider_profile_id")
        .in(
          "order_id",
          rows.map((row) => row.id)
        )
    : { data: [] as AssignmentRow[], error: null };
  const assignmentRows = (assignmentResult.data as AssignmentRow[] | null) ?? [];
  const assignments = new Map<string, AdminOrder["assignment"]>();
  for (const assignment of assignmentRows) {
    const rider = riderById.get(assignment.rider_profile_id);
    assignments.set(assignment.order_id, {
      rider_profile_id: assignment.rider_profile_id,
      display_name: rider?.display_name ?? "Assigned rider",
    });
  }

  const orders = rows.map((row) => toOrder(row, assignments));
  const error = ordersResult.error ?? ridersResult.error ?? assignmentResult.error;
  const buckets: Record<OrderStatus, AdminOrder[]> = {
    pending: [],
    accepted: [],
    preparing: [],
    ready: [],
    out_for_delivery: [],
    completed: [],
    rejected: [],
    cancelled: [],
  };
  for (const order of orders) {
    if (
      TERMINAL_STATUSES.includes(order.status) &&
      order.placed_at < todayStart
    ) {
      continue;
    }
    buckets[order.status]?.push(order);
  }

  const activeCount = ACTIVE_STATUSES.reduce(
    (sum, status) => sum + buckets[status].length,
    0
  );
  const unpaidCount = orders.filter(
    (order) =>
      ACTIVE_STATUSES.includes(order.status) &&
      order.payment !== null &&
      order.payment.status !== "paid"
  ).length;

  return (
    <div
      className="flex flex-col"
      style={{ height: "calc(100dvh - 8.5rem)", minHeight: "32rem" }}
    >
      <AdminOrdersPoller />
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl leading-none text-zb-cream">
            ORDERS
          </h1>
          <p className="mt-1.5 flex items-center gap-2 text-sm text-zb-cream/55">
            <span className="inline-flex items-center gap-1.5 text-zb-sage">
              <span className="zb-live-dot size-2 rounded-full bg-[#7fd6a0]" />
              <span className="font-medium text-zb-cream/70">Live</span>
            </span>
            <span className="text-zb-cream/25">·</span>
            active recent orders + today&apos;s closed orders
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/workspace/orders/history"
            className="inline-flex items-center gap-2 rounded-xl border border-zb-sage/25 px-3 py-2 text-xs font-semibold text-zb-cream/75 transition hover:bg-zb-primary-strong hover:text-zb-cream"
          >
            <History className="size-4 text-zb-bone" />
            History
          </Link>
          <Stat label="Active" value={activeCount} accent="#e5c07b" />
          <Stat label="Unpaid" value={unpaidCount} accent="#d98a80" />
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-zb-danger/40 bg-zb-danger/10 p-3 text-sm text-zb-danger">
          Could not load orders or riders. Check your access and try again.
        </p>
      )}

      <div className="orders-board -mx-1 flex flex-1 snap-x gap-3 overflow-x-auto px-1 pb-3">
        {COLUMNS.map((column) => {
          const list = column.statuses.flatMap((status) => buckets[status]);
          return (
            <section
              key={column.key}
              style={{ ["--accent" as string]: column.accent }}
              className="flex w-[19rem] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-zb-sage/15 bg-zb-primary-strong/30"
            >
              <header className="flex shrink-0 items-center justify-between gap-2 border-b border-zb-sage/15 bg-zb-primary-strong px-3.5 py-3">
                <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-zb-cream/80">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: "var(--accent)" }}
                  />
                  {column.label}
                </h2>
                <span
                  className="min-w-6 rounded-full px-2 py-0.5 text-center text-[11px] font-bold tabular-nums"
                  style={{
                    color: "var(--accent)",
                    backgroundColor: "color-mix(in srgb, var(--accent) 14%, transparent)",
                  }}
                >
                  {list.length}
                </span>
              </header>
              <div className="orders-column flex flex-1 flex-col gap-3 overflow-y-auto p-3">
                {list.length === 0 ? (
                  <p className="mt-2 rounded-xl border border-dashed border-zb-sage/15 px-4 py-8 text-center text-xs text-zb-cream/30">
                    {column.empty}
                  </p>
                ) : (
                  list.map((order) => (
                    <OrderCard key={order.id} order={order} riders={riders} />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-zb-sage/20 bg-zb-primary-strong/50 px-3 py-1.5">
      <span
        className="font-mono-tabular text-lg font-bold leading-none tabular-nums"
        style={{ color: accent }}
      >
        {value}
      </span>
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-zb-cream/50">
        {label}
      </span>
    </div>
  );
}
