import "server-only";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminEmailAccess = "super_admin" | "staff" | "invited" | null;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isConfiguredSuperAdminEmail(email: string): boolean {
  const configured = process.env.SUPER_ADMIN_EMAIL;
  return Boolean(configured && normalizeEmail(configured) === normalizeEmail(email));
}

export async function resolveAdminEmailAccess(
  email: string
): Promise<AdminEmailAccess> {
  const normalized = normalizeEmail(email);
  if (isConfiguredSuperAdminEmail(normalized)) return "super_admin";

  const admin = createAdminClient();
  const active = await admin.rpc("resolve_active_operations_email", {
    p_email: normalized,
  });
  if (active.error) throw active.error;
  if (active.data?.length) {
    return active.data[0].role === "admin" ? "super_admin" : "staff";
  }

  const invitation = await admin
    .from("staff_invitations")
    .select("id")
    .eq("status", "pending")
    .ilike("email", normalized)
    .gt("expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (invitation.error) throw invitation.error;
  return invitation.data ? "invited" : null;
}

export async function provisionConfiguredSuperAdmin(
  user: User
): Promise<boolean> {
  if (!user.email || !isConfiguredSuperAdminEmail(user.email)) return false;

  const admin = createAdminClient();
  const existing = await admin
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .neq("id", user.id)
    .limit(1)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return false;

  const displayName =
    typeof user.user_metadata?.display_name === "string" &&
    user.user_metadata.display_name.trim()
      ? user.user_metadata.display_name.trim()
      : "Super Admin";
  const result = await admin.from("profiles").upsert({
    id: user.id,
    role: "admin",
    display_name: displayName,
    is_active: true,
  });
  if (result.error) throw result.error;
  return true;
}
