import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  CreditCard,
  Map,
  MapPin,
  Phone,
  UserRound,
} from "lucide-react";
import { RiderDeliveryActions } from "@/components/rider/RiderDeliveryActions";
import { RiderNavigationMap } from "@/components/rider/RiderNavigationMap";
import { requireRider } from "@/lib/rider";
import { createAdminSessionClient } from "@/lib/supabase/admin-session";
import { formatPeso } from "@/lib/peso";
import { getGoogleMapsBrowserKey } from "@/lib/google-maps";
import {
  coordsFrom,
  detectedLocationLabel,
  formatSubmittedDeliveryAddress,
} from "@/lib/delivery-address";

export const dynamic = "force-dynamic";

type DeliveryStatus = "ready" | "out_for_delivery" | "completed";
type Embedded<T> = T | T[] | null;

type OrderItemOption = {
  name_snapshot: string;
  quantity: number | null;
};

type OrderItem = {
  qty: number;
  item_name_snapshot: string;
  variation_label_snapshot: string;
  line_total_cents: number;
  order_item_options: Embedded<OrderItemOption>;
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

type Payment = {
  method: string;
  status: string;
  reference: string | null;
};

type RiderAssignment = {
  rider_profile_id: string;
  assigned_at: string;
  picked_up_at: string | null;
  delivered_at: string | null;
  arrived_at: string | null;
  customer_ring_at: string | null;
};

type DeliveryRow = {
  id: string;
  short_code: string;
  status: DeliveryStatus;
  customer_name: string;
  customer_phone: string | null;
  total_cents: number;
  subtotal_cents: number;
  delivery_fee_cents: number;
  notes: string | null;
  placed_at: string;
  order_items: Embedded<OrderItem>;
  delivery_addresses: Embedded<DeliveryAddress>;
  payments: Embedded<Payment>;
  rider_assignments: Embedded<RiderAssignment>;
};

function toArray<T>(value: Embedded<T> | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function formatDateTime(value: string | null): string {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

function statusLabel(status: DeliveryStatus): string {
  if (status === "out_for_delivery") return "Out for delivery";
  return status[0].toUpperCase() + status.slice(1);
}

function mapsUrl(address: DeliveryAddress) {
  const lat = Number(address.lat);
  const lng = Number(address.lng);
  const query =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? `${lat},${lng}`
      : formatSubmittedDeliveryAddress(address);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function addressLine(address: DeliveryAddress) {
  return formatSubmittedDeliveryAddress(address);
}

function detectedCoords(address: DeliveryAddress): { lat: number; lng: number } | null {
  // The device GPS reading captured at checkout, falling back to the delivery
  // coordinates for orders placed before detected_* existed.
  const lat = Number(address.detected_lat ?? address.lat);
  const lng = Number(address.detected_lng ?? address.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function detectedLocation(address: DeliveryAddress) {
  return detectedLocationLabel(address);
}

function detectedMapsUrl(address: DeliveryAddress): string | null {
  const coords = detectedCoords(address);
  return coords
    ? `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`
    : null;
}

export default async function RiderDeliveryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile } = await requireRider(`/rider/delivery/${id}`);
  const supabase = await createAdminSessionClient();
  const mapsApiKey = getGoogleMapsBrowserKey();

  const { data, error } = await supabase
    .from("orders")
    .select(
      `id, short_code, status, customer_name, customer_phone, total_cents,
       subtotal_cents, delivery_fee_cents, notes, placed_at,
       order_items (
         qty,
         item_name_snapshot,
         variation_label_snapshot,
         line_total_cents,
         order_item_options ( name_snapshot, quantity )
       ),
       delivery_addresses (
         street, barangay, city, landmark, delivery_notes,
         lat, lng, google_place_id,
         detected_lat, detected_lng, detected_address
       ),
        payments ( method, status, reference ),
        rider_assignments (
          rider_profile_id, assigned_at, picked_up_at, delivered_at, arrived_at,
          customer_ring_at
        )`
    )
    .eq("id", id)
    .eq("service_mode", "delivery")
    .maybeSingle();

  if (error) {
    console.error("[rider] delivery detail failed:", error.message);
  }
  const order = data as DeliveryRow | null;
  const assignment = toArray(order?.rider_assignments).find(
    (row) => row.rider_profile_id === profile.id
  );
  const address = toArray(order?.delivery_addresses)[0] ?? null;
  const payment = toArray(order?.payments)[0] ?? null;

  if (!order || !assignment || !address) notFound();
  if (!["ready", "out_for_delivery", "completed"].includes(order.status)) {
    notFound();
  }

  const submitted = coordsFrom(address.lat, address.lng);
  const detected = coordsFrom(address.detected_lat, address.detected_lng);
  const submittedAddress = addressLine(address);

  return (
    <div className="space-y-4">
      <Link
        href="/rider"
        className="inline-flex items-center gap-2 text-sm font-medium text-zb-cream/60 transition hover:text-zb-bone"
      >
        <ArrowLeft className="size-4" />
        Back to deliveries
      </Link>

      <section className="rounded-xl border border-zb-sage/20 bg-zb-primary-strong/55 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono-tabular text-2xl font-bold text-zb-cream">
              {order.short_code}
            </p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-zb-bone">
              <Clock className="size-3.5" />
              {statusLabel(order.status)}
            </p>
          </div>
          <p className="font-mono-tabular text-2xl font-bold text-zb-bone">
            {formatPeso(order.total_cents)}
          </p>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <ActionLink href={`tel:${order.customer_phone ?? ""}`} disabled={!order.customer_phone}>
            <Phone className="size-4" />
            Call customer
          </ActionLink>
          <ActionLink href={mapsUrl(address)} external>
            <Map className="size-4" />
            Open in Maps
          </ActionLink>
        </div>
      </section>

      <section className="rounded-xl border border-zb-sage/20 bg-zb-primary-strong/55 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-xl text-zb-cream">NAVIGATION</h2>
          <span className="text-xs font-medium text-zb-cream/45">
            GPS pin preferred
          </span>
        </div>
        <div className="mt-3">
          <RiderNavigationMap
            apiKey={mapsApiKey}
            submittedLat={submitted.lat}
            submittedLng={submitted.lng}
            detectedLat={detected.lat}
            detectedLng={detected.lng}
            submittedAddress={submittedAddress}
            detectedAddress={address.detected_address}
          />
        </div>
      </section>

      <section className="rounded-xl border border-zb-sage/20 bg-zb-primary-strong/55 p-4">
        <h2 className="font-display text-xl text-zb-cream">CUSTOMER</h2>
        <div className="mt-3 space-y-3 text-sm text-zb-cream/70">
          <p className="flex items-center gap-2">
            <UserRound className="size-4 text-zb-sage" />
            {order.customer_name}
          </p>
          {order.customer_phone && (
            <p className="flex items-center gap-2">
              <Phone className="size-4 text-zb-sage" />
              {order.customer_phone}
            </p>
          )}
          <div className="rounded-lg bg-zb-primary/35 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zb-cream/35">
              Submitted address
            </p>
            <p className="mt-1 flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-zb-sage" />
              <span>
                {addressLine(address)}
                {address.landmark && (
                  <span className="mt-1 block text-xs text-zb-cream/45">
                    Landmark: {address.landmark}
                  </span>
                )}
                {address.delivery_notes && (
                  <span className="mt-1 block text-xs text-zb-cream/45">
                    Notes: {address.delivery_notes}
                  </span>
                )}
              </span>
            </p>
          </div>
          <div className="rounded-lg bg-zb-primary/25 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zb-cream/35">
              Auto-detected location
            </p>
            <p className="mt-1 flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-zb-bone" />
              <span>
                <span>{detectedLocation(address)}</span>
                {detectedMapsUrl(address) && (
                  <a
                    href={detectedMapsUrl(address)!}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block text-xs font-semibold text-zb-bone hover:underline"
                  >
                    Open detected pin in Maps
                  </a>
                )}
                {address.google_place_id && (
                  <span className="mt-1 block break-all text-xs text-zb-cream/40">
                    Place ID: {address.google_place_id}
                  </span>
                )}
              </span>
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zb-sage/20 bg-zb-primary-strong/55 p-4">
        <h2 className="font-display text-xl text-zb-cream">ORDER</h2>
        <ul className="mt-3 space-y-2 text-sm text-zb-cream/80">
          {toArray(order.order_items).map((item, index) => (
            <li
              key={`${item.item_name_snapshot}-${item.variation_label_snapshot}-${index}`}
              className="flex gap-2 rounded-lg bg-zb-primary/35 px-3 py-2"
            >
              <span className="font-mono-tabular font-semibold text-zb-bone">
                {item.qty}x
              </span>
              <span className="min-w-0 flex-1">
                {item.item_name_snapshot}
                {item.variation_label_snapshot && (
                  <span className="text-zb-cream/45">
                    {" "}
                    - {item.variation_label_snapshot}
                  </span>
                )}
                {toArray(item.order_item_options).length > 0 && (
                  <span className="mt-0.5 block text-xs text-zb-cream/45">
                    Add-ons:{" "}
                    {toArray(item.order_item_options)
                      .map((option) =>
                        option.quantity && option.quantity > 1
                          ? `${option.name_snapshot} x${option.quantity}`
                          : option.name_snapshot
                      )
                      .join(", ")}
                  </span>
                )}
              </span>
              <span className="font-mono-tabular text-zb-cream/60">
                {formatPeso(item.line_total_cents)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 border-t border-zb-sage/15 pt-3 text-sm">
          <TotalRow label="Subtotal" value={order.subtotal_cents} />
          <TotalRow label="Delivery fee" value={order.delivery_fee_cents} />
          <TotalRow label="Total" value={order.total_cents} strong />
        </div>
      </section>

      <section className="rounded-xl border border-zb-sage/20 bg-zb-primary-strong/55 p-4">
        <h2 className="font-display text-xl text-zb-cream">SHIFT LOG</h2>
        <div className="mt-3 grid gap-2 text-sm text-zb-cream/65 sm:grid-cols-3">
          <LogItem label="Assigned" value={formatDateTime(assignment.assigned_at)} />
          <LogItem label="Picked up" value={formatDateTime(assignment.picked_up_at)} />
          <LogItem label="Delivered" value={formatDateTime(assignment.delivered_at)} />
        </div>
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-zb-cream/45">
          <CreditCard className="size-3.5 text-zb-sage" />
          {payment?.method ?? "Payment"} - {payment?.status ?? "unknown"}
          {payment?.reference ? ` (${payment.reference})` : ""}
        </p>
      </section>

      {order.status !== "completed" && (
        <section className="sticky bottom-3 rounded-xl border border-zb-sage/25 bg-zb-primary-strong/95 p-3 shadow-xl shadow-black/30 backdrop-blur">
          <RiderDeliveryActions
            orderId={order.id}
            status={order.status}
            pickedUpAt={assignment.picked_up_at}
            arrivedAt={assignment.arrived_at}
            customerRingAt={assignment.customer_ring_at}
            paymentMethod={payment?.method ?? null}
            paymentStatus={payment?.status ?? null}
          />
        </section>
      )}
    </div>
  );
}

function ActionLink({
  href,
  children,
  external,
  disabled,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <span className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-zb-sage/20 text-sm font-semibold text-zb-cream/30">
        {children}
      </span>
    );
  }
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-zb-sage/35 text-sm font-semibold text-zb-cream transition hover:bg-zb-primary"
    >
      {children}
    </a>
  );
}

function TotalRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <p className={`flex justify-between ${strong ? "font-bold text-zb-bone" : "text-zb-cream/60"}`}>
      <span>{label}</span>
      <span className="font-mono-tabular">{formatPeso(value)}</span>
    </p>
  );
}

function LogItem({ label, value }: { label: string; value: string }) {
  return (
    <p className="rounded-lg bg-zb-primary/35 px-3 py-2">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-zb-cream/35">
        {label}
      </span>
      <span>{value}</span>
    </p>
  );
}
