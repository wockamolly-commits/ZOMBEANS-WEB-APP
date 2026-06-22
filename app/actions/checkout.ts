"use server";

import { redirect } from "next/navigation";
import { getTeamProfileForUser } from "@/lib/admin";
import { isStoreOpen } from "@/lib/checkout";
import type { CartLine } from "@/lib/cart";
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
    tier: "tier-2" | "tier-4" | "tier-6";
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

  const isSuperAdmin = operationsProfile?.role === "admin";
  if (operationsProfile?.role === "staff") {
    return {
      ok: false,
      error:
        "Staff accounts cannot place webstore orders. Please use a separate customer account for personal purchases.",
    };
  }

  const isTestOrder = isSuperAdmin && input.isTestOrder === true;
  const supabase = isSuperAdmin ? adminSupabase : await createClient();

  if (!isStoreOpen() && !isTestOrder) {
    return {
      ok: false,
      error:
        "The café is closed right now, so we can't take this order. Please order during our operating hours.",
    };
  }

  if (input.paymentMethod === "cash") {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return {
        ok: false,
        error: "Please sign in or create an account to pay with cash.",
      };
    }
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
            tier: input.delivery.tier,
          }
        : null,
    payment_method: input.paymentMethod,
    lines: input.lines.map((line) => ({
      item_slug: line.itemSlug,
      variation_label: line.variationLabel,
      qty: line.quantity,
      option_ids: (line.modifiers ?? []).map((modifier) => modifier.id),
    })),
  };

  const { data, error } = isSuperAdmin
    ? await supabase.rpc("super_admin_place_order", {
        p_payload: payload,
        p_is_test: isTestOrder,
      })
    : await supabase.rpc("place_order", { p_payload: payload });

  if (error) {
    const message = {
      AUTH_REQUIRED: "Please sign in to place a delivery order.",
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
