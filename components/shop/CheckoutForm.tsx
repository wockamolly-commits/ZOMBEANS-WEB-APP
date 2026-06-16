"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Banknote,
  Bike,
  Check,
  Clock3,
  Coffee,
  CreditCard,
  ChevronDown,
  MapPin,
  ShoppingBag,
  Store,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Select } from "@base-ui/react/select";
import { getCartSubtotal, readCart, type CartLine } from "@/lib/cart";
import {
  DELIVERY_TIERS,
  generatePickupSlots,
  getDeliveryFeeCents,
  type ServiceMode,
} from "@/lib/checkout";
import { formatPeso } from "@/lib/peso";

const inputClass =
  "mt-2 h-12 w-full rounded-xl border border-zb-sage/35 bg-zb-primary-dark/55 px-4 text-zb-cream placeholder:text-zb-cream/35 focus:border-zb-bone focus:outline-none focus:ring-2 focus:ring-zb-bone/20";
const textareaClass = `${inputClass} min-h-28 resize-y py-3`;

const modes = [
  { value: "dine_in", label: "Dine-in", detail: "Enjoy it at the cafe", icon: Coffee },
  { value: "pickup", label: "Pickup", detail: "Ready at your chosen time", icon: Store },
  { value: "delivery", label: "Delivery", detail: "Within 6 km of the cafe", icon: Bike },
] as const;

