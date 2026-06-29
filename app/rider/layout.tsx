import Link from "next/link";
import { Bike, ExternalLink, History, UserRound } from "lucide-react";
import { AdminSignOut } from "@/components/admin/AdminSignOut";
import { RiderLiveUpdater } from "@/components/rider/RiderLiveUpdater";
import { RiderNotificationBell } from "@/components/rider/RiderNotifications";
import { Logo } from "@/components/shared/Logo";
import { requireRider } from "@/lib/rider";
import {
  getRiderNotifications,
  getRiderUnreadNotificationCount,
} from "@/lib/rider-notifications";

export const dynamic = "force-dynamic";

export default async function RiderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireRider();
  const [notifications, unreadCount] = await Promise.all([
    getRiderNotifications(profile.id, 12),
    getRiderUnreadNotificationCount(profile.id),
  ]);

  return (
    <div className="min-h-dvh bg-zb-primary text-zb-cream">
      <header className="sticky top-0 z-40 border-b border-zb-sage/25 bg-zb-primary-strong/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4">
          <Logo href="/rider" />
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/rider"
              className="hidden items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-zb-cream/75 transition hover:bg-zb-primary md:inline-flex"
            >
              <Bike className="size-4 text-zb-bone" />
              Deliveries
            </Link>
            <Link
              href="/rider/history"
              className="hidden items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-zb-cream/75 transition hover:bg-zb-primary md:inline-flex"
            >
              <History className="size-4 text-zb-bone" />
              History
            </Link>
            <Link
              href="/rider/profile"
              className="hidden items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-zb-cream/75 transition hover:bg-zb-primary md:inline-flex"
            >
              <UserRound className="size-4 text-zb-bone" />
              Profile
            </Link>
            <div className="flex items-center gap-1.5 rounded-xl border border-zb-sage/20 bg-zb-primary/30 p-1 shadow-sm shadow-black/10">
              <RiderNotificationBell
                riderProfileId={profile.id}
                initialNotifications={notifications}
                initialUnreadCount={unreadCount}
              />
              <Link
                href="/rider/profile"
                className="inline-flex size-10 items-center justify-center rounded-lg border border-zb-sage/25 bg-zb-primary-strong/45 text-zb-cream/70 transition hover:border-zb-bone/45 hover:bg-zb-primary hover:text-zb-bone focus-visible:border-zb-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zb-bone/35 md:hidden"
                aria-label="Open rider profile"
                title="Profile"
              >
                <UserRound className="size-4" />
              </Link>
              <Link
                href="/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex size-10 items-center justify-center rounded-lg border border-zb-sage/25 bg-zb-primary-strong/45 text-zb-cream/70 transition hover:border-zb-bone/45 hover:bg-zb-primary hover:text-zb-bone focus-visible:border-zb-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zb-bone/35"
                aria-label="Open storefront"
                title="Open storefront"
              >
                <ExternalLink className="size-4" />
              </Link>
              <AdminSignOut compact />
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>
      <RiderLiveUpdater riderProfileId={profile.id} />
      <div className="sr-only">Signed in as {profile.display_name}</div>
    </div>
  );
}
