import { requireStaff } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import {
  OrderCard,
  type AdminOrder,
  type RiderOption,
} from "@/components/admin/OrderCard";
import { AdminOrdersPoller } from "@/components/admin/AdminOrdersPoller";
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
  order_items: Array<{
    qty: number;
    item_name_snapshot: string;
    variation_label_snapshot: string;
  }> | null;
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

const COLUMNS: Array<{ key: OrderStatus; label: string }> = [
  { key: "pending", label: "Pending" },
  { key: "accepted", label: "Accepted" },
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "completed", label: "Completed" },
];

function toOrder(
  row: Row,
  assignments: Map<string, AdminOrder["assignment"]>
): AdminOrder {
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
    items: (row.order_items ?? []).map((item) => ({
      qty: item.qty,
      name: item.item_name_snapshot,
      variation: item.variation_label_snapshot,
    })),
    payment: row.payments?.[0]
      ? { method: row.payments[0].method, status: row.payments[0].status }
      : null,
    assignment: assignments.get(row.id) ?? null,
  };
}

export default async function AdminOrdersPage() {
  await requireStaff("/workspace/orders");
  const supabase = await createClient();
  const since = recentSinceISO();

  const [ordersResult, ridersResult] = await Promise.all([
    supabase
      .from("orders")
      .select(
        `id, short_code, status, service_mode, customer_name, customer_phone,
         total_cents, notes, pickup_time, placed_at,
         order_items ( qty, item_name_snapshot, variation_label_snapshot ),
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
  for (const order of orders) buckets[order.status]?.push(order);

  return (
    <div>
      <AdminOrdersPoller />
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl text-zb-cream">ORDERS</h1>
          <p className="text-sm text-zb-cream/55">
            Live order pipeline · last 48 hours
          </p>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-zb-danger/40 bg-zb-danger/10 p-3 text-sm text-zb-danger">
          Could not load orders or riders. Check your access and try again.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {COLUMNS.map((column) => {
          const list = buckets[column.key];
          return (
            <section key={column.key} className="min-w-0">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zb-cream/70">
                  {column.label}
                </h2>
                <span className="rounded-full bg-zb-primary-strong px-2 py-0.5 text-[11px] font-semibold text-zb-cream/60">
                  {list.length}
                </span>
              </div>
              <div className="space-y-3">
                {list.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-zb-sage/20 p-4 text-center text-xs text-zb-cream/35">
                    None
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