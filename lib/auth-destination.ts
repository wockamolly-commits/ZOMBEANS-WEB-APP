import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getTeamProfileForUser,
  isOperationsRole,
  operationsDestination,
} from "@/lib/admin";
import { provisionConfiguredSuperAdmin } from "@/lib/admin-auth";
import {
  isAdminSurfacePath,
  safeNextPath,
  safePublicNextPath,
} from "@/lib/safe-next";

export type AuthFlow = "admin" | "customer";

function riderDestination(raw: string | null | undefined): string {
  const requested = safeNextPath(raw, "/rider");
  return requested === "/rider" || requested.startsWith("/rider/")
    ? requested
    : "/rider";
}

export async function authenticatedDestination(
  supabase: SupabaseClient,
  requested: string,
  flow: AuthFlow
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return requested;

  if (flow === "admin") {
    try {
      await provisionConfiguredSuperAdmin(user);
      const claim = await supabase.rpc("claim_pending_staff_invitation");
      if (claim.error) {
        console.error("[auth] invitation claim failed:", claim.error.message);
      }
    } catch (error) {
      console.error("[auth] admin activation failed:", error);
    }

    const profile = await getTeamProfileForUser(supabase, user.id);
    if (profile?.role === "rider") {
      return riderDestination(requested);
    }
    if (profile && isOperationsRole(profile.role)) {
      return operationsDestination(requested);
    }
    await supabase.auth.signOut();
    return "/login?error=not_authorized";
  }

  return isAdminSurfacePath(requested) ? "/account" : requested;
}

export function requestedDestination(
  flow: AuthFlow,
  next: string | string[] | null | undefined
) {
  return flow === "admin" ? safeNextPath(next) : safePublicNextPath(next);
}
