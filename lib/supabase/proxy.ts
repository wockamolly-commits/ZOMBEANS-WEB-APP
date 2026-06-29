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

  // TEMP diagnostic: forward a marker on the request so downstream handlers
  // (e.g. /api/auth-debug) can confirm the proxy ran. Built after the refresh
  // so it also carries the updated cookie header. Remove with the diagnostic.
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set("x-zb-proxy-ran", "1");
  forwardedHeaders.set(
    "x-zb-proxy-refreshed",
    pendingCookies.size > 0 ? "1" : "0"
  );

  const response = NextResponse.next({
    request: { headers: forwardedHeaders },
  });
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  pendingHeaders.forEach((value, name) => response.headers.set(name, value));
  // TEMP diagnostic: lets us confirm from the browser Network tab whether the
  // proxy actually executes on production, and whether it wrote refreshed
  // cookies. Remove once the production session issue is resolved.
  response.headers.set("x-zb-proxy-ran", "1");
  response.headers.set(
    "x-zb-proxy-refreshed",
    pendingCookies.size > 0 ? "1" : "0"
  );
  return response;
}
