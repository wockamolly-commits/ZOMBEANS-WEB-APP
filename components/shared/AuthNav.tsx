import Link from "next/link";
import { CircleUserRound } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";

export async function AuthNav() {
  const user = await getCurrentUser();
  const href = user ? "/account" : "/login";
  const label = user ? "Account" : "Sign in";
  return (
    <Link
      href={href}
      className="inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-zb-cream/85 transition hover:bg-zb-primary-strong hover:text-zb-cream"
    >
      <CircleUserRound className="size-4" />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
