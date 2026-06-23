import Link from "next/link";
import { CircleUserRound } from "lucide-react";
import { getStaffProfile } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";

export async function AuthNav() {
  const operationsProfile = await getStaffProfile();
  if (operationsProfile) {
    const label = "Dashboard";
    return (
      <Link
        href="/workspace"
        aria-label={`${label}: ${operationsProfile.display_name}`}
        className="inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-zb-cream/85 transition hover:bg-zb-primary-strong hover:text-zb-cream"
      >
        <CircleUserRound className="size-4" aria-hidden />
        <span className="hidden sm:inline">{label}</span>
      </Link>
    );
  }

  const user = await getCurrentUser();
  const href = user ? "/account" : "/login";
  const label = user ? "Account" : "Sign in";
  return (
    <Link
      href={href}
      aria-label={label}
      className="inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-zb-cream/85 transition hover:bg-zb-primary-strong hover:text-zb-cream"
    >
      <CircleUserRound className="size-4" aria-hidden />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
