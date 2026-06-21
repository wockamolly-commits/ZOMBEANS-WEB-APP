import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_AUTH_COOKIE } from "@/lib/supabase/constants";

export async function updateSession(request: NextRequest) {
  const pendingCookies = new Map<
    string,
    { name: string; value: string; options: CookieOptions }
  >();
  const pendingHeaders = new Map<string, string>();

  function sessionClient(cookieName?: string) {
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        ...(cookieName ? { cookieOptions: { name: cookieName } } : {}),
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet, headers) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value);
              pendingCookies.set(name, { name, value, options });
            });
            Object.entries(headers).forEach(([name, value]) => {
              pendingHeaders.set(name, value);
            });
          },
        },
      }
    );
  }

  const customer = sessionClient();
  const admin = sessionClient(ADMIN_AUTH_COOKIE);
  await Promise.all([customer.auth.getUser(), admin.auth.getUser()]);

  const response = NextResponse.next({ request });
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  pendingHeaders.forEach((value, name) => response.headers.set(name, value));
  return response;
}
