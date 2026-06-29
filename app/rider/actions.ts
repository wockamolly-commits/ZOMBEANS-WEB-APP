"use server";

import { revalidatePath } from "next/cache";
import { requireRider } from "@/lib/rider";
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
  return "Something went wrong. Try again.";
}

function notificationsUnavailable(message: string | undefined): boolean {
  return message?.includes("rider_notifications") === true;
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

  revalidatePath("/rider");
  revalidatePath("/rider/history");
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

  revalidatePath("/rider");
  revalidatePath("/rider/history");
  revalidatePath(`/rider/delivery/${orderId}`);
  return { ok: true };
}

export async function setRiderNotificationRead(
  notificationId: string,
  read: boolean
): Promise<RiderActionResult> {
  const { profile } = await requireRider("/rider/notifications");
  const supabase = await createAdminSessionClient();
  const { error } = await supabase
    .from("rider_notifications")
    .update({ read_at: read ? new Date().toISOString() : null })
    .eq("id", notificationId)
    .eq("rider_profile_id", profile.id);

  if (error) {
    if (!notificationsUnavailable(error.message)) {
      console.error("[rider] set notification read failed:", error);
    }
    return {
      ok: false,
      error: notificationsUnavailable(error.message)
        ? "Notifications are not ready yet."
        : "Could not update that notification.",
    };
  }

  revalidatePath("/rider");
  revalidatePath("/rider/notifications");
  return { ok: true };
}

export async function markAllRiderNotificationsRead(): Promise<RiderActionResult> {
  const { profile } = await requireRider("/rider/notifications");
  const supabase = await createAdminSessionClient();
  const { error } = await supabase
    .from("rider_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("rider_profile_id", profile.id)
    .is("read_at", null);

  if (error) {
    if (!notificationsUnavailable(error.message)) {
      console.error("[rider] mark all notifications read failed:", error);
    }
    return {
      ok: false,
      error: notificationsUnavailable(error.message)
        ? "Notifications are not ready yet."
        : "Could not update notifications.",
    };
  }

  revalidatePath("/rider");
  revalidatePath("/rider/notifications");
  return { ok: true };
}
