import "server-only";

import { createAdminSessionClient } from "@/lib/supabase/admin-session";
import type { RiderNotification } from "@/lib/rider-notification-types";

type SupabaseReadError = {
  code?: string;
  message?: string;
};

function isMissingNotificationsTable(error: SupabaseReadError): boolean {
  return (
    error.code === "PGRST205" ||
    error.message?.includes("public.rider_notifications") === true ||
    error.message?.includes("rider_notifications") === true
  );
}

export async function getRiderNotifications(
  riderProfileId: string,
  limit = 20
): Promise<RiderNotification[]> {
  const supabase = await createAdminSessionClient();
  const { data, error } = await supabase
    .from("rider_notifications")
    .select(
      "id, rider_profile_id, order_id, kind, title, body, metadata, read_at, created_at"
    )
    .eq("rider_profile_id", riderProfileId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingNotificationsTable(error)) return [];
    console.error("[rider] notifications failed:", error.message);
    return [];
  }

  return ((data as RiderNotification[] | null) ?? []).map((notification) => ({
    ...notification,
    metadata: notification.metadata ?? {},
  }));
}

export async function getRiderUnreadNotificationCount(
  riderProfileId: string
): Promise<number> {
  const supabase = await createAdminSessionClient();
  const { count, error } = await supabase
    .from("rider_notifications")
    .select("id", { count: "exact", head: true })
    .eq("rider_profile_id", riderProfileId)
    .is("read_at", null);

  if (error) {
    if (isMissingNotificationsTable(error)) return 0;
    console.error("[rider] unread notification count failed:", error.message);
    return 0;
  }

  return count ?? 0;
}
