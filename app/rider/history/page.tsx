import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CreditCard,
  MapPin,
  ReceiptText,
  Search,
  UserRound,
} from "lucide-react";
import { requireRider } from "@/lib/rider";
import { createAdminSessionClient } from "@/lib/supabase/admin-session";
import { formatPeso } from "@/lib/peso";
import {
  detectedLocationLabel,
  formatSubmittedDeliveryAddress,
} from "@/lib/delivery-address";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string | string[];
}>;

type Embedded<T> = T | T[] | null;

type DeliveryAddress = {
  street: string;
  barangay: string | null;
  city: string;
  landmark: string | null;
  delivery_notes: string | null;
  lat: number | string | null;
  lng: number | string | null;
  detected_lat: number | string | null;
  detected_lng: number | string | null;
  detected_address: string | null;
};

type Payment = {
  method: string;
  status: string;
  reference: string | null;
};

type CompletedOrder = {
  id: string;
  short_code: string;
  status: "completed";
  customer_name: string;
  customer_phone: string | null;
  total_cents: number;
  notes: string | null;
  delivery_addresses: Embedded<DeliveryAddress>;
  payments: Embedded<Payment>;
};

type AssignmentRow = {
  order_id: string;
  assigned_at: string;
  picked_up_at: string | null;
  delivered_at: string | null;
  orders: CompletedOrder | CompletedOrder[];
};

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function toArray<T>(value: Embedded<T> | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function formatDateTime(value: string | null): string {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

function matchesSearch(row: CompletedDelivery, q: string): boolean {
  if (!q) return true;
  const address = row.address;
  const payment = row.payment;
  const haystack = [
    row.order.short_code,
    row.order.customer_name,
    row.order.customer_phone,
    row.order.notes,
    address?.street,
    address?.barangay,
    address?.city,
    address?.landmark,
    address?.delivery_notes,
    address?.detected_address,
    payment?.method,
    payment?.status,
    payment?.reference,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q.toLowerCase());
}

type CompletedDelivery = {
  order_id: string;
  assigned_at: string;
  picked_up_at: string | null;
  delivered_at: string | null;
  order: CompletedOrder;
  address: DeliveryAddress | null;
  payment: Payment | null;
};

export default async function RiderHistoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { profile } = await requireRider("/rider/history");
  const params = await searchParams;
  const q = first(params.q).trim();
  const supabase = await createAdminSessionClient();

  const { data, error } = await supabase
    .from("rider_assignments")
    .select(
      `order_id, assigned_at, picked_up_at, delivered_at,
       orders!inner (
         id, short_code, status, customer_name, customer_phone,
         total_cents, notes,
         delivery_addresses (
           street, barangay, city, landmark, delivery_notes,
           lat, lng, detected_lat, detected_lng, detected_address
         ),
         payments ( method, status, reference )
       )`
    )
    .eq("rider_profile_id", profile.id)
    .eq("orders.status", "completed")
    .not("delivered_at", "is", null)
    .order("delivered_at", { ascending: false })
    .limit(250);

  const rows = ((data as AssignmentRow[] | null) ?? [])
    .reduce<CompletedDelivery[]>((list, row) => {
      const order = Array.isArray(row.orders) ? row.orders[0] : row.orders;
      if (!order) return list;
      list.push({
        ...row,
        order,
        address: toArray(order?.delivery_addresses)[0] ?? null,
        payment: toArray(order?.payments)[0] ?? null,
      });
      return list;
    }, [])
    .filter((row) => matchesSearch(row, q));

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/rider"
          className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-zb-cream/60 transition hover:text-zb-bone"
        >
          <ArrowLeft className="size-4" />
          Back to active deliveries
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl leading-none text-zb-cream">
              DELIVERY HISTORY
            </h1>
            <p className="mt-1.5 text-sm text-zb-cream/55">
              Completed deliveries assigned to you.
            </p>
          </div>
          <Stat label="Completed" value={String(rows.length)} />
        </div>
      </div>

      <form action="/rider/history" className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zb-sage" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search order, customer, address"
            className="h-11 w-full rounded-lg border border-zb-sage/25 bg-zb-primary-strong py-2 pl-9 pr-3 text-sm text-zb-cream placeholder:text-zb-cream/35 focus:border-zb-bone focus:outline-none"
          />
        </label>
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-zb-bone px-4 text-sm font-semibold text-zb-primary-dark transition hover:bg-zb-bone-soft"
        >
          <Search className="size-4" />
          Search
        </button>
      </form>

      {error && (
        <p className="rounded-lg border border-zb-danger/40 bg-zb-danger/10 p-3 text-sm text-[#e89a90]">
          Could not load delivery history. Refresh and try again.
        </p>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zb-sage/25 px-4 py-12 text-center">
          <p className="font-semibold text-zb-cream">No completed deliveries found</p>
          <p className="mt-1 text-sm text-zb-cream/45">
            Completed deliveries will appear here after you mark them delivered.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {rows.map((row) => (
            <HistoryCard key={`${row.order_id}-${row.delivered_at}`} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryCard({ row }: { row: CompletedDelivery }) {
  const address = row.address;
  const payment = row.payment;

  return (
    <article className="rounded-xl border border-zb-sage/20 bg-zb-primary-strong/55 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/rider/delivery/${row.order.id}`}
            className="font-mono-tabular text-lg font-bold text-zb-cream transition hover:text-zb-bone"
          >
            {row.order.short_code}
          </Link>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-zb-cream/55">
            <CalendarDays className="size-3.5 text-zb-sage" />
            Completed {formatDateTime(row.delivered_at)}
          </p>
        </div>
        <p className="font-mono-tabular text-lg font-bold text-zb-bone">
          {formatPeso(row.order.total_cents)}
        </p>
      </div>

      <div className="mt-3 space-y-3 text-sm text-zb-cream/70">
        <p className="flex items-center gap-2">
          <UserRound className="size-4 text-zb-sage" />
          <span className="min-w-0 truncate">{row.order.customer_name}</span>
        </p>

        <div className="rounded-lg bg-zb-primary/35 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zb-cream/35">
            Delivery address
          </p>
          <p className="mt-1 flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-zb-sage" />
            <span>
              {formatSubmittedDeliveryAddress(address)}
              {address?.landmark && (
                <span className="mt-1 block text-xs text-zb-cream/45">
                  Landmark: {address.landmark}
                </span>
              )}
              {address?.delivery_notes && (
                <span className="mt-1 block text-xs text-zb-cream/45">
                  Notes: {address.delivery_notes}
                </span>
              )}
              {row.order.notes && (
                <span className="mt-1 block text-xs text-zb-cream/45">
                  Order notes: {row.order.notes}
                </span>
              )}
            </span>
          </p>
        </div>

        <div className="grid gap-2 text-xs sm:grid-cols-2">
          <Meta
            icon={CreditCard}
            label="Payment"
            value={`${payment?.method ?? "Payment"} - ${payment?.status ?? "unknown"}`}
          />
          <Meta
            icon={MapPin}
            label="Detected pin"
            value={detectedLocationLabel(address)}
          />
          <Meta icon={ReceiptText} label="Assigned" value={formatDateTime(row.assigned_at)} />
          <Meta icon={ReceiptText} label="Picked up" value={formatDateTime(row.picked_up_at)} />
        </div>
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zb-sage/20 bg-zb-primary-strong/60 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zb-cream/45">
        {label}
      </p>
      <p className="mt-0.5 font-mono-tabular text-xl font-bold text-zb-cream">
        {value}
      </p>
    </div>
  );
}

function Meta({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CreditCard;
  label: string;
  value: string;
}) {
  return (
    <p className="flex min-w-0 items-start gap-2 rounded-lg bg-zb-primary/25 px-3 py-2 text-zb-cream/55">
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
