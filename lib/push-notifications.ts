import "server-only";

import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
  // Android buzz pattern for the OS-shown notification (ignored on iOS).
  vibrate?: number[];
  // Keep the notification on screen until the user acts (high-priority alerts).
  requireInteraction?: boolean;
  // Re-alert when a same-tag notification is already showing. Defaults to true
  // in the service worker when a tag is present; set false to suppress.
  renotify?: boolean;
};

type SubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
};

let vapidConfigured = false;

function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    console.error("[push] VAPID env vars are not configured; skipping send.");
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

async function sendToSubscription(
  supabase: ReturnType<typeof createAdminClient>,
  sub: SubscriptionRow,
  payload: PushPayload
) {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth_key },
      },
      JSON.stringify(payload)
    );
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) {
      await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      return;
    }
    console.error("[push] send failed:", error);
  }
}

// Fire-and-forget: failures are logged/cleaned up internally and never
// propagate, so a push provider hiccup can never delay or break the order
// mutation it's attached to.
export function sendPushToOrder(orderCode: string, payload: PushPayload): void {
  if (!ensureVapid()) return;
  void (async () => {
    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth_key")
        .eq("role", "customer")
        .eq("order_code", orderCode.trim().toUpperCase());
      if (error || !data) return;
      await Promise.all(
        (data as SubscriptionRow[]).map((sub) =>
          sendToSubscription(supabase, sub, payload)
        )
      );
    } catch (error) {
      console.error("[push] sendPushToOrder unexpected failure:", error);
    }
  })();
}

export function sendPushToUser(userId: string, payload: PushPayload): void {
  if (!ensureVapid()) return;
  void (async () => {
    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth_key")
        .eq("role", "rider")
        .eq("user_id", userId);
      if (error || !data) return;
      await Promise.all(
        (data as SubscriptionRow[]).map((sub) =>
          sendToSubscription(supabase, sub, payload)
        )
      );
    } catch (error) {
      console.error("[push] sendPushToUser unexpected failure:", error);
    }
  })();
}
