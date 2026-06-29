export const ADMIN_AUTH_COOKIE = "zb-admin-auth";
export const SUPABASE_COOKIE_ENCODING = "tokens-only" as const;

export function getCustomerAuthCookieName() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required.");
  }

  return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
}
