import { type NextRequest, NextResponse } from "next/server";
import type { EmailOtpType, SupabaseClient } from "@supabase/supabase-js";
import {
  getTeamProfileForUser,
  isOperationsRole,
  operationsDestination,
} from "@/lib/admin";
import { provisionConfiguredSuperAdmin } from "@/lib/admin-auth";
import { safeNextPath } from "@/lib/safe-next";
import { createAdminSessionClient } from "@/lib/supabase/admin-session";
import { createClient } from "@/lib/supabase/server";

type AuthFlow = "admin" | "customer";

async function authenticatedDestination(
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
    if (profile && isOperationsRole(profile.role)) {
      return operationsDestination(requested);
    }
    await supabase.auth.signOut();
    return "/admin/login?error=not_authorized";
  }

  return requested;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const next = safeNextPath(searchParams.get("next"));
  const flow: AuthFlow =
    searchParams.get("flow") === "admin" ? "admin" : "customer";
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const supabase =
    flow === "admin"
      ? await createAdminSessionClient()
      : await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const destination = await authenticatedDestination(supabase, next, flow);
      return NextResponse.redirect(new URL(destination, request.url));
    }
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      const destination = await authenticatedDestination(supabase, next, flow);
      return NextResponse.redirect(new URL(destination, request.url));
    }
  }

  const loginPath = flow === "admin" ? "/admin/login" : "/login";
  return NextResponse.redirect(
    new URL(`${loginPath}?error=invalid_link`, request.url)
  );
}
