"use server";

import { redirect } from "next/navigation";
import { getTeamProfileForUser } from "@/lib/admin";
import { isStoreOpen } from "@/lib/checkout";
import { normalizeQuantity, type CartLine } from "@/lib/cart";
import { createAdminSessionClient } from "@/lib/supabase/admin-session";
import { createClient } from "@/lib/supabase/server";

export type PlaceOrderInput = {
  serviceMode: "dine_in" | "take_out" | "pickup" | "delivery";
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  notes?: string;
  pickupTime?: string;
  delivery?: {
    street: string;
    barangay?: string;
    city?: string;
    landmark?: string;
    deliveryNotes?: string;
    lat: number;
    lng: number;
    googlePlaceId?: string;
    // Device GPS reading captured at checkout, independent of the address above.
    detectedLat?: number;
    detectedLng?: number;
    detectedAddress?: string;
  };
  paymentMethod: "cash" | "gcash" | "maya" | "card";
  isTestOrder?: boolean;
  lines: CartLine[];
};

export type PlaceOrderResult =
  | { ok: false; error: string }
  | { ok: true; shortCode: string };

export async function placeOrder(
  input: PlaceOrderInput
): Promise<PlaceOrderResult> {
  const adminSupabase = await createAdminSessionClient();
  const {
    data: { user: adminUser },
  } = await adminSupabase.auth.getUser();
  const operationsProfile = adminUser
    ? await getTeamProfileForUser(adminSupabase, adminUser.id)
    : null;

  const customerSupabase = await createClient();
  const {
    data: { user: customerUser },
    error: customerUserError,
  } = await customerSupabase.auth.getUser();

  const isSuperAdmin = operationsProfile?.role === "admin";
  const useSuperAdminCheckout = !customerUser && isSuperAdmin;
  if (!customerUser && operationsProfile?.role === "staff") {
    return {
      ok: false,
      error:
        "Staff accounts cannot place webstore orders. Please use a separate customer account for personal purchases.",
    };
  }

  const isTestOrder = useSuperAdminCheckout && input.isTestOrder === true;
  const supabase = useSuperAdminCheckout ? adminSupabase : customerSupabase;

  if (!isStoreOpen() && !isTestOrder) {
    return {
      ok: false,
      error:
        "The café is closed right now, so we can't take this order. Please order during our operating hours.",
    };
  }

  if (input.paymentMethod === "cash" && !customerUser && !useSuperAdminCheckout) {
    return {
      ok: false,
      error: customerUserError
        ? "We could not verify your sign-in session. Please refresh checkout and try again."
        : "Please sign in or create an account to pay with cash.",
    };
  }

  const payload = {
    service_mode: input.serviceMode,
    customer_name: input.customerName.trim(),
    customer_phone: input.customerPhone?.trim() || null,
    customer_email: input.customerEmail?.trim() || null,
    notes:
      [
        input.notes?.trim(),
        ...input.lines.flatMap((line) =>
          line.itemNote?.trim()
            ? [`${line.quantity}x ${line.name}: ${line.itemNote.trim()}`]
            : []
        ),
      ]
        .filter(Boolean)
        .join("\n") || null,
    pickup_time: input.serviceMode === "pickup" ? input.pickupTime : null,
    delivery:
      input.serviceMode === "delivery" && input.delivery
        ? {
            street: input.delivery.street,
            barangay: input.delivery.barangay,
            city: input.delivery.city ?? "San Carlos City",
            landmark: input.delivery.landmark,
            delivery_notes: input.delivery.deliveryNotes,
            lat: input.delivery.lat,
            lng: input.delivery.lng,
            google_place_id: input.delivery.googlePlaceId,
            detected_lat: input.delivery.detectedLat,
            detected_lng: input.delivery.detectedLng,
            detected_address: input.delivery.detectedAddress,
          }
        : null,
    payment_method: input.paymentMethod,
    lines: input.lines.map((line) => ({
      item_slug: line.itemSlug,
      variation_label: line.variationLabel,
      qty: line.quantity,
      options: (line.modifiers ?? []).map((modifier) => ({
        option_id: modifier.id,
        qty: allowsModifierQuantity(modifier.name)
          ? normalizeQuantity(modifier.quantity)
          : 1,
      })),
    })),
  };

  const { data, error } = useSuperAdminCheckout
    ? await supabase.rpc("super_admin_place_order", {
        p_payload: payload,
        p_is_test: isTestOrder,
      })
    : await supabase.rpc("place_order", { p_payload: payload });

  if (error) {
    const inactiveMatch = error.message.match(/^ITEM_INACTIVE:(.+)$/);
    const message = inactiveMatch
      ? `${inactiveMatch[1]} is unavailable right now. Please remove it from your cart or choose another item.`
      : {
          AUTH_REQUIRED: "Please sign in to place a delivery order.",
          OUT_OF_ZONE:
            "That address is outside our 6 km delivery zone. Please switch to pickup - your cart is saved.",
          MISSING_DELIVERY_LOCATION:
            "Please pick your delivery location on the map so we can confirm the fee.",
          STAFF_ORDERING_FORBIDDEN:
            "Staff accounts cannot place webstore orders. Please use a separate customer account for personal purchases.",
          SUPER_ADMIN_REQUIRED:
            "Only the Super Admin can place an order from an operations account.",
        }[error.message] ?? error.message;
    return { ok: false, error: message };
  }

  const shortCode = (data as { short_code?: string } | null)?.short_code;
  if (!shortCode) {
    return { ok: false, error: "Order placed but no short code returned." };
  }

  redirect(`/order/${shortCode}?fresh=1`);
}

function allowsModifierQuantity(name: string) {
  return name.trim().toLowerCase() === "espresso";
}

export type DeliveryQuoteResult =
  | {
      ok: true;
      inZone: boolean;
      distanceKm: number;
      tier: string | null;
      feeCents: number | null;
    }
  | { ok: false; error: string };

export async function quoteDelivery(input: {
  lat: number;
  lng: number;
}): Promise<DeliveryQuoteResult> {
  if (
    typeof input.lat !== "number" ||
    typeof input.lng !== "number" ||
    Number.isNaN(input.lat) ||
    Number.isNaN(input.lng)
  ) {
    return { ok: false, error: "Invalid location." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delivery_quote", {
    p_lat: input.lat,
    p_lng: input.lng,
  });
  if (error || !data || !data[0]) {
    return { ok: false, error: "Could not calculate the delivery fee." };
  }

  const row = data[0] as {
    in_zone: boolean;
    distance_km: number;
    tier: string | null;
    fee_cents: number | null;
  };
  return {
    ok: true,
    inZone: row.in_zone,
    distanceKm: Number(row.distance_km),
    tier: row.tier,
    feeCents: row.fee_cents === null ? null : Number(row.fee_cents),
  };
}
