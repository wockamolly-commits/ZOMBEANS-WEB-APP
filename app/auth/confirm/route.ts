import { type NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import {
  getTeamProfileForUser,
  isOperationsRole,
  operationsDestination,
} from "@/lib/admin";
import { safeNextPath } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

async function authenticatedDestination(
  supabase: Awaited<ReturnType<typeof createClient>>,
  requested: string
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return requested;

  const profile = await getTeamProfileForUser(supabase, user.id);
  return profile && isOperationsRole(profile.role)
    ? operationsDestination(requested)
    : requested;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const next = safeNextPath(searchParams.get("next"));
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const destination = await authenticatedDestination(supabase, next);
      return NextResponse.redirect(new URL(destination, request.url));
    }
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      const destination = await authenticatedDestination(supabase, next);
      return NextResponse.redirect(new URL(destination, request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=invalid_link", request.url));
}