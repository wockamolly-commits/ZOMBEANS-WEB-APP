import { type NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-next";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const next = safeNextPath(searchParams.get("next"));

  // Two magic-link delivery shapes, depending on the email template:
  //  - `code`: the default Supabase template (PKCE) — works without editing
  //    the template (no custom SMTP needed).
  //  - `token_hash` + `type`: a customised template that passes the token hash
  //    directly (more robust across devices; requires custom SMTP to edit).
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=invalid_link", request.url));
}
