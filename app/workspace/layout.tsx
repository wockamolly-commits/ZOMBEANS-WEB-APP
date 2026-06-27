import Link from "next/link";
import {
  ClipboardList,
  ExternalLink,
  LayoutDashboard,
  MenuSquare,
  UserRound,
  UsersRound,
} from "lucide-react";
import { AdminSignOut } from "@/components/admin/AdminSignOut";
import { Logo } from "@/components/shared/Logo";
import { hasStaffPermission, requireStaff } from "@/lib/admin";
import { STAFF_ROLES } from "@/lib/staff-roles";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/workspace", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workspace/orders", label: "Orders", icon: ClipboardList },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireStaff();
  const nav = [
    ...(hasStaffPermission(profile, "dashboard:view") ? [NAV[0]] : []),
    ...(hasStaffPermission(profile, "orders:view") ? [NAV[1]] : []),
    ...(hasStaffPermission(profile, "menu:view")
      ? [{ href: "/workspace/menu", label: "Menu", icon: MenuSquare }]
      : []),
    ...(hasStaffPermission(profile, "team:manage")
      ? [{ href: "/workspace/team", label: "Team", icon: UsersRound }]
      : []),
    { href: "/workspace/account", label: "Account", icon: UserRound },
  ];
  const roleLabel =
    profile.role === "admin"
      ? "Super Admin"
      : profile.staff_role
        ? STAFF_ROLES[profile.staff_role].label
        : "Staff";

  return (
    <div className="min-h-dvh bg-zb-primary text-zb-cream">
      <header className="sticky top-0 z-40 border-b border-zb-sage/25 bg-zb-primary-strong/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Logo href="/workspace" />
            <span className="hidden rounded-full border border-zb-bone/40 bg-zb-bone/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-zb-bone sm:inline">
              {roleLabel}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/workspace/account"
              className="hidden text-zb-cream/65 transition hover:text-zb-cream sm:inline"
            >
              {profile.display_name}
              <span className="ml-1 text-zb-cream/40">
                ({roleLabel.toLowerCase()})
              </span>
            </Link>
            <AdminSignOut />
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl items-center gap-1 px-4 pb-2 sm:px-6 lg:px-8">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-zb-cream/80 transition hover:bg-zb-primary hover:text-zb-cream"
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
          <Link
            href="/"
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-zb-cream/80 transition hover:bg-zb-primary hover:text-zb-cream"
          >
            <ExternalLink className="size-4" />
            View Store
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
