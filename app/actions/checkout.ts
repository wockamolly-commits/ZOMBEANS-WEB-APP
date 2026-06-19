"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CartLine } from "@/lib/cart";

export type PlaceOrderInput = {
  serviceMode: "dine_in" | "take_out" | "pickup" | "delivery";
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  notes?: string;

  // pickup only
  pickupTime?: string; // ISO

  // delivery only
  delivery?: {
    street: string;
    barangay?: string;
    city?: string;
    landmark?: string;
    deliveryNotes?: string;
    tier: "tier-2" | "tier-4" | "tier-6";
  };

  paymentMethod: "cash" | "gcash" | "maya" | "card";

  lines: CartLine[];
};

export type PlaceOrderResult =
  | { ok: false; error: string }
  | { ok: true; shortCode: string };

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const supabase = await createClient();

  // Cash orders must be tied to an account for tracking and accountability,
  // across every service mode. Enforce it here so a guest can't bypass the
  // client-side gate by calling the action directly.
  if (input.paymentMethod === "cash") {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: "Please sign in or create an account to pay with cash." };
    }
  }

  const payload = {
    service_mode: input.serviceMode,
    customer_name: input.customerName.trim(),
    customer_phone: input.customerPhone?.trim() || null,
    customer_email: input.customerEmail?.trim() || null,
    notes: input.notes?.trim() || null,
    pickup_time: input.serviceMode === "pickup" ? input.pickupTime : null,
    delivery:
      input.serviceMode === "delivery" && input.delivery
        ? {
            street: input.delivery.street,
            barangay: input.delivery.barangay,
            city: input.delivery.city ?? "San Carlos City",
            landmark: input.delivery.landmark,
            delivery_notes: input.delivery.deliveryNotes,
            tier: input.delivery.tier,
          }
        : null,
    payment_method: input.paymentMethod,
    lines: input.lines.map((line) => ({
      item_slug: line.itemSlug,
      variation_label: line.variationLabel,
      qty: line.quantity,
    })),
  };

  const { data, error } = await supabase.rpc("place_order", {
    p_payload: payload,
  });

  if (error) {
    const message =
      error.message === "AUTH_REQUIRED"
        ? "Please sign in to place a delivery order."
        : error.message;
    return { ok: false, error: message };
  }
  const shortCode = (data as { short_code?: string } | null)?.short_code;
  if (!shortCode) {
    return { ok: false, error: "Order placed but no short code returned." };
  }

  redirect(`/order/${shortCode}?fresh=1`);
}
