import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  CreditCard,
  MapPin,
  ReceiptText,
  Search,
  UserRound,
} from "lucide-react";
import { requireStaffPermission } from "@/lib/admin";
import { formatPeso } from "@/lib/peso";
import {
  manilaDateInputValue,
  manilaDateRangeISO,
  manilaTodayStartISO,
} from "@/lib/admin-order-dates";
import { OrderHistoryStatusSelect } from "@/components/admin/OrderHistoryStatusSelect";
import { createAdminSessionClient } from "@/lib/supabase/admin-session";
import {
  detectedLocationLabel,
  formatSubmittedDeliveryAddress,
} from "@/lib/delivery-address";
import type { OrderStatus } from "@/app/workspace/orders/actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string | string[];
  from?: string | string[];
  to?: string | string[];
  status?: string | string[];
}>;

type HistoryStatus = "completed" | "rejected" | "cancelled";

type HistoryRow = {
  id: string;
  short_code: string;
  status: HistoryStatus;
  service_mode: "dine_in" | "take_out" | "pickup" | "delivery";
  customer_name: string;
  customer_phone: string | null;
  total_cents: number;
  notes: string | null;
  pickup_time: string | null;
  placed_at: string;
  accepted_at: string | null;
  ready_at: string | null;
  completed_at: string | null;
  rejected_at: string | null;
  rejected_reason: string | null;
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
    | Array<DeliveryAddress>
    | DeliveryAddress
    | null;
  payments: Array<{
    method: string;
    status: string;
    reference: string | null;
    created_at: string;
    paid_at: string | null;
  }> | null;
};

type DeliveryAddress = {
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
};

const HISTORY_STATUSES: HistoryStatus[] = ["completed", "rejected", "cancelled"];
function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isHistoryStatus(value: string): value is HistoryStatus {
  return HISTORY_STATUSES.includes(value as HistoryStatus);
}

function minISO(a: string, b: string): string {
  return a < b ? a : b;
}

