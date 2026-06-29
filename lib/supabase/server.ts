import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_COOKIE_ENCODING } from "@/lib/supabase/constants";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        encode: SUPABASE_COOKIE_ENCODING,
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component. Proxy refreshes the session on
            // the next response.
          }
        },
      },
    }
  );
}

/**
 * A customer client that can READ the session from cookies but can never
 * WRITE or DELETE them (setAll is a no-op).
 *
 * Inside a Server Action `cookieStore.set` is permitted, so the normal client's
 * `getUser()` will happily *clear* the customer's cookies when an internal
 * token refresh fails (e.g. the refresh token was already rotated by the
 * browser moments earlier). That is exactly what was signing users out during
 * checkout and producing "could not verify your sign-in session" on
 * production. The browser is the single source of truth for the customer
 * session; the server must never mutate those cookies behind its back.
 */
export async function createReadOnlyClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        encode: SUPABASE_COOKIE_ENCODING,
        getAll() {
          return cookieStore.getAll();
        },
        // Intentionally inert: this client must not refresh, rotate, or clear
        // the customer's auth cookies.
        setAll() {},
      },
    }
  );
}
