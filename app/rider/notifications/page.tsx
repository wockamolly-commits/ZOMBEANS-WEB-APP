import Link from "next/link";
import { ArrowLeft, Bell } from "lucide-react";
import { RiderNotificationsInbox } from "@/components/rider/RiderNotifications";
import { requireRider } from "@/lib/rider";
import {
  getRiderNotifications,
  getRiderUnreadNotificationCount,
} from "@/lib/rider-notifications";

export const dynamic = "force-dynamic";

export default async function RiderNotificationsPage() {
  const { profile } = await requireRider("/rider/notifications");
  const [notifications, unreadCount] = await Promise.all([
    getRiderNotifications(profile.id, 100),
    getRiderUnreadNotificationCount(profile.id),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/rider"
          className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-zb-cream/60 transition hover:text-zb-bone"
        >
          <ArrowLeft className="size-4" />
          Back to deliveries
        </Link>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zb-bone">
              <Bell className="size-4" />
              Rider updates
            </p>
            <h1 className="mt-2 font-display text-3xl leading-none text-zb-cream">
              NOTIFICATIONS
            </h1>
          </div>
          <div className="rounded-lg border border-zb-sage/20 bg-zb-primary-strong/60 px-3 py-2 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zb-cream/45">
              Unread
            </p>
            <p className="mt-0.5 font-mono-tabular text-xl font-bold text-zb-cream">
              {unreadCount}
            </p>
          </div>
        </div>
      </div>

      <RiderNotificationsInbox
        riderProfileId={profile.id}
        initialNotifications={notifications}
        initialUnreadCount={unreadCount}
      />
    </div>
  );
}
