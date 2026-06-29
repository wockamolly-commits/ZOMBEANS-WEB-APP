import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_AUTH_COOKIE,
  SUPABASE_COOKIE_ENCODING,
  getCustomerAuthCookieName,
} from "@/lib/supabase/constants";

export async function updateSession(request: NextRequest) {
  const pendingCookies = new Map<
    string,
    { name: string; value: string; options: CookieOptions }
  >();
  const pendingHeaders = new Map<string, string>();
  const requestCookies = request.cookies.getAll();

  function sessionClient(cookieName?: string) {
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        ...(cookieName ? { cookieOptions: { name: cookieName } } : {}),
        cookies: {
          encode: SUPABASE_COOKIE_ENCODING,
          getAll() {
            return requestCookies;
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

  const refreshes: Array<Promise<unknown>> = [];
  if (hasCookieFamily(requestCookies, getCustomerAuthCookieName())) {
    refreshes.push(sessionClient().auth.getUser());
  }
  if (hasCookieFamily(requestCookies, ADMIN_AUTH_COOKIE)) {
    refreshes.push(sessionClient(ADMIN_AUTH_COOKIE).auth.getUser());
  }
  await Promise.all(refreshes);

  const response = NextResponse.next();
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  pendingHeaders.forEach((value, name) => response.headers.set(name, value));
  return response;
}

function hasCookieFamily(
  cookies: Array<{ name: string; value: string }>,
  storageKey: string
) {
  return cookies.some(
    ({ name }) => name === storageKey || name.startsWith(`${storageKey}.`)
  );
}
