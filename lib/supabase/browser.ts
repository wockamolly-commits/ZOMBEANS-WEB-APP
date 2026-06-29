import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ADMIN_AUTH_COOKIE,
  SUPABASE_COOKIE_ENCODING,
} from "@/lib/supabase/constants";

let customerClient: SupabaseClient | null = null;
let adminClient: SupabaseClient | null = null;

export function createClient() {
  customerClient ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { encode: SUPABASE_COOKIE_ENCODING },
      isSingleton: false,
    }
  );
  return customerClient;
}

export function createAdminClient() {
  adminClient ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { name: ADMIN_AUTH_COOKIE },
      cookies: { encode: SUPABASE_COOKIE_ENCODING },
      isSingleton: false,
    }
  );
  return adminClient;
}