function formatDateTime(value: string | null): string {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

function formatClock(value: string | null): string {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

function statusLabel(status: OrderStatus): string {
  return status
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function serviceLabel(mode: HistoryRow["service_mode"]): string {
  if (mode === "dine_in") return "Dine-in";
  if (mode === "take_out") return "Take Out";
  return mode[0]?.toUpperCase() + mode.slice(1);
}

function firstEmbedded<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function matchesSearch(row: HistoryRow, q: string): boolean {
  if (!q) return true;
  const haystack = [
    row.short_code,
    row.customer_name,
    row.customer_phone,
    row.notes,
    firstEmbedded(row.delivery_addresses)?.street,
    firstEmbedded(row.delivery_addresses)?.barangay,
    firstEmbedded(row.delivery_addresses)?.landmark,
    firstEmbedded(row.delivery_addresses)?.delivery_notes,
    firstEmbedded(row.delivery_addresses)?.detected_address,
    row.payments?.[0]?.method,
    row.payments?.[0]?.reference,
    ...(row.order_items ?? []).map((item) => item.item_name_snapshot),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(q.toLowerCase());
}

export default async function OrderHistoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireStaffPermission("orders:view", "/workspace/orders/history");
  const params = await searchParams;
  const q = first(params.q).trim();
  const from = first(params.from);
  const to = first(params.to);
  const requestedStatus = first(params.status);
  const status = isHistoryStatus(requestedStatus) ? requestedStatus : "";
  const todayStart = manilaTodayStartISO();
  const todayInput = manilaDateInputValue();
  const fromRange = from ? manilaDateRangeISO(from) : null;
  const toRange = to ? manilaDateRangeISO(to) : null;
  const statuses = status ? [status] : HISTORY_STATUSES;

  const supabase = await createAdminSessionClient();
  let query = supabase
    .from("orders")
    .select(
      `id, short_code, status, service_mode, customer_name, customer_phone,
       total_cents, notes, pickup_time, placed_at, accepted_at, ready_at,
       completed_at, rejected_at, rejected_reason, is_test,
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
       payments ( method, status, reference, created_at, paid_at )`
    )
    .in("status", statuses)
    .lt("placed_at", todayStart)
    .order("placed_at", { ascending: false })
    .limit(250);

  if (fromRange) query = query.gte("placed_at", fromRange.startISO);
  if (toRange) query = query.lt("placed_at", minISO(toRange.endISO, todayStart));

  const { data, error } = await query;
  const rows = (((data as HistoryRow[] | null) ?? []).filter((row) =>
    matchesSearch(row, q)
  ));
  const paidCount = rows.filter((row) => row.payments?.[0]?.status === "paid").length;
  const totalRevenue = rows
    .filter((row) => row.payments?.[0]?.status === "paid" && !row.is_test)
    .reduce((sum, row) => sum + row.total_cents, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/workspace/orders"
            className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-zb-cream/60 transition hover:text-zb-bone"
          >
            <ArrowLeft className="size-4" />
            Back to live orders
          </Link>
          <h1 className="font-display text-3xl leading-none text-zb-cream">
            ORDER HISTORY
          </h1>
          <p className="mt-1.5 text-sm text-zb-cream/55">
            Completed, cancelled, and rejected orders before today.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Stat label="Orders" value={String(rows.length)} />
          <Stat label="Paid" value={String(paidCount)} />
          <Stat label="Paid sales" value={formatPeso(totalRevenue)} />
        </div>
      </div>

      <form
        action="/workspace/orders/history"
        className="grid gap-3 rounded-xl border border-zb-sage/20 bg-zb-primary-strong/45 p-3 sm:grid-cols-[minmax(12rem,1fr)_10rem_10rem_12rem_auto_auto]"
      >
        <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-zb-cream/50">
          Search
          <span className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-zb-sage" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Code, customer, phone"
              className="w-full rounded-md border border-zb-sage/25 bg-zb-primary py-2 pl-8 pr-3 text-sm font-medium normal-case tracking-normal text-zb-cream placeholder:text-zb-cream/35 focus:border-zb-bone focus:outline-none"
            />
          </span>
        </label>
        <DateField label="From" name="from" value={from} max={todayInput} />
        <DateField label="To" name="to" value={to} max={todayInput} />
        <OrderHistoryStatusSelect value={status} />
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 self-end rounded-md bg-zb-bone px-4 py-2 text-sm font-semibold text-zb-primary-dark transition hover:bg-zb-bone-soft"
        >
          <Search className="size-4" />
          Apply
        </button>
        <Link
          href="/workspace/orders/history"
          className="inline-flex items-center justify-center self-end rounded-md border border-zb-sage/30 px-4 py-2 text-sm font-semibold text-zb-cream/80 transition hover:bg-zb-primary hover:text-zb-cream"
        >
          Reset
        </Link>
      </form>

      {error && (
        <p className="rounded-lg border border-zb-danger/40 bg-zb-danger/10 p-3 text-sm text-zb-danger">
          Could not load order history. Check your access and try again.
        </p>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zb-sage/25 px-4 py-12 text-center text-sm text-zb-cream/45">
          No archived orders match these filters.
        </div>
      ) : (
        <div className="grid gap-3">
          {rows.map((order) => (
            <HistoryCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}

function DateField({
  label,
  name,
  value,
  max,
}: {
  label: string;
  name: string;
  value: string;
  max: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-zb-cream/50">
      {label}
      <input
        type="date"
        name={name}
        defaultValue={value}
        max={max}
        className="rounded-md border border-zb-sage/25 bg-zb-primary px-3 py-2 text-sm font-medium normal-case tracking-normal text-zb-cream focus:border-zb-bone focus:outline-none"
      />
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zb-sage/20 bg-zb-primary-strong/60 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zb-cream/45">
        {label}
      </p>
      <p className="mt-0.5 font-mono-tabular text-lg font-bold text-zb-cream">
        {value}
      </p>
    </div>
  );
}

function HistoryCard({ order }: { order: HistoryRow }) {
  const payment = order.payments?.[0] ?? null;
  const deliveryAddress = firstEmbedded(order.delivery_addresses);
  const closedAt =
    order.status === "completed" ? order.completed_at : order.rejected_at;
  const tone =
    order.status === "completed"
      ? "border-zb-sage/25 text-zb-sage"
      : "border-zb-danger/35 text-[#e89a90]";

  return (
    <article className="rounded-xl border border-zb-sage/20 bg-zb-primary-strong/55 p-4">
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono-tabular text-lg font-bold text-zb-cream">
              {order.short_code}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] ${tone}`}
            >
              {statusLabel(order.status)}
            </span>
            {order.is_test && (
              <span className="rounded border border-zb-bone/40 bg-zb-bone/10 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-zb-bone">
                Test
              </span>
            )}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zb-cream/60">
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="size-4 text-zb-sage" />
              {order.customer_name}
            </span>
            {order.customer_phone && <span>{order.customer_phone}</span>}
            <span>{serviceLabel(order.service_mode)}</span>
          </p>
        </div>
        <div className="text-left md:text-right">
          <p className="font-mono-tabular text-xl font-bold text-zb-bone">
            {formatPeso(order.total_cents)}
          </p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-zb-cream/55">
            <CreditCard className="size-3.5 text-zb-sage" />
            {payment?.method ?? "No payment"} - {payment?.status ?? "unknown"}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 border-t border-zb-sage/15 pt-3 text-xs text-zb-cream/60 sm:grid-cols-2 lg:grid-cols-4">
        <Meta icon={CalendarDays} label="Placed" value={formatDateTime(order.placed_at)} />
        <Meta icon={Clock} label="Closed" value={formatDateTime(closedAt)} />
        <Meta icon={Clock} label="Pickup" value={formatClock(order.pickup_time)} />
        <Meta
          icon={CreditCard}
          label="Paid"
          value={formatDateTime(payment?.paid_at ?? null)}
        />
      </div>

      <details className="mt-3 rounded-lg border border-zb-sage/15 bg-zb-primary/35">
        <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-zb-cream/65 transition hover:text-zb-bone">
          View order details
        </summary>
        <div className="space-y-3 border-t border-zb-sage/15 px-3 py-3 text-sm">
          <ul className="space-y-2 text-zb-cream/85">
            {(order.order_items ?? []).map((item, index) => (
              <li
                key={`${order.id}-${item.item_name_snapshot}-${index}`}
                className="flex gap-2"
              >
                <span className="font-mono-tabular font-semibold text-zb-bone">
                  {item.qty}x
                </span>
                <span>
                  {item.item_name_snapshot}
                  {item.variation_label_snapshot && (
                    <span className="text-zb-cream/45">
                      {" "}
                      - {item.variation_label_snapshot}
                    </span>
                  )}
                  {(item.order_item_options ?? []).length > 0 && (
                    <span className="mt-0.5 block text-xs text-zb-cream/45">
                      Add-ons:{" "}
                      {(item.order_item_options ?? [])
                        .map((option) =>
                          option.quantity && option.quantity > 1
                            ? `${option.name_snapshot} x${option.quantity}`
                            : option.name_snapshot
                        )
                        .join(", ")}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>

          <div className="grid gap-2 text-xs text-zb-cream/60 sm:grid-cols-2 lg:grid-cols-4">
            <Meta icon={Clock} label="Accepted" value={formatDateTime(order.accepted_at)} />
            <Meta icon={Clock} label="Ready" value={formatDateTime(order.ready_at)} />
            <Meta
              icon={ReceiptText}
              label="Payment ref"
              value={payment?.reference ?? "None"}
            />
            <Meta
              icon={CreditCard}
              label="Payment created"
              value={formatDateTime(payment?.created_at ?? null)}
            />
          </div>

          {order.service_mode === "delivery" && deliveryAddress && (
            <div className="grid gap-3 rounded-lg bg-zb-primary/45 p-3 text-xs text-zb-cream/65 sm:grid-cols-2">
              <div>
                <p className="flex items-center gap-1.5 font-semibold uppercase tracking-[0.12em] text-zb-cream/35">
                  <MapPin className="size-3.5 text-zb-sage" />
                  Submitted address
                </p>
                <p className="mt-1 text-sm text-zb-cream/75">
                  {formatSubmittedDeliveryAddress(deliveryAddress)}
                </p>
                {deliveryAddress.landmark && (
                  <p className="mt-1">Landmark: {deliveryAddress.landmark}</p>
                )}
                {deliveryAddress.delivery_notes && (
                  <p className="mt-1">Notes: {deliveryAddress.delivery_notes}</p>
                )}
              </div>
              <div>
                <p className="flex items-center gap-1.5 font-semibold uppercase tracking-[0.12em] text-zb-cream/35">
                  <MapPin className="size-3.5 text-zb-bone" />
                  Auto-detected location
                </p>
                <p className="mt-1 text-sm text-zb-cream/75">
                  {detectedLocationLabel(deliveryAddress, "Not available")}
                </p>
              </div>
            </div>
          )}

          {(order.notes || order.rejected_reason) && (
            <div className="rounded-md bg-zb-primary/70 px-3 py-2 text-xs text-zb-cream/65">
              {order.notes && <p>Notes: {order.notes}</p>}
              {order.rejected_reason && <p>Reason: {order.rejected_reason}</p>}
            </div>
          )}
        </div>
      </details>
    </article>
  );
}

function Meta({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <p className="flex min-w-0 items-start gap-2">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-zb-sage" />
      <span className="min-w-0">
        <span className="block font-semibold uppercase tracking-[0.12em] text-zb-cream/35">
          {label}
        </span>
        <span className="block truncate">{value}</span>
      </span>
    </p>
  );
}