export function CheckoutForm() {
  const [lines, setLines] = useState<CartLine[] | null>(null);
  const [mode, setMode] = useState<ServiceMode>("pickup");
  const [pickupTime, setPickupTime] = useState<string | null>(null);
  const [deliveryTier, setDeliveryTier] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const pickupSlots = useMemo(() => generatePickupSlots(), []);

  useEffect(() => {
    const timeout = window.setTimeout(() => setLines(readCart()), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  if (lines === null) return <div className="min-h-96" aria-label="Loading checkout" />;

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <ShoppingBag className="mx-auto size-12 text-zb-bone" />
        <h1 className="mt-5 font-display text-5xl">NOTHING TO CHECK OUT</h1>
        <p className="mt-3 text-zb-cream/70">Your next favorite is still on the menu.</p>
        <Link href="/menu" className="mt-7 inline-flex h-11 items-center rounded-xl bg-zb-bone px-5 font-semibold text-zb-primary-dark hover:bg-zb-bone-soft">
          Browse the menu
        </Link>
      </div>
    );
  }

  const subtotal = getCartSubtotal(lines);
  const deliveryFee = mode === "delivery" ? getDeliveryFeeCents(deliveryTier) : 0;
  const total = subtotal + deliveryFee;

  function reviewOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    setReviewed(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <form
      onSubmit={reviewOrder}
      onInput={() => setReviewed(false)}
      className="grid gap-8 lg:grid-cols-[1fr_23rem]"
    >
      <input type="hidden" name="serviceMode" value={mode} />
      <div className="space-y-7">
        <section className="rounded-2xl border border-zb-sage/25 bg-zb-primary-strong/75 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-zb-bone font-mono text-sm font-bold text-zb-primary-dark">1</span>
            <div>
              <h2 className="font-display text-3xl">SERVICE MODE</h2>
              <p className="text-sm text-zb-cream/60">How are you getting your order?</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {modes.map((entry) => {
              const Icon = entry.icon;
              const selected = mode === entry.value;
              return (
                <button
                  key={entry.value}
                  type="button"
                  onClick={() => {
                    setMode(entry.value);
                    setReviewed(false);
                  }}
                  className={`rounded-2xl border p-4 text-left transition ${selected ? "border-zb-bone bg-zb-bone/10" : "border-zb-sage/30 bg-zb-primary-dark/35 hover:border-zb-sage"}`}
                >
                  <Icon className={`size-5 ${selected ? "text-zb-bone" : "text-zb-cream/60"}`} />
                  <span className="mt-3 block font-semibold">{entry.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-zb-cream/55">{entry.detail}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-zb-sage/25 bg-zb-primary-strong/75 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-zb-bone font-mono text-sm font-bold text-zb-primary-dark">2</span>
            <div>
              <h2 className="font-display text-3xl">YOUR DETAILS</h2>
              <p className="text-sm text-zb-cream/60">Just enough to prepare and hand over the order.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Name
              <input name="customerName" required autoComplete="name" className={inputClass} placeholder="Your name" />
            </label>
            {mode !== "dine_in" && (
              <label className="text-sm font-medium">
                Mobile number
                <input name="customerPhone" required inputMode="tel" autoComplete="tel" pattern="(?:\+63|0)9\d{9}" title="Use a Philippine mobile number such as 09186056360" className={inputClass} placeholder="09XX XXX XXXX" />
              </label>
            )}

            {mode === "dine_in" && (
              <fieldset className="sm:col-span-2">
                <legend className="text-sm font-medium">Table number</legend>
                <p className="mt-1 text-xs text-zb-cream/50">
                  Choose the number displayed on your table.
                </p>
                <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {Array.from({ length: 12 }, (_, index) => {
                    const table = index + 1;
                    return (
                      <label key={table} className="cursor-pointer">
                        <input
                          type="radio"
                          name="tableNumber"
                          value={table}
                          required
                          className="peer sr-only"
                        />
                        <span className="flex h-14 items-center justify-center rounded-xl border border-zb-sage/30 bg-zb-primary-dark/35 font-mono-tabular text-sm font-bold text-zb-cream/70 transition hover:border-zb-sage hover:bg-zb-sage/10 peer-checked:border-zb-bone peer-checked:bg-zb-bone peer-checked:text-zb-primary-dark peer-focus-visible:ring-2 peer-focus-visible:ring-zb-bone peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-zb-primary-strong">
                          {String(table).padStart(2, "0")}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {mode === "pickup" && (
              <label className="text-sm font-medium sm:col-span-2">
                Pickup time
                <p className="mt-1 flex items-center gap-1.5 text-xs text-zb-cream/50">
                  <Clock3 className="size-3.5" /> Slots include the current preparation estimate.
                </p>
                {pickupSlots.length ? (
                  <Select.Root
                    items={pickupSlots}
                    name="pickupTime"
                    required
                    value={pickupTime}
                    onValueChange={(value) => setPickupTime(value)}
                  >
                    <Select.Trigger
                      name="pickupTime"
                      className="group mt-3 flex h-14 w-full items-center rounded-2xl border border-zb-sage/35 bg-zb-primary-dark/65 px-4 text-left font-mono-tabular text-sm font-semibold text-zb-cream shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition hover:border-zb-sage data-[popup-open]:border-zb-bone data-[popup-open]:ring-4 data-[popup-open]:ring-zb-bone/10 focus-visible:border-zb-bone focus-visible:ring-4 focus-visible:ring-zb-bone/10"
                    >
                      <Clock3 className="mr-4 size-4 shrink-0 text-zb-bone" />
                      <Select.Value placeholder="Choose a pickup time" className="flex-1" />
                      <ChevronDown className="ml-4 size-4 shrink-0 text-zb-cream/50 transition group-data-[popup-open]:rotate-180 group-data-[popup-open]:text-zb-bone" />
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Positioner
                        sideOffset={8}
                        align="start"
                        alignItemWithTrigger={false}
                        className="z-50"
                      >
                        <Select.Popup className="w-[var(--anchor-width)] min-w-64 origin-[var(--transform-origin)] rounded-2xl border border-zb-bone/45 bg-zb-primary-dark p-2 text-zb-cream shadow-[0_24px_70px_rgba(0,0,0,0.55)] outline-none transition data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
                          <div className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zb-bone/75">
                            Available today
                          </div>
                          <Select.List className="max-h-64 overflow-y-auto overscroll-contain pr-1 [scrollbar-color:rgba(229,192,123,0.6)_transparent] [scrollbar-width:thin]">
                            {pickupSlots.map((slot) => (
                              <Select.Item
                                key={slot.value}
                                value={slot.value}
                                className="grid min-h-11 cursor-default grid-cols-[1fr_auto] items-center rounded-xl px-3 font-mono-tabular text-sm text-zb-cream/75 outline-none transition data-[highlighted]:bg-zb-sage/25 data-[highlighted]:text-zb-cream data-[selected]:bg-zb-bone data-[selected]:font-bold data-[selected]:text-zb-primary-dark"
                              >
                                <Select.ItemText>{slot.label}</Select.ItemText>
                                <Select.ItemIndicator className="ml-4">
                                  <Check className="size-4" />
                                </Select.ItemIndicator>
                              </Select.Item>
                            ))}
                          </Select.List>
                        </Select.Popup>
                      </Select.Positioner>
                    </Select.Portal>
                  </Select.Root>
                ) : (
                  <div className="mt-3 rounded-xl border border-zb-danger/35 bg-zb-danger/10 p-4 text-sm text-zb-cream/75">
                    No pickup slots remain today. Please come back tomorrow.
                  </div>
                )}
              </label>
            )}

            {mode === "delivery" && (
              <>
                <label className="text-sm font-medium sm:col-span-2">
                  Delivery address
                  <textarea name="street" required autoComplete="street-address" className={textareaClass} placeholder="House number, street, subdivision" />
                </label>
                <label className="text-sm font-medium">
                  Barangay
                  <input name="barangay" required className={inputClass} placeholder="Barangay" />
                </label>
                <label className="text-sm font-medium">
                  Landmark
                  <input name="landmark" className={inputClass} placeholder="Near the red gate" />
                </label>
                <fieldset className="sm:col-span-2">
                  <legend className="text-sm font-medium">Approximate distance from Zombeans</legend>
                  <p className="mt-1 text-xs text-zb-cream/50">
                    Pick the closest estimate. Maps will calculate this automatically once connected.
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {DELIVERY_TIERS.map((tier) => (
                      <label key={tier.value} className="cursor-pointer">
                        <input
                          type="radio"
                          name="deliveryTier"
                          value={tier.value}
                          required
                          checked={deliveryTier === tier.value}
                          onChange={(event) => setDeliveryTier(event.target.value)}
                          className="peer sr-only"
                        />
                        <span className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-zb-sage/30 bg-zb-primary-dark/35 px-4 transition hover:border-zb-sage hover:bg-zb-sage/10 peer-checked:border-zb-bone peer-checked:bg-zb-bone/10 peer-focus-visible:ring-2 peer-focus-visible:ring-zb-bone">
                          <span className="flex items-center gap-3">
                            <span className="flex size-9 items-center justify-center rounded-full bg-zb-sage/15 text-zb-bone peer-checked:bg-zb-bone">
                              <MapPin className="size-4" />
                            </span>
                            <span className="text-sm font-semibold">{tier.label}</span>
                          </span>
                          <span className="font-mono-tabular text-sm font-bold text-zb-bone">
                            {formatPeso(tier.feeCents)}
                          </span>
                        </span>
                      </label>
                    ))}
                    <label className="cursor-pointer sm:col-span-2">
                      <input
                        type="radio"
                        name="deliveryTier"
                        value="out-of-zone"
                        required
                        checked={deliveryTier === "out-of-zone"}
                        onChange={(event) => setDeliveryTier(event.target.value)}
                        className="peer sr-only"
                      />
                      <span className="flex min-h-14 items-center justify-between rounded-xl border border-zb-sage/25 bg-zb-primary-dark/25 px-4 text-sm text-zb-cream/55 transition hover:border-zb-danger/50 peer-checked:border-zb-danger peer-checked:bg-zb-danger/10 peer-checked:text-zb-cream peer-focus-visible:ring-2 peer-focus-visible:ring-zb-danger">
                        <span>More than 6 km away</span>
                        <span className="text-xs font-semibold uppercase tracking-wider">Pickup only</span>
                      </span>
                    </label>
                  </div>
                  {deliveryTier === "out-of-zone" && (
                    <span className="mt-2 block rounded-lg border border-zb-danger/40 bg-zb-danger/10 p-3 text-xs leading-5 text-zb-cream">
                      Sorry, that is outside our delivery zone. Switch to Pickup and your cart stays right here.
                    </span>
                  )}
                </fieldset>
              </>
            )}

            <label className="text-sm font-medium sm:col-span-2">
              Order notes <span className="font-normal text-zb-cream/45">(optional)</span>
              <textarea name="notes" className={textareaClass} placeholder="Allergies, preparation requests, or handoff notes" />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-zb-sage/25 bg-zb-primary-strong/75 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-zb-bone font-mono text-sm font-bold text-zb-primary-dark">3</span>
            <div>
              <h2 className="font-display text-3xl">PAYMENT</h2>
              <p className="text-sm text-zb-cream/60">Online payments unlock when PayMongo is connected.</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <label className="flex cursor-pointer items-center gap-4 rounded-xl border border-zb-bone bg-zb-bone/10 p-4">
              <input type="radio" name="paymentMethod" value="cash" defaultChecked className="accent-zb-bone" />
              <Banknote className="size-5 text-zb-bone" />
              <span><span className="block font-semibold">Cash</span><span className="text-xs text-zb-cream/55">Pay at the counter or upon delivery</span></span>
            </label>
            <div className="flex items-center gap-4 rounded-xl border border-zb-sage/20 bg-zb-primary-dark/25 p-4 opacity-55">
              <CreditCard className="size-5" />
              <span><span className="block font-semibold">GCash, Maya, or card</span><span className="text-xs text-zb-cream/55">Coming with PayMongo integration</span></span>
            </div>
          </div>
        </section>
      </div>

      <aside className="h-fit rounded-2xl border border-zb-sage/30 bg-zb-primary-strong p-5 lg:sticky lg:top-24">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-3xl">YOUR ORDER</h2>
          <Link href="/cart" className="text-xs font-semibold text-zb-bone hover:underline">Edit cart</Link>
        </div>
        <div className="mt-5 max-h-72 space-y-3 overflow-y-auto pr-1">
          {lines.map((line) => (
            <div key={line.id} className="grid grid-cols-[3.25rem_1fr_auto] items-center gap-3">
              <div className="relative aspect-square overflow-hidden rounded-lg bg-zb-cream/90">
                <Image src={line.image} alt="" fill sizes="52px" className="object-contain p-1" />
              </div>
              <div className="min-w-0"><p className="truncate text-sm font-medium">{line.quantity}x {line.name}</p><p className="truncate text-xs text-zb-cream/45">{line.variationLabel}</p></div>
              <span className="font-mono-tabular text-xs text-zb-cream/75">{formatPeso(line.unitPriceCents * line.quantity)}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 space-y-3 border-t border-zb-sage/25 pt-4 text-sm">
          <div className="flex justify-between text-zb-cream/65"><span>Subtotal</span><span className="font-mono-tabular text-zb-cream">{formatPeso(subtotal)}</span></div>
          <div className="flex justify-between text-zb-cream/65"><span>Delivery fee</span><span className="font-mono-tabular text-zb-cream">{deliveryFee ? formatPeso(deliveryFee) : "-"}</span></div>
          <div className="flex justify-between border-t border-zb-sage/25 pt-3 text-base font-bold"><span>Total</span><span className="font-mono-tabular text-zb-bone">{formatPeso(total)}</span></div>
        </div>

        {!reviewed ? (
          <button type="submit" disabled={deliveryTier === "out-of-zone" || (mode === "pickup" && pickupSlots.length === 0)} className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-zb-bone px-4 font-semibold text-zb-primary-dark transition hover:bg-zb-bone-soft disabled:cursor-not-allowed disabled:opacity-45">
            Review order <Check className="size-4" />
          </button>
        ) : (
          <div className="mt-5 rounded-xl border border-zb-bone/45 bg-zb-bone/10 p-4">
            <p className="flex items-center gap-2 font-semibold text-zb-bone"><Check className="size-4" /> Ready for submission</p>
            <p className="mt-2 text-xs leading-5 text-zb-cream/65">Your details and totals look good. Final order placement will be enabled when the secure `place_order()` backend is connected.</p>
            <button type="button" disabled className="mt-4 h-11 w-full rounded-lg bg-zb-bone font-semibold text-zb-primary-dark opacity-50">Place order</button>
          </div>
        )}
        <p className="mt-4 flex items-start gap-2 text-[11px] leading-5 text-zb-cream/45"><MapPin className="mt-0.5 size-3.5 shrink-0" /> San Julio Subdivision, Nangka St, Barangay 2, San Carlos City</p>
      </aside>
    </form>
  );
}
