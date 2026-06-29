import { notFound } from "next/navigation";
import { Check, MapPin, Phone, Receipt, Sparkles } from "lucide-react";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { DoodleBg } from "@/components/shared/DoodleBg";
import { createReadOnlyClient } from "@/lib/supabase/server";
import { formatPeso } from "@/lib/peso";
import { CartClearOnArrival } from "@/components/shop/CartClearOnArrival";
import { OrderStatusPoller } from "@/components/shop/OrderStatusPoller";

export const dynamic = "force-dynamic";

type OrderPayload = {
  short_code: string;
  status:
    | "pending"
    | "accepted"
    | "preparing"
    | "ready"
    | "out_for_delivery"
    | "completed"
    | "rejected"
    | "cancelled";
  service_mode: "dine_in" | "take_out" | "pickup" | "delivery";
  customer_name: string;
  subtotal_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
  placed_at: string;
  accepted_at: string | null;
  ready_at: string | null;
  completed_at: string | null;
  rejected_reason: string | null;
  pickup_time: string | null;
  delivery_address: {
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
  } | null;
  items: Array<{
    name: string;
    variation: string;
    qty: number;
    unit_price_cents: number;
    line_total_cents: number;
    options: Array<{
      group: string;
      name: string;
      price_delta_cents: number;
      quantity: number;
    }>;
  }>;
};

const SERVICE_LABEL: Record<OrderPayload["service_mode"], string> = {
  dine_in: "Dine-in",
  take_out: "Take Out",
  pickup: "Pickup",
  delivery: "Delivery",
};

function timelineFor(mode: OrderPayload["service_mode"]) {
  const steps: Array<{ key: OrderPayload["status"]; label: string }> = [
    { key: "pending", label: "Placed" },
    { key: "preparing", label: "Preparing" },
    { key: "ready", label: "Ready" },
  ];
  if (mode === "delivery") {
    steps.push({ key: "out_for_delivery", label: "Out for delivery" });
  }
  steps.push({ key: "completed", label: "Completed" });
  return steps;
}

function statusIndex(
  status: OrderPayload["status"],
  timeline: ReturnType<typeof timelineFor>
) {
  if (status === "accepted") {
    return timeline.findIndex((step) => step.key === "preparing");
  }
  return timeline.findIndex((step) => step.key === status);
}

function submittedAddress(
  address: NonNullable<OrderPayload["delivery_address"]>
) {
  return [address.street, address.barangay, address.city]
    .filter(Boolean)
    .join(", ");
}

function coordsLabel(lat: number | string, lng: number | string) {
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
    return null;
  }
  return `${parsedLat.toFixed(6)}, ${parsedLng.toFixed(6)}`;
}

function detectedLocation(
  address: NonNullable<OrderPayload["delivery_address"]>
) {
  return (
    address.detected_address ??
    (address.detected_lat != null && address.detected_lng != null
      ? coordsLabel(address.detected_lat, address.detected_lng)
      : coordsLabel(address.lat, address.lng))
  );
}

export async function generateMetadata({
  params,
}: PageProps<"/order/[code]">) {
  const { code } = await params;
  return { title: `Order ${code.toUpperCase()}` };
}

