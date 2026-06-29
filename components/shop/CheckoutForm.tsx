"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Banknote,
  Bike,
  Check,
  Clock3,
  Coffee,
  CreditCard,
  ChevronDown,
  FlaskConical,
  LogIn,
  MapPin,
  ShieldAlert,
  ShoppingBag,
  Store,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Select } from "@base-ui/react/select";
import {
  getCartSubtotal,
  getModifierDisplayName,
  readCart,
  type CartLine,
} from "@/lib/cart";
import {
  generatePickupSlots,
  getDeliveryFeeCents,
  isStoreOpen,
  STORE_HOURS_SUMMARY,
  type PickupSlot,
  type ServiceMode,
} from "@/lib/checkout";
import { formatPeso } from "@/lib/peso";
import { placeOrder, type PlaceOrderInput } from "@/app/actions/checkout";
import {
  DeliveryMapPicker,
  type DeliveryDetails,
} from "@/components/shop/DeliveryMapPicker";
import { KitchenClosingBanner } from "@/components/shop/KitchenClosingBanner";
import {
  amountUntilFreeDelivery,
  qualifiesForFreeDelivery,
  type DeliveryTier,
} from "@/lib/delivery";
import { createClient as createBrowserClient } from "@/lib/supabase/browser";
import type { SavedAddress } from "@/lib/auth";

const inputClass =
  "mt-2 h-12 w-full rounded-xl border border-zb-sage/35 bg-zb-primary-dark/55 px-4 text-zb-cream placeholder:text-zb-cream/35 focus:border-zb-bone focus:outline-none focus:ring-2 focus:ring-zb-bone/20";
const textareaClass = `${inputClass} min-h-28 resize-y py-3`;

// Top-level fulfillment choice. "Take Out" groups the pickup and delivery
// methods below — it isn't a final mode on its own.
const topModes = [
  { value: "dine_in", label: "Dine-in", detail: "Enjoy it at the cafe", icon: Coffee },
  { value: "take_out", label: "Take Out", detail: "Pickup or delivery", icon: ShoppingBag },
] as const;

// The two ways to take an order out, revealed once "Take Out" is chosen.
const takeOutModes = [
  { value: "pickup", label: "Pickup", detail: "Ready at your chosen time", icon: Store },
  { value: "delivery", label: "Delivery", detail: "Within 6 km of the cafe", icon: Bike },
] as const;

