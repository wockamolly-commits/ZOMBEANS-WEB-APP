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

  function sessionClient(config: {
    cookieName?: string;
    encoding?: typeof SUPABASE_COOKIE_ENCODING;
  }) {
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        ...(config.cookieName ? { cookieOptions: { name: config.cookieName } } : {}),
        cookies: {
          // Only the admin client uses the compact "tokens-only" cookie format.
          // The customer client must match the browser client's default
          // (base64url, full session) encoding — otherwise the browser can't
          // read the cookie the proxy writes back, and the session breaks.
          ...(config.encoding ? { encode: config.encoding } : {}),
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
  // The proxy is the ONE place that may refresh the customer session and
  // persist the result. A Supabase access token is treated as expired slightly
  // before its real expiry; the first server-side read after that point
  // (getUser/getSession, or any .from()/.rpc() which loads the session to
  // attach the auth header) rotates the refresh token against the auth server.
  // Inside a Server Component that rotation can't be written back, so the
  // browser keeps the now-burned refresh token and its next refresh fails with
  // "refresh_token_already_used" — silently signing the customer out. Refreshing
  // here writes the rotated token onto both the downstream request cookies and
  // the response, so Server Components read a fresh token and never trigger that
  // unpersisted rotation. Localhost rarely hit this because tokens stay fresh
  // during quick tests. (Server Actions, e.g. checkout, stay stateless and never
  // touch these cookies, so there is no multi-writer race.)
  if (hasCookieFamily(requestCookies, getCustomerAuthCookieName())) {
    refreshes.push(sessionClient({}).auth.getUser());
  }
  // Admin auth stays isolated in its own cookie family + compact encoding.
  if (hasCookieFamily(requestCookies, ADMIN_AUTH_COOKIE)) {
    refreshes.push(
      sessionClient({
        cookieName: ADMIN_AUTH_COOKIE,
        encoding: SUPABASE_COOKIE_ENCODING,
      }).auth.getUser()
    );
  }
  // A transient auth-server hiccup must not break the request. A failed refresh
  // just means cookies aren't updated this round; the browser still owns the
  // session and recovers on its own.
  await Promise.all(refreshes).catch(() => {});

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
