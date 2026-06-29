import Link from "next/link";
import {
  ArrowRight,
  Bike,
  CheckCircle2,
  Clock,
  History,
  MapPin,
  Phone,
  ReceiptText,
} from "lucide-react";
import { requireRider } from "@/lib/rider";
import { createAdminSessionClient } from "@/lib/supabase/admin-session";
import { formatPeso } from "@/lib/peso";
import { RiderRefreshButton } from "@/components/rider/RiderRefreshButton";
import { RiderNavigationMap } from "@/components/rider/RiderNavigationMap";

export const dynamic = "force-dynamic";

type DeliveryStatus = "ready" | "out_for_delivery" | "completed";
type Embedded<T> = T | T[] | null;
const DELIVERY_STATUSES: readonly string[] = [
  "ready",
  "out_for_delivery",
  "completed",
];

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

type AssignmentRow = {
  order_id: string;
  assigned_at: string;
  picked_up_at: string | null;
  delivered_at: string | null;
  orders:
    | {
        id: string;
        short_code: string;
        status: DeliveryStatus;
        customer_name: string;
        customer_phone: string | null;
        total_cents: number;
        placed_at: string;
        delivery_addresses: Embedded<DeliveryAddress>;
        payments: Embedded<{ method: string; status: string }>;
      }
    | Array<{
        id: string;
        short_code: string;
        status: DeliveryStatus;
        customer_name: string;
        customer_phone: string | null;
        total_cents: number;
        placed_at: string;
        delivery_addresses: Embedded<DeliveryAddress>;
        payments: Embedded<{ method: string; status: string }>;
      }>;
};

