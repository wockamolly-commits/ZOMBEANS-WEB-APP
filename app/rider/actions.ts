"use server";

import { revalidatePath } from "next/cache";
import { requireRider } from "@/lib/rider";
import {
  broadcastCustomerOrderStatus,
  broadcastRiderOutside,
} from "@/lib/customer-order-broadcasts";
import { createAdminSessionClient } from "@/lib/supabase/admin-session";

export type RiderActionResult = { ok: true } | { ok: false; error: string };

function friendly(message: string | undefined): string {
  if (!message) return "Something went wrong. Try again.";
  if (message.includes("ORDER_NOT_ASSIGNED")) {
    return "That delivery is not assigned to you.";
  }
  if (message.includes("INVALID_TRANSITION")) {
    return "That delivery is not ready for this update.";
  }
  if (message.includes("PAYMENT_REQUIRED")) {
    return "Payment has to be confirmed before delivery can be completed.";
  }
  if (message.includes("FORBIDDEN")) {
    return "Your rider access is not active.";
  }
  if (message.includes("CUSTOMER_RING_FAILED")) {
    return "Could not ring the customer. Check your connection and try again.";
  }
  return "Something went wrong. Try again.";
}

export async function markPickedUp(
  orderId: string
): Promise<RiderActionResult> {
  await requireRider(`/rider/delivery/${orderId}`);
  const supabase = await createAdminSessionClient();
  const { error } = await supabase.rpc("rider_mark_picked_up", {
    p_order_id: orderId,
  });
  if (error) {
    console.error("[rider] markPickedUp failed:", error);
    return { ok: false, error: friendly(error.message) };
  }

  await broadcastCustomerOrderStatus(orderId);
  revalidatePath("/rider");
  revalidatePath("/rider/history");
  revalidatePath(`/rider/delivery/${orderId}`);
  return { ok: true };
}

/**
 * Marks the delivery as "rider outside": stamps rider_assignments.arrived_at
 * (so the customer tracking timeline persists the step across refreshes) and
 * broadcasts an instant alert. The order itself stays out_for_delivery.
 */
export async function notifyRiderOutside(
  orderId: string
): Promise<RiderActionResult> {
  await requireRider(`/rider/delivery/${orderId}`);
  const supabase = await createAdminSessionClient();
  const { error } = await supabase.rpc("rider_mark_arrived", {
    p_order_id: orderId,
  });
  if (error) {
    console.error("[rider] notifyRiderOutside failed:", error);
    return { ok: false, error: friendly(error.message) };
  }

  if (!(await broadcastRiderOutside(orderId))) {
    console.error(
      "[rider] notifyRiderOutside broadcast was not acknowledged; customer snapshot fallback will catch up."
    );
  }

  revalidatePath("/rider");
  revalidatePath(`/rider/delivery/${orderId}`);
  return { ok: true };
}

export async function markDelivered(
  orderId: string
): Promise<RiderActionResult> {
  await requireRider(`/rider/delivery/${orderId}`);
  const supabase = await createAdminSessionClient();
  const { error } = await supabase.rpc("rider_mark_delivered", {
    p_order_id: orderId,
  });
  if (error) {
    console.error("[rider] markDelivered failed:", error);
    return { ok: false, error: friendly(error.message) };
  }

  await broadcastCustomerOrderStatus(orderId);
  revalidatePath("/rider");
  revalidatePath("/rider/history");
  revalidatePath(`/rider/delivery/${orderId}`);
  return { ok: true };
}
