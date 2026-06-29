import { NextResponse, type NextRequest } from "next/server";
import { createReadOnlyClient } from "@/lib/supabase/server";
import { createAdminSessionClient } from "@/lib/supabase/admin-session";

export const dynamic = "force-dynamic";

/**
 * TEMP production diagnostic for the session-persistence issue.
 *
 * Reports server-side truth WITHOUT leaking any token values: only cookie
 * names, host/proxy info, and whether getUser() resolves a user. Visit
 * /api/auth-debug on production while signed in and share the JSON. Remove once
 * the issue is resolved.
 */
export async function GET(request: NextRequest) {
  const cookieNames = request.cookies.getAll().map((c) => c.name);
  const authCookieNames = cookieNames.filter(
    (n) => /^sb-.*-auth-token/.test(n) || n.startsWith("zb-admin-auth")
  );

  let customer: { ok: boolean; hasUser: boolean; error: string | null } = {
    ok: false,
    hasUser: false,
    error: null,
  };
  let admin: { ok: boolean; hasUser: boolean; error: string | null } = {
    ok: false,
    hasUser: false,
    error: null,
  };

  try {
    const supabase = await createReadOnlyClient();
    const { data, error } = await supabase.auth.getUser();
    customer = {
      ok: !error,
      hasUser: Boolean(data.user),
      error: error?.message ?? null,
    };
  } catch (e) {
    customer.error = e instanceof Error ? e.message : "threw";
  }

  try {
    const supabase = await createAdminSessionClient();
    const { data, error } = await supabase.auth.getUser();
    admin = {
      ok: !error,
      hasUser: Boolean(data.user),
      error: error?.message ?? null,
    };
  } catch (e) {
    admin.error = e instanceof Error ? e.message : "threw";
  }

  return NextResponse.json({
    host: request.headers.get("host"),
    forwardedHost: request.headers.get("x-forwarded-host"),
    forwardedProto: request.headers.get("x-forwarded-proto"),
    url: request.url,
    proxyRan: request.headers.get("x-zb-proxy-ran"),
    allCookieCount: cookieNames.length,
    authCookieNames,
    customer,
    admin,
    supabaseUrlHost: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
      : null,
  });
}
