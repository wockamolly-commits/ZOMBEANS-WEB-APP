import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import {
  ADMIN_AUTH_COOKIE,
  SUPABASE_COOKIE_ENCODING,
} from "@/lib/supabase/constants";

export async function createAdminSessionClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { name: ADMIN_AUTH_COOKIE },
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
            // Server Components cannot write cookies. Proxy refreshes them.
          }
        },
      },
    }
  );
}