export default async function OrderTrackingPage({
  params,
  searchParams,
}: PageProps<"/order/[code]">) {
  const { code } = await params;
  const { fresh } = await searchParams;

  const supabase = await createReadOnlyClient();
  const { data, error } = await supabase.rpc("get_order_by_code", {
    p_code: code.toUpperCase(),
  });

  if (error || !data) notFound();
  const order = data as OrderPayload;
  const timeline = timelineFor(order.service_mode);
  const index = statusIndex(order.status, timeline);
  const rejected = order.status === "rejected" || order.status === "cancelled";
  const terminal = order.status === "completed" || rejected;

  return (
    <>
      <Header />
      {fresh ? <CartClearOnArrival /> : null}
      <OrderStatusPoller terminal={terminal} />
      <main className="flex-1">
        <DoodleBg>
          <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="rounded-3xl border border-zb-sage/30 bg-zb-primary-strong/80 p-6 sm:p-8">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zb-bone">
                    Order code
                  </p>
                  <p className="mt-1 font-mono-tabular text-3xl font-bold text-zb-cream sm:text-4xl">
                    {order.short_code}
                  </p>
                </div>
                <p className="text-xs text-zb-cream/55">
                  Placed {new Date(order.placed_at).toLocaleString("en-PH")}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-zb-bone/40 bg-zb-bone/10 px-3 py-1 text-xs font-semibold text-zb-bone">
                  <Sparkles className="size-3.5" />
                  {SERVICE_LABEL[order.service_mode]}
                  {order.pickup_time
                    ? ` · ${new Date(order.pickup_time).toLocaleTimeString("en-PH", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}`
                    : null}
                </span>
                {!terminal && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-zb-sage/30 bg-zb-primary-dark/40 px-3 py-1 text-xs font-medium text-zb-cream/65">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-zb-bone opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-zb-bone" />
                    </span>
                    Updating live
                  </span>
                )}
              </div>

              {rejected ? (
                <div className="mt-6 rounded-2xl border border-zb-danger/40 bg-zb-danger/10 p-4 text-sm text-zb-cream">
                  <p>This order was {order.status}.</p>
                  {order.rejected_reason ? (
                    <p className="mt-2 text-zb-cream/80">
                      Reason: {order.rejected_reason}
                    </p>
                  ) : null}
                  <p className="mt-2 text-zb-cream/70">
                    Reach out to the cafe if you need help.
                  </p>
                </div>
              ) : (
                <ol className="mt-7 grid gap-3">
                  {timeline.map((step, i) => {
                    const done = i <= index;
                    const current = i === index;
                    return (
                      <li
                        key={step.key}
                        className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition ${
                          done
                            ? "border-zb-bone/45 bg-zb-bone/10 text-zb-cream"
                            : "border-zb-sage/20 bg-zb-primary-dark/30 text-zb-cream/50"
                        }`}
                      >
                        <span
                          className={`flex size-7 items-center justify-center rounded-full font-mono text-xs font-bold ${
                            done
                              ? "bg-zb-bone text-zb-primary-dark"
                              : "bg-zb-primary-dark text-zb-cream/55"
                          }`}
                        >
                          {done ? <Check className="size-3.5" /> : i + 1}
                        </span>
                        <span className="font-semibold">{step.label}</span>
                        {current && (
                          <span className="ml-auto text-xs font-semibold uppercase tracking-wider text-zb-bone">
                            Now
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            <div className="mt-6 rounded-3xl border border-zb-sage/25 bg-zb-primary-strong/65 p-6 sm:p-8">
              <h2 className="font-display text-2xl text-zb-cream">YOUR ORDER</h2>
              <ul className="mt-4 divide-y divide-zb-sage/20 text-sm">
                {order.items.map((line, i) => (
                  <li
                    key={i}
                    className="grid grid-cols-[1fr_auto] gap-3 py-3"
                  >
                    <div>
                      <p className="font-semibold text-zb-cream">
                        {line.qty}× {line.name}
                      </p>
                      <p className="text-xs text-zb-cream/55">{line.variation}</p>
                      {line.options?.length ? (
                        <ul className="mt-1 space-y-0.5 text-xs text-zb-cream/45">
                          {line.options.map((option) => (
                            <li key={`${option.group}-${option.name}`}>
                              {option.quantity > 1
                                ? `${option.name} x${option.quantity}`
                                : option.name}
                              {option.price_delta_cents > 0
                                ? ` (+${formatPeso(option.price_delta_cents * option.quantity)})`
                                : ""}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    <p className="font-mono-tabular text-sm text-zb-cream/85">
                      {formatPeso(line.line_total_cents)}
                    </p>
                  </li>
                ))}
              </ul>
              <dl className="mt-5 space-y-2 border-t border-zb-sage/25 pt-4 text-sm">
                <div className="flex justify-between text-zb-cream/65">
                  <dt>Subtotal</dt>
                  <dd className="font-mono-tabular text-zb-cream">
                    {formatPeso(order.subtotal_cents)}
                  </dd>
                </div>
                {order.delivery_fee_cents > 0 && (
                  <div className="flex justify-between text-zb-cream/65">
                    <dt>Delivery fee</dt>
                    <dd className="font-mono-tabular text-zb-cream">
                      {formatPeso(order.delivery_fee_cents)}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-zb-sage/25 pt-3 text-base font-bold">
                  <dt>Total</dt>
                  <dd className="font-mono-tabular text-zb-bone">
                    {formatPeso(order.total_cents)}
                  </dd>
                </div>
              </dl>
              <p className="mt-5 flex items-center gap-2 text-xs text-zb-cream/55">
                <Receipt className="size-3.5 text-zb-bone" /> For {order.customer_name}
              </p>
            </div>

            {order.service_mode === "delivery" && order.delivery_address && (
              <div className="mt-6 rounded-3xl border border-zb-sage/25 bg-zb-primary-strong/65 p-6 sm:p-8">
                <h2 className="font-display text-2xl text-zb-cream">
                  DELIVERY DETAILS
                </h2>
                <div className="mt-4 grid gap-3 text-sm text-zb-cream/70">
                  <div className="rounded-xl bg-zb-primary/35 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zb-cream/35">
                      Submitted address
                    </p>
                    <p className="mt-1 flex items-start gap-2">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-zb-sage" />
                      <span>
                        {submittedAddress(order.delivery_address)}
                        {order.delivery_address.landmark && (
                          <span className="mt-1 block text-xs text-zb-cream/45">
                            Landmark: {order.delivery_address.landmark}
                          </span>
                        )}
                        {order.delivery_address.delivery_notes && (
                          <span className="mt-1 block text-xs text-zb-cream/45">
                            Notes: {order.delivery_address.delivery_notes}
                          </span>
                        )}
                      </span>
                    </p>
                  </div>
                  <div className="rounded-xl bg-zb-primary/25 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zb-cream/35">
                      Auto-detected location
                    </p>
                    <p className="mt-1 flex items-start gap-2">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-zb-bone" />
                      <span>
                        {detectedLocation(order.delivery_address) ??
                          "Not available"}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            <p className="mt-6 flex items-start gap-2 rounded-2xl border border-zb-sage/20 bg-zb-primary-dark/40 px-4 py-3 text-xs leading-5 text-zb-cream/65">
              <MapPin className="mt-0.5 size-4 shrink-0 text-zb-bone" />
              San Julio Subdivision, Nangka St, Barangay 2, San Carlos City ·{" "}
              <a href="tel:+639186056360" className="inline-flex items-center gap-1 text-zb-cream hover:text-zb-bone">
                <Phone className="size-3" /> 0918 605 6360
              </a>
            </p>
            <p className="mt-3 text-center text-[11px] text-zb-cream/35">
              Save this page or your order code <span className="font-mono">{order.short_code}</span> to check back later.
            </p>
          </section>
        </DoodleBg>
      </main>
      <Footer />
    </>
  );
}
