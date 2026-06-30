import Link from "next/link";
import { CircleUserRound } from "lucide-react";
import { getStaffProfile } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { resolveAuthNavState } from "@/lib/auth-nav";
import { getRiderProfile } from "@/lib/rider";

export async function AuthNav() {
  const operationsProfile = await getStaffProfile();
  const riderProfile = operationsProfile ? null : await getRiderProfile();
  const user = operationsProfile || riderProfile ? null : await getCurrentUser();
  const state = resolveAuthNavState({
    operationsProfile,
    riderProfile,
    hasCustomerUser: Boolean(user),
  });

  return (
    <Link
      href={state.href}
      aria-label={state.ariaLabel}
      className="inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-zb-cream/85 transition hover:bg-zb-primary-strong hover:text-zb-cream"
    >
      <CircleUserRound className="size-4" aria-hidden />
      <span className="hidden sm:inline">{state.label}</span>
    </Link>
  );
}