export function CheckoutForm({
  isLoggedIn,
  email,
  profile,
  savedAddresses,
  operationsRole,
  webstoreOpen,
  closureLabel,
  closedUntil,
  prepBufferMinutes,
  physicalOpen,
  physicalLabel,
  mapsEnabled,
  mapsApiKey,
  storeLat,
  storeLng,
  deliveryTiers,
  deliveryMaxKm,
}: {
  isLoggedIn: boolean;
  email: string | null;
  profile: { display_name: string | null; phone: string | null };
  savedAddresses: SavedAddress[];
  operationsRole: "admin" | "staff" | null;
  webstoreOpen: boolean;
  closureLabel: string | null;
  closedUntil: string | null;
  prepBufferMinutes: number;
  physicalOpen: boolean;
  physicalLabel: string | null;
  mapsEnabled: boolean;
  mapsApiKey: string | null;
  storeLat: number;
  storeLng: number;
  deliveryTiers: DeliveryTier[];
  deliveryMaxKm: number;
}) {
  const [lines, setLines] = useState<CartLine[] | null>(null);
  const [mode, setMode] = useState<ServiceMode>("pickup");
  const [pickupTime, setPickupTime] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] =
    useState<PlaceOrderInput["paymentMethod"]>("cash");
  const [mapDetails, setMapDetails] = useState<DeliveryDetails | null>(null);
  const [gps, setGps] = useState<{
    lat: number;
    lng: number;
    address: string | null;
  } | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [reviewed, setReviewed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isTestOrder, setIsTestOrder] = useState(false);
  const [browserLoggedIn, setBrowserLoggedIn] = useState<boolean | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [pickupSlots, setPickupSlots] = useState<PickupSlot[]>(() =>
    generatePickupSlots(new Date(), prepBufferMinutes)
  );
  // Start optimistically open to avoid a closed flash during hydration; the
  // effect below corrects it on mount and keeps it current.
  const [storeOpen, setStoreOpen] = useState(true);

  useEffect(() => {
    if (operationsRole) return;

    let active = true;
    const supabase = createBrowserClient();
    const syncLoggedIn = (loggedIn: boolean) => {
      if (!active) return;
      setBrowserLoggedIn(loggedIn ? true : isLoggedIn ? null : false);
      const refreshKey = "zb-checkout-auth-refresh";
      if (loggedIn === isLoggedIn) {
        window.sessionStorage.removeItem(refreshKey);
      } else if (loggedIn && !window.sessionStorage.getItem(refreshKey)) {
        window.sessionStorage.setItem(refreshKey, "1");
        router.refresh();
      }
    };

    void supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) return;
      syncLoggedIn(Boolean(session?.user));
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        syncLoggedIn(Boolean(session?.user));
        return;
      }
      if (event === "SIGNED_OUT") {
        syncLoggedIn(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [isLoggedIn, operationsRole, router]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setLines(readCart()), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  // Keep the slot list and open/closed state current while the page stays
  // open, so ordering re-enables on its own the moment the café opens.
  useEffect(() => {
    const refresh = () => {
      setPickupSlots(generatePickupSlots(new Date(), prepBufferMinutes));
      setStoreOpen(isStoreOpen());
    };
    refresh();
    const id = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(id);
  }, [prepBufferMinutes]);

  if (operationsRole === "staff") {
    return (
      <div
        role="alert"
        className="mx-auto max-w-xl rounded-2xl border border-zb-bone/40 bg-zb-primary-strong/85 px-6 py-12 text-center"
      >
        <ShieldAlert className="mx-auto size-12 text-zb-bone" />
        <h2 className="mt-5 font-display text-5xl">STAFF CHECKOUT RESTRICTED</h2>
        <p className="mt-3 text-zb-cream/70">
          Staff accounts are reserved for cafe operations and cannot place
          webstore orders. For a personal purchase, sign out of the staff
          account and use a separate customer account.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/workspace"
            className="inline-flex h-11 items-center rounded-xl bg-zb-bone px-5 font-semibold text-zb-primary-dark hover:bg-zb-bone-soft"
          >
            Return to workspace
          </Link>
          <Link
            href="/auth/signout?scope=admin&next=/login?next=/checkout"
            className="inline-flex h-11 items-center rounded-xl border border-zb-bone/45 px-5 font-semibold text-zb-cream hover:bg-zb-bone/10"
          >
            Sign out and use customer account
          </Link>
        </div>
      </div>
    );
  }

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

  // Ordering is only available during business hours, and also when the
  // webstore is not manually closed. This screen re-enables itself
  // automatically once the café opens (see the refresh interval above).
  if ((!storeOpen || !webstoreOpen) && !isTestOrder) {
    // Two distinct causes with different messaging: the café is outside its
    // operating hours (storeOpen false → the café itself is closed), or staff
    // manually paused online ordering while the café may still be open for
    // walk-ins (webstoreOpen false). Outside-hours takes precedence since the
    // café is genuinely closed then.
    const onlineOnly = storeOpen && !webstoreOpen;
    const reopen = closedUntil
      ? new Intl.DateTimeFormat("en-PH", {
          weekday: "short",
          hour: "numeric",
          minute: "2-digit",
          timeZone: "Asia/Manila",
        }).format(new Date(closedUntil))
      : null;
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <Clock3 className="mx-auto size-12 text-zb-bone" />
        <h1 className="mt-5 font-display text-5xl">
          {onlineOnly ? "ONLINE ORDERING UNAVAILABLE" : "THE CAFÉ IS CLOSED"}
        </h1>
        {onlineOnly ? (
          <p className="mt-3 text-zb-cream/70">
            {closureLabel ? `${closureLabel}. ` : ""}Online ordering is paused
            right now, but you&apos;re welcome to visit us in person. Your cart
            is saved
            {reopen ? ` — we expect to reopen online around ${reopen}` : ""}.
          </p>
        ) : (
          <>
            <p className="mt-3 text-zb-cream/70">
              Ordering is paused outside our operating hours. Your cart is saved —
              come back when we&apos;re open and check out then.
            </p>
            <dl className="mx-auto mt-7 max-w-xs space-y-2 rounded-2xl border border-zb-sage/30 bg-zb-primary-strong/75 p-5 text-sm">
              {STORE_HOURS_SUMMARY.map((row) => (
                <div key={row.days} className="flex items-center justify-between gap-4">
                  <dt className="font-semibold text-zb-cream">{row.days}</dt>
                  <dd className="font-mono-tabular text-zb-cream/70">{row.hours}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
        <Link href="/menu" className="mt-7 inline-flex h-11 items-center rounded-xl bg-zb-bone px-5 font-semibold text-zb-primary-dark hover:bg-zb-bone-soft">
          Browse the menu
        </Link>
        {operationsRole === "admin" && (
          <button
            type="button"
            onClick={() => setIsTestOrder(true)}
            className="ml-3 mt-7 inline-flex h-11 items-center gap-2 rounded-xl border border-zb-bone/45 px-5 font-semibold text-zb-cream"
          >
            <FlaskConical className="size-4" />
            Create test order
          </button>
        )}
      </div>
    );
  }

  const effectiveIsLoggedIn = operationsRole
    ? isLoggedIn
    : browserLoggedIn ?? isLoggedIn;
  const isTakeOut = mode === "pickup" || mode === "delivery";
  const dineInAvailable = physicalOpen;
  // Cash orders must be tied to an account for tracking and accountability.
  const requiresAccount = !effectiveIsLoggedIn && paymentMethod === "cash";
  const subtotal = getCartSubtotal(lines);
  // Delivery is Maps-only. Fee preview comes from the server-confirmed map
  // pick, or for a saved address that already has coordinates, its stored
  // server-derived tier. place_order always re-derives the charge from coords.
  const savedSelected = savedAddresses.find((a) => a.id === selectedAddressId);
  const savedHasCoords =
    savedSelected != null && savedSelected.lat != null && savedSelected.lng != null;
  const quotedDeliveryFee =
    mode === "delivery"
      ? mapDetails?.feeCents ??
        (savedHasCoords ? getDeliveryFeeCents(savedSelected.tier ?? "") : 0)
      : 0;
  const freeDeliveryEligible =
    mode === "delivery" && qualifiesForFreeDelivery(subtotal);
  const deliveryFee = freeDeliveryEligible ? 0 : quotedDeliveryFee;
  const freeDeliveryRemaining =
    mode === "delivery" ? amountUntilFreeDelivery(subtotal) : 0;
  // Ready when a saved address already has coordinates, or the map pin produced
  // an in-zone quote (mapDetails is set to null on out-of-zone by the picker).
  const deliveryReady =
    mode !== "delivery" || savedHasCoords || mapDetails !== null;
  const total = subtotal + deliveryFee;
  // Treat an expired selection as empty without synchronously mutating state
  // from an effect. The next explicit selection replaces the stale value.
  const validPickupTime =
    pickupTime && pickupSlots.some((slot) => slot.value === pickupTime)
      ? pickupTime
      : null;

  function reviewOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    setReviewed(true);
    setSubmitError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handlePlaceOrder() {
    const form = formRef.current;
    if (!form || !lines || lines.length === 0) return;
    if (!form.reportValidity()) {
      setReviewed(false);
      return;
    }

    const data = new FormData(form);
    const input: PlaceOrderInput = {
      serviceMode: mode,
      customerName: String(data.get("customerName") ?? ""),
      customerPhone: data.get("customerPhone")
        ? String(data.get("customerPhone"))
        : undefined,
      customerEmail: email ?? undefined,
      notes: data.get("notes") ? String(data.get("notes")) : undefined,
      paymentMethod,
      isTestOrder,
      lines,
      pickupTime: mode === "pickup" ? validPickupTime ?? undefined : undefined,
      delivery:
        mode === "delivery" && effectiveIsLoggedIn
          ? (() => {
              const saved = savedAddresses.find((a) => a.id === selectedAddressId);
              // A re-pin (mapDetails) wins; otherwise use the saved address's
              // stored coordinates.
              if (
                saved &&
                saved.lat != null &&
                saved.lng != null &&
                mapDetails === null
              ) {
                return {
                  street: saved.street,
                  barangay: saved.barangay ?? undefined,
                  city: saved.city,
                  landmark: saved.landmark ?? undefined,
                  lat: saved.lat,
                  lng: saved.lng,
                  googlePlaceId: saved.google_place_id ?? undefined,
                  detectedLat: gps?.lat,
                  detectedLng: gps?.lng,
                  detectedAddress: gps?.address ?? undefined,
                };
              }
              if (mapDetails) {
                return {
                  street: mapDetails.street,
                  barangay: mapDetails.barangay ?? undefined,
                  city: mapDetails.city,
                  landmark: data.get("landmark") ? String(data.get("landmark")) : undefined,
                  lat: mapDetails.lat,
                  lng: mapDetails.lng,
                  googlePlaceId: mapDetails.googlePlaceId ?? undefined,
                  detectedLat: gps?.lat,
                  detectedLng: gps?.lng,
                  detectedAddress: gps?.address ?? undefined,
                };
              }
              return undefined;
            })()
          : undefined,
    };

    setSubmitting(true);
    setSubmitError(null);
    try {
      const submissionInput = { ...input };
      if (effectiveIsLoggedIn && !operationsRole) {
        const supabase = createBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          setSubmitError("Please refresh checkout and sign in again.");
          setSubmitting(false);
          return;
        }

        if (session) {
          const expiresAtMs = session.expires_at
            ? session.expires_at * 1000
            : 0;
          if (!expiresAtMs || expiresAtMs - Date.now() < 60_000) {
            const {
              data: { session: refreshedSession },
            } = await supabase.auth.refreshSession();
            if (refreshedSession?.access_token) {
              submissionInput.customerAccessToken =
                refreshedSession.access_token;
            }
          } else if (session.access_token) {
            submissionInput.customerAccessToken = session.access_token;
          }
        }
      }

      const result = await placeOrder(submissionInput);
      if (result && !result.ok) {
        setSubmitError(result.error);
        setSubmitting(false);
      }
      // On success the server action calls redirect() — the browser
      // navigates and this component unmounts, so we don't reach here.
    } catch (err) {
      // Next.js's redirect() throws an internal NEXT_REDIRECT signal
      // that the framework catches at the boundary. Anything else is
      // a real error.
      const digest =
        err && typeof err === "object" && "digest" in err
          ? String((err as { digest?: unknown }).digest)
          : "";
      if (digest.startsWith("NEXT_REDIRECT")) return;
      setSubmitError(err instanceof Error ? err.message : "Failed to place order.");
      setSubmitting(false);
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={reviewOrder}
      onInput={() => {
        setReviewed(false);
        setSubmitError(null);
      }}
      className="grid gap-8 lg:grid-cols-[1fr_23rem]"
    >
      <input type="hidden" name="serviceMode" value={mode} />
      <div className="space-y-7">
        <KitchenClosingBanner />
        {operationsRole === "admin" && (
          <div className="rounded-xl border border-zb-bone/40 bg-zb-bone/10 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={isTestOrder}
                onChange={(event) => {
                  setIsTestOrder(event.target.checked);
                  setReviewed(false);
                }}
                className="mt-1 accent-zb-bone"
              />
              <span>
                <span className="flex items-center gap-2 font-semibold text-zb-bone">
                  <FlaskConical className="size-4" />
                  Test order
                </span>
                <span className="mt-1 block text-xs leading-5 text-zb-cream/65">
                  Labels this order as a test and excludes it from store revenue
                  metrics. Test orders may be submitted outside business hours.
                </span>
              </span>
            </label>
          </div>
        )}
        {effectiveIsLoggedIn ? (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-zb-sage/30 bg-zb-primary-dark/35 px-4 py-3 text-sm">
            <span className="text-zb-cream/70">
              Signed in{email ? <> as <span className="font-medium text-zb-cream">{email}</span></> : ""}.
            </span>
            <Link
              href={
                operationsRole
                  ? "/auth/signout?scope=admin&next=/checkout"
                  : "/auth/signout?next=/checkout"
              }
              className="font-semibold text-zb-bone hover:underline"
            >
              Not you?
            </Link>
          </div>
        ) : requiresAccount ? (
          <div className="rounded-xl border border-zb-bone/40 bg-zb-bone/10 p-5">
            <p className="flex items-center gap-2 font-semibold text-zb-bone">
              <LogIn className="size-4" /> An account is required to pay with cash
            </p>
            <p className="mt-2 text-sm leading-6 text-zb-cream/70">
              So every cash order can be tracked and accounted for, you&apos;ll need
              to sign in or create an account before checking out — this applies to
              dine-in, take out, pickup, and delivery alike.
            </p>
            <Link href="/login?next=/checkout" className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-zb-bone px-5 font-semibold text-zb-primary-dark transition hover:bg-zb-bone-soft">
              Sign in or create an account
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-zb-sage/30 bg-zb-primary-dark/35 px-4 py-3 text-sm">
            <span className="text-zb-cream/70">Checking out as a guest.</span>
            <Link href="/login?next=/checkout" className="font-semibold text-zb-bone hover:underline">
              Sign in to save your details &amp; order history
            </Link>
          </div>
        )}
        <section className="rounded-2xl border border-zb-sage/25 bg-zb-primary-strong/75 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-zb-bone font-mono text-sm font-bold text-zb-primary-dark">1</span>
            <div>
              <h2 className="font-display text-3xl">SERVICE MODE</h2>
              <p className="text-sm text-zb-cream/60">How are you getting your order?</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {topModes
              .filter((entry) => dineInAvailable || entry.value !== "dine_in")
              .map((entry) => {
                const Icon = entry.icon;
                const selected =
                  entry.value === "take_out" ? isTakeOut : mode === entry.value;
                return (
                  <button
                    key={entry.value}
                    type="button"
                    onClick={() => {
                      // "Take Out" defaults to pickup; the sub-options below
                      // let the customer switch to delivery.
                      setMode(entry.value === "take_out" ? "pickup" : "dine_in");
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

          {!dineInAvailable && (
            <p className="mt-3 rounded-xl border border-zb-bone/30 bg-zb-bone/10 px-3 py-2 text-xs leading-5 text-zb-cream/75">
              {physicalLabel ? `${physicalLabel}. ` : ""}Dine-in is unavailable
              while our cafe is closed. Pickup and delivery are still open.
            </p>
          )}

          {isTakeOut && (
            <div className="mt-3 rounded-2xl border border-zb-sage/20 bg-zb-primary-dark/25 p-3 sm:p-4">
              <p className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-zb-cream/45">
                How should we get it to you?
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {takeOutModes
                  .filter((entry) => mapsEnabled || entry.value !== "delivery")
                  .map((entry) => {
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
              {!mapsEnabled && (
                <p className="mt-3 px-1 text-xs leading-5 text-zb-cream/55">
                  Delivery is temporarily unavailable - please choose Pickup.
                </p>
              )}
            </div>
          )}
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
              <input name="customerName" required autoComplete="name" defaultValue={profile.display_name ?? ""} className={inputClass} placeholder="Your name" />
            </label>
            {mode !== "dine_in" && (
              <label className="text-sm font-medium">
                Mobile number
                <input name="customerPhone" required inputMode="tel" autoComplete="tel" defaultValue={profile.phone ?? ""} pattern="(?:\+63|0)9\d{9}" title="Use a Philippine mobile number such as 09186056360" className={inputClass} placeholder="09XX XXX XXXX" />
              </label>
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
                    value={validPickupTime}
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
                                className={`grid min-h-11 cursor-default grid-cols-[1fr_auto] items-center rounded-xl px-3 font-mono-tabular text-sm outline-none transition ${
                                  slot.special
                                    ? "font-bold text-emerald-300 data-[highlighted]:bg-emerald-500/25 data-[highlighted]:text-emerald-200 data-[selected]:bg-emerald-500 data-[selected]:text-zb-primary-dark"
                                    : "text-zb-cream/75 data-[highlighted]:bg-zb-sage/25 data-[highlighted]:text-zb-cream data-[selected]:bg-zb-bone data-[selected]:font-bold data-[selected]:text-zb-primary-dark"
                                }`}
                              >
                                <Select.ItemText>
                                  {slot.special ? `${slot.label} 🌿` : slot.label}
                                </Select.ItemText>
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

            {mode === "delivery" && !effectiveIsLoggedIn && !requiresAccount && (
              <div className="sm:col-span-2 rounded-2xl border border-zb-bone/40 bg-zb-bone/10 p-5">
                <p className="flex items-center gap-2 font-semibold text-zb-bone">
                  <LogIn className="size-4" /> Delivery needs an account
                </p>
                <p className="mt-2 text-sm leading-6 text-zb-cream/70">
                  For safety and accountability, delivery orders require a signed-in
                  customer.
                </p>
                <Link href="/login?next=/checkout" className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-zb-bone px-5 font-semibold text-zb-primary-dark transition hover:bg-zb-bone-soft">
                  Sign in to continue
                </Link>
              </div>
            )}
            {mode === "delivery" && effectiveIsLoggedIn && (
              <>
                {savedAddresses.length > 0 && (
                  <fieldset className="sm:col-span-2">
                    <legend className="text-sm font-medium">Saved addresses</legend>
                    <div className="mt-3 grid gap-2">
                      {savedAddresses.map((a) => (
                        <label key={a.id} className="cursor-pointer">
                          <input
                            type="radio"
                            name="savedAddress"
                            value={a.id}
                            checked={selectedAddressId === a.id}
                            onChange={() => {
                              setSelectedAddressId(a.id);
                              setMapDetails(null);
                            }}
                            className="peer sr-only"
                          />
                          <span className="block rounded-xl border border-zb-sage/30 bg-zb-primary-dark/35 px-4 py-3 text-sm transition hover:border-zb-sage peer-checked:border-zb-bone peer-checked:bg-zb-bone/10 peer-focus-visible:ring-2 peer-focus-visible:ring-zb-bone">
                            <span className="font-semibold">{a.label || "Address"}</span>
                            <span className="ml-2 text-zb-cream/60">{a.street}{a.barangay ? `, ${a.barangay}` : ""}</span>
                            {a.landmark && (
                              <span className="mt-0.5 block text-xs text-zb-cream/45">
                                Landmark: {a.landmark}
                              </span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                    {selectedAddressId && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAddressId("");
                          setMapDetails(null);
                        }}
                        className="mt-3 text-sm font-semibold text-zb-bone hover:underline"
                      >
                        Enter a new address instead
                      </button>
                    )}
                  </fieldset>
                )}
                <div className="sm:col-span-2 space-y-3">
                  {selectedAddressId && !savedHasCoords && (
                    <p className="rounded-xl border border-zb-bone/30 bg-zb-bone/10 px-3 py-2 text-xs leading-5 text-zb-cream/75">
                      This saved address needs a pin - drop it on the map to
                      confirm the delivery fee.
                    </p>
                  )}
                  {selectedAddressId && savedHasCoords && (
                    <p className="px-1 text-xs leading-5 text-zb-cream/55">
                      Showing your saved address on the map. Drag the pin or
                      search to deliver somewhere else.
                    </p>
                  )}
                  <DeliveryMapPicker
                    key={selectedAddressId || "new"}
                    apiKey={mapsApiKey!}
                    storeLat={storeLat}
                    storeLng={storeLng}
                    tiers={deliveryTiers}
                    maxKm={deliveryMaxKm}
                    initialLat={savedHasCoords ? savedSelected!.lat! : undefined}
                    initialLng={savedHasCoords ? savedSelected!.lng! : undefined}
                    onChange={setMapDetails}
                    onGpsDetected={setGps}
                  />
                  <label className="block text-sm font-medium">
                    Landmark / delivery notes
                    <input name="landmark" className={inputClass} placeholder="Near the red gate, unit number, etc." />
                  </label>
                </div>

                {/* Two pieces of location ride along with the order: the
                    delivery address (manual text below / saved / map pin, which
                    drives the fee) and the device's auto-detected GPS reading
                    (captured separately, shown here, used only to help the rider
                    navigate). The manual text never affects pricing. */}
                <div className="sm:col-span-2 space-y-3">
                  {gps && (
                    <div className="rounded-xl border border-zb-sage/30 bg-zb-primary-dark/35 px-4 py-3">
                      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zb-cream/45">
                        <MapPin className="size-3.5 text-zb-bone" /> Auto-detected
                        location
                      </p>
                      <p className="mt-1 text-sm leading-6 text-zb-cream/80">
                        {gps.address ??
                          `${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}`}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-zb-cream/45">
                        Captured from your device and sent with the order to help
                        the rider find you. We still deliver to the address you
                        provide.
                      </p>
                    </div>
                  )}
                </div>
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
              <input type="radio" name="paymentMethod" value="cash" checked={paymentMethod === "cash"} onChange={() => setPaymentMethod("cash")} className="accent-zb-bone" />
              <Banknote className="size-5 text-zb-bone" />
              <span><span className="block font-semibold">Cash</span><span className="text-xs text-zb-cream/55">Pay at the counter or upon delivery</span></span>
            </label>
            {requiresAccount && (
              <p className="flex items-start gap-2 rounded-xl border border-zb-bone/40 bg-zb-bone/10 px-4 py-3 text-xs leading-5 text-zb-cream/75">
                <LogIn className="mt-0.5 size-3.5 shrink-0 text-zb-bone" />
                <span>
                  Cash orders require an account.{" "}
                  <Link href="/login?next=/checkout" className="font-semibold text-zb-bone hover:underline">
                    Sign in or create an account
                  </Link>{" "}
                  to continue.
                </span>
              </p>
            )}
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
        <div className="checkout-order-scroll mt-5 max-h-72 space-y-3 overflow-y-auto pr-3">
          {lines.map((line) => (
            <div key={line.id} className="grid grid-cols-[3.25rem_1fr_auto] items-center gap-3">
              <div className="relative aspect-square overflow-hidden rounded-lg bg-zb-cream/90">
                <Image src={line.image} alt="" fill sizes="52px" className="object-contain p-1" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{line.quantity}x {line.name}</p>
                <p className="truncate text-xs text-zb-cream/45">{line.variationLabel}</p>
                {line.modifiers?.length ? (
                  <p className="truncate text-[11px] text-zb-cream/35">
                    {line.modifiers
                      .map((modifier) => getModifierDisplayName(modifier))
                      .join(", ")}
                  </p>
                ) : null}
                {line.itemNote ? (
                  <p className="truncate text-[11px] italic text-zb-cream/35">
                    “{line.itemNote}”
                  </p>
                ) : null}
              </div>
              <span className="font-mono-tabular text-xs text-zb-cream/75">{formatPeso(line.unitPriceCents * line.quantity)}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 space-y-3 border-t border-zb-sage/25 pt-4 text-sm">
          <div className="flex justify-between text-zb-cream/65"><span>Subtotal</span><span className="font-mono-tabular text-zb-cream">{formatPeso(subtotal)}</span></div>
          <div className="flex justify-between gap-4 text-zb-cream/65">
            <span>Delivery fee</span>
            <span className="text-right font-mono-tabular text-zb-cream">
              {mode === "delivery" && freeDeliveryEligible ? (
                <span className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">
                  Free Delivery
                </span>
              ) : deliveryFee ? (
                formatPeso(deliveryFee)
              ) : (
                "-"
              )}
            </span>
          </div>
          {mode === "delivery" && (
            <p
              className={`rounded-lg border px-3 py-2 text-xs leading-5 ${
                freeDeliveryEligible
                  ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-200"
                  : "border-zb-bone/30 bg-zb-bone/10 text-zb-cream/70"
              }`}
            >
              {freeDeliveryEligible
                ? "Free delivery unlocked for this order."
                : `${formatPeso(freeDeliveryRemaining)} more to unlock free delivery.`}
            </p>
          )}
          <div className="flex justify-between border-t border-zb-sage/25 pt-3 text-base font-bold"><span>Total</span><span className="font-mono-tabular text-zb-bone">{formatPeso(total)}</span></div>
        </div>

        {!reviewed ? (
          <button type="submit" disabled={requiresAccount || !deliveryReady || (mode === "pickup" && pickupSlots.length === 0) || (mode === "delivery" && !effectiveIsLoggedIn)} className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-zb-bone px-4 font-semibold text-zb-primary-dark transition hover:bg-zb-bone-soft disabled:cursor-not-allowed disabled:opacity-45">
            Review order <Check className="size-4" />
          </button>
        ) : (
          <div className="mt-5 rounded-xl border border-zb-bone/45 bg-zb-bone/10 p-4">
            <p className="flex items-center gap-2 font-semibold text-zb-bone"><Check className="size-4" /> Ready for submission</p>
            <p className="mt-2 text-xs leading-5 text-zb-cream/65">
              We&apos;ll send your order to the cafe and give you a tracking code.
              {isTestOrder
                ? " This will be visibly marked as a test order."
                : " Pay in cash at pickup or on delivery."}
            </p>
            {submitError && (
              <p className="mt-3 rounded-lg border border-zb-danger/40 bg-zb-danger/10 px-3 py-2 text-xs text-zb-cream">
                {submitError}
              </p>
            )}
            <button
              type="button"
              onClick={handlePlaceOrder}
              disabled={submitting}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-zb-bone font-semibold text-zb-primary-dark transition hover:bg-zb-bone-soft disabled:cursor-not-allowed disabled:opacity-55"
            >
              {submitting ? "Placing order…" : "Place order"}
            </button>
          </div>
        )}
        <p className="mt-4 flex items-start gap-2 text-[11px] leading-5 text-zb-cream/45"><MapPin className="mt-0.5 size-3.5 shrink-0" /> San Julio Subdivision, Nangka St, Barangay 2, San Carlos City</p>
      </aside>
    </form>
  );
}
