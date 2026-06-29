import { LogOut } from "lucide-react";

export function AdminSignOut({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <a
        href="/auth/signout?scope=admin"
        className="inline-flex size-10 items-center justify-center rounded-lg border border-zb-sage/25 bg-zb-primary-strong/45 text-zb-cream/70 transition hover:border-zb-bone/45 hover:bg-zb-primary hover:text-zb-bone focus-visible:border-zb-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zb-bone/35"
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut className="size-4" aria-hidden />
      </a>
    );
  }

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
