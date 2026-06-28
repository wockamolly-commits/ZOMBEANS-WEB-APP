import Link from "next/link";
import { Bike, ExternalLink, History, UserRound } from "lucide-react";
import { AdminSignOut } from "@/components/admin/AdminSignOut";
import { Logo } from "@/components/shared/Logo";
import { requireRider } from "@/lib/rider";

export const dynamic = "force-dynamic";

export default async function RiderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireRider();

  return (
    <div className="min-h-dvh bg-zb-primary text-zb-cream">
      <header className="sticky top-0 z-40 border-b border-zb-sage/25 bg-zb-primary-strong/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4">
          <Logo href="/rider" />
          <div className="flex items-center gap-2">
            <Link
              href="/rider"
              className="hidden items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-zb-cream/75 transition hover:bg-zb-primary sm:inline-flex"
            >
              <Bike className="size-4 text-zb-bone" />
              Deliveries
            </Link>
            <Link
              href="/rider/history"
              className="hidden items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-zb-cream/75 transition hover:bg-zb-primary sm:inline-flex"
            >
              <History className="size-4 text-zb-bone" />
              History
            </Link>
            <Link
              href="/rider/profile"
              className="hidden items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-zb-cream/75 transition hover:bg-zb-primary sm:inline-flex"
            >
              <UserRound className="size-4 text-zb-bone" />
              Profile
            </Link>
            <Link
              href="/rider/profile"
              className="inline-flex size-9 items-center justify-center rounded-md border border-zb-sage/30 text-zb-cream/75 transition hover:bg-zb-primary sm:hidden"
              aria-label="Open rider profile"
            >
              <UserRound className="size-4" />
            </Link>
            <Link
              href="/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex size-9 items-center justify-center rounded-md border border-zb-sage/30 text-zb-cream/75 transition hover:bg-zb-primary"
              aria-label="Open storefront"
            >
              <ExternalLink className="size-4" />
            </Link>
            <AdminSignOut />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>
      <div className="sr-only">Signed in as {profile.display_name}</div>
    </div>
  );
}
