import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serverSecret =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serverSecret) {
    throw new Error("Supabase server secret is not configured.");
  }

  return createClient(url, serverSecret, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