function toArray<T>(value: Embedded<T> | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function manilaTodayStartISO(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return new Date(`${get("year")}-${get("month")}-${get("day")}T00:00:00+08:00`).toISOString();
}

function formatClock(value: string | null): string {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

function statusLabel(status: DeliveryStatus): string {
  if (status === "out_for_delivery") return "Out for delivery";
  return status[0].toUpperCase() + status.slice(1);
}

function addressLine(addresses: Embedded<DeliveryAddress>): string {
  const address = toArray(addresses)[0];
  if (!address) return "Address unavailable";
  return [address.street, address.barangay, address.city].filter(Boolean).join(", ");
}

function detectedLocation(address: DeliveryAddress | undefined): string {
  if (!address) return "Pin unavailable";
  if (address.detected_address) return address.detected_address;
  const lat = Number(address.detected_lat ?? address.lat);
  const lng = Number(address.detected_lng ?? address.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "Pin unavailable";
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function coordsFrom(
  lat: number | string | null | undefined,
  lng: number | string | null | undefined
) {
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  return Number.isFinite(parsedLat) && Number.isFinite(parsedLng)
    ? { lat: parsedLat, lng: parsedLng }
    : { lat: null, lng: null };
}

export default async function RiderHome() {
  const { profile } = await requireRider("/rider");
  const supabase = await createAdminSessionClient();
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? null;
  const todayStart = manilaTodayStartISO();
  const recentSince = new Date(
    new Date(todayStart).getTime() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("rider_assignments")
    .select(
      `order_id, assigned_at, picked_up_at, delivered_at,
       orders!inner (
         id, short_code, status, customer_name, customer_phone,
         total_cents, placed_at,
         delivery_addresses (
           street, barangay, city, landmark, delivery_notes,
           lat, lng, google_place_id,
           detected_lat, detected_lng, detected_address
         ),
         payments ( method, status )
       )`
    )
    .eq("rider_profile_id", profile.id)
    .gte("assigned_at", recentSince)
    .order("assigned_at", { ascending: false })
    .limit(50);

  const rows = ((data as AssignmentRow[] | null) ?? [])
    .map((row) => ({
      ...row,
      order: Array.isArray(row.orders) ? row.orders[0] : row.orders,
    }))
    .filter(
      ({ assigned_at, order }) =>
        order &&
        DELIVERY_STATUSES.includes(order.status) &&
        (assigned_at >= todayStart ||
          order.status === "ready" ||
          order.status === "out_for_delivery")
    );

  const active = rows.filter(({ order }) => order.status !== "completed");
  const completedToday = rows.filter(
    ({ order, delivered_at }) => order.status === "completed" && delivered_at && delivered_at >= todayStart
  );

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-zb-sage/20 bg-zb-primary-strong/55 p-4">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zb-bone">
          <Bike className="size-4" />
          Rider shift
        </p>
        <h1 className="mt-2 font-display text-3xl leading-none text-zb-cream">
          Hi, {profile.display_name.split(" ")[0] || "Rider"}
        </h1>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Stat label="Active" value={String(active.length)} />
          <Stat label="Delivered today" value={String(completedToday.length)} />
        </div>
        <Link
          href="/rider/history"
          className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-zb-sage/30 text-sm font-semibold text-zb-cream/80 transition hover:bg-zb-primary hover:text-zb-cream"
        >
          <History className="size-4 text-zb-bone" />
          Delivery history
        </Link>
      </section>

      {error && (
        <p className="rounded-lg border border-zb-danger/40 bg-zb-danger/10 p-3 text-sm text-[#e89a90]">
          Could not load assigned deliveries. Refresh and try again.
        </p>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-2xl text-zb-cream">DELIVERIES</h2>
            <span className="text-xs font-medium text-zb-cream/45">
              Active now
            </span>
          </div>
          <RiderRefreshButton />
        </div>

        {active.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zb-sage/25 px-4 py-12 text-center">
            <p className="font-semibold text-zb-cream">No active deliveries</p>
            <p className="mt-1 text-sm text-zb-cream/45">
              New assignments appear here. Completed deliveries move to history.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {active.map(({ order_id, assigned_at, picked_up_at, delivered_at, order }) => {
              const payment = toArray(order.payments)[0] ?? null;
              const address = toArray(order.delivery_addresses)[0];
              const submitted = coordsFrom(address?.lat, address?.lng);
              const detected = coordsFrom(address?.detected_lat, address?.detected_lng);
              const submittedAddress = addressLine(order.delivery_addresses);
              return (
                <article
                  key={order_id}
                  className="rounded-xl border border-zb-sage/20 bg-zb-primary-strong/55 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono-tabular text-lg font-bold text-zb-cream">
                        {order.short_code}
                      </p>
                      <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-zb-bone">
                        <Clock className="size-3.5" />
                        {statusLabel(order.status)}
                      </p>
                    </div>
                    <p className="font-mono-tabular text-lg font-bold text-zb-bone">
                      {formatPeso(order.total_cents)}
                    </p>
                  </div>

                  <div className="mt-3 space-y-2 text-sm text-zb-cream/70">
                    <p className="flex items-center justify-between gap-2">
                      <span className="truncate">{order.customer_name}</span>
                      {order.customer_phone && (
                        <a
                          href={`tel:${order.customer_phone}`}
                          className="inline-flex shrink-0 items-center gap-1 text-zb-cream/65 hover:text-zb-bone"
                        >
                          <Phone className="size-4" />
                          Call
                        </a>
                      )}
                    </p>
                    <div className="space-y-1.5 rounded-lg bg-zb-primary/35 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zb-cream/35">
                        Submitted address
                      </p>
                      <p className="flex items-start gap-2 text-zb-cream/65">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-zb-sage" />
                        <span>
                          {addressLine(order.delivery_addresses)}
                          {address?.landmark && (
                            <span className="block text-xs text-zb-cream/40">
                              Landmark: {address.landmark}
                            </span>
                          )}
                          {address?.delivery_notes && (
                            <span className="block text-xs text-zb-cream/40">
                              Notes: {address.delivery_notes}
                            </span>
                          )}
                        </span>
                      </p>
                    </div>
                    <p className="flex items-center gap-2 rounded-lg bg-zb-primary/25 px-3 py-2 text-xs text-zb-cream/50">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-zb-sage" />
                      Auto-detected pin:{" "}
                      <span className="font-mono-tabular text-zb-cream/70">
                        {detectedLocation(address)}
                      </span>
                    </p>
                    <p className="inline-flex items-center gap-1.5 text-xs text-zb-cream/45">
                      <ReceiptText className="size-3.5 text-zb-sage" />
                      {payment?.method ?? "Payment"} - {payment?.status ?? "unknown"}
                    </p>
                  </div>

                  <div className="mt-3 rounded-lg bg-zb-primary/25 p-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zb-cream/35">
                      Navigation
                    </p>
                    <RiderNavigationMap
                      apiKey={mapsApiKey}
                      submittedLat={submitted.lat}
                      submittedLng={submitted.lng}
                      detectedLat={detected.lat}
                      detectedLng={detected.lng}
                      submittedAddress={submittedAddress}
                      detectedAddress={address?.detected_address ?? null}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-zb-sage/15 pt-3 text-[11px] text-zb-cream/45">
                    <MiniStep label="Assigned" value={formatClock(assigned_at)} done />
                    <MiniStep label="Pickup" value={formatClock(picked_up_at)} done={Boolean(picked_up_at)} />
                    <MiniStep label="Delivered" value={formatClock(delivered_at)} done={Boolean(delivered_at)} />
                  </div>

                  <Link
                    href={`/rider/delivery/${order.id}`}
                    className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-zb-bone text-sm font-semibold text-zb-primary-dark transition hover:bg-zb-bone-soft"
                  >
                    Open delivery <ArrowRight className="size-4" />
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zb-sage/20 bg-zb-primary/45 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zb-cream/45">
        {label}
      </p>
      <p className="mt-1 font-mono-tabular text-2xl font-bold text-zb-cream">
        {value}
      </p>
    </div>
  );
}

function MiniStep({
  label,
  value,
  done,
}: {
  label: string;
  value: string;
  done: boolean;
}) {
  return (
    <p className="min-w-0">
      <span className="flex items-center gap-1 uppercase tracking-[0.12em]">
        {done && <CheckCircle2 className="size-3 text-zb-bone" />}
        {label}
      </span>
      <span className="mt-0.5 block truncate text-zb-cream/65">{value}</span>
    </p>
  );
}
