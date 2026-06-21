"use server";

import { revalidatePath } from "next/cache";
import { getStaffProfile } from "@/lib/admin";
import { createAdminSessionClient } from "@/lib/supabase/admin-session";

export type OrderStatus =
  | "pending"
  | "accepted"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "completed"
  | "rejected"
  | "cancelled";

export type ActionResult = { ok: true } | { ok: false; error: string };

function friendly(message: string | undefined): string {
  if (!message) return "Something went wrong. Try again.";
  if (message.includes("INVALID_TRANSITION"))
    return "That status change isn't allowed from the current state.";
  if (message.includes("DELIVERY_NEEDS_OFD"))
    return "Mark delivery orders 'Out for delivery' before completing.";
  if (message.includes("OFD_DELIVERY_ONLY"))
    return "Only delivery orders go out for delivery.";
  if (message.includes("FORBIDDEN")) return "You don't have access to do that.";
  if (message.includes("ONLINE_PAYMENT_WEBHOOK_REQUIRED"))
    return "Online payments can only be confirmed by the payment provider.";
  if (message.includes("ORDER_NOT_FOUND")) return "Order not found.";
  if (message.includes("PAYMENT_NOT_FOUND")) return "No payment to record.";
  if (message.includes("PAYMENT_REQUIRED"))
    return "Wait for the online payment confirmation before completing this order.";
  if (message.includes("DELIVERY_ONLY"))
    return "Riders can only be assigned to delivery orders.";
  if (message.includes("ASSIGNMENT_LOCKED"))
    return "Rider assignment is locked for this order status.";
  if (message.includes("RIDER_UNAVAILABLE"))
    return "That rider is inactive or unavailable.";
  if (message.includes("NO_RIDER_ASSIGNED"))
    return "Assign a rider before marking the order out for delivery.";
  return "Something went wrong. Try again.";
}

export async function setOrderStatus(
  orderId: string,
  to: OrderStatus,
  reason?: string
): Promise<ActionResult> {
  const profile = await getStaffProfile();
  if (!profile) return { ok: false, error: "You don't have access to do that." };

  const supabase = await createAdminSessionClient();
  const { error } = await supabase.rpc("staff_set_order_status", {
    p_order_id: orderId,
    p_to: to,
    p_reason: reason ?? null,
  });
  if (error) {
    console.error("[admin] setOrderStatus failed:", error);
    return { ok: false, error: friendly(error.message) };
  }

  revalidatePath("/workspace/orders");
  revalidatePath("/workspace");
  return { ok: true };
}

export async function recordPayment(
  orderId: string,
  reference?: string
): Promise<ActionResult> {
  const profile = await getStaffProfile();
  if (!profile) return { ok: false, error: "You don't have access to do that." };

  const supabase = await createAdminSessionClient();
  const { error } = await supabase.rpc("staff_record_payment", {
    p_order_id: orderId,
    p_reference: reference ?? null,
  });
  if (error) {
    console.error("[admin] recordPayment failed:", error);
    return { ok: false, error: friendly(error.message) };
  }

  revalidatePath("/workspace/orders");
  revalidatePath("/workspace");
  return { ok: true };
}

export async function assignRider(
  orderId: string,
  riderProfileId: string | null
): Promise<ActionResult> {
  const profile = await getStaffProfile();
  if (!profile) return { ok: false, error: "You don't have access to do that." };

  const supabase = await createAdminSessionClient();
  const { error } = await supabase.rpc("staff_assign_rider", {
    p_order_id: orderId,
    p_rider_profile_id: riderProfileId,
  });
  if (error) {
    console.error("[admin] assignRider failed:", error);
    return { ok: false, error: friendly(error.message) };
  }

  revalidatePath("/workspace/orders");
  return { ok: true };
}

export async function advanceOrder(orderId: string): Promise<ActionResult> {
  const profile = await getStaffProfile();
  if (!profile) return { ok: false, error: "You don't have access to do that." };

  const supabase = await createAdminSessionClient();
  const { error } = await supabase.rpc("cashier_advance_order", {
    p_order_id: orderId,
  });
  if (error) {
    console.error("[admin] advanceOrder failed:", error);
    return { ok: false, error: friendly(error.message) };
  }

  revalidatePath("/workspace/orders");
  revalidatePath("/workspace");
  return { ok: true };
}
