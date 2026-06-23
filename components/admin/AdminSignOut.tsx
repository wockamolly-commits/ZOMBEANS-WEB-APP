import { LogOut } from "lucide-react";

export function AdminSignOut() {
  return (
    <a
      href="/auth/signout?scope=admin"
      className="inline-flex items-center gap-1.5 rounded-md border border-zb-sage/30 px-3 py-1.5 text-sm font-medium text-zb-cream/80 transition hover:bg-zb-primary-strong hover:text-zb-cream"
    >
      <LogOut className="size-4" aria-hidden />
      <span className="hidden sm:inline">Sign out</span>
    </a>
  );
}
