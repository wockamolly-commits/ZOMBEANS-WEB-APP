import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { safeNextPath } from "@/lib/safe-next";
import {
  roleHasPermission,
  type StaffJobRole,
  type StaffPermission,
} from "@/lib/staff-roles";
import { createAdminSessionClient } from "@/lib/supabase/admin-session";

export type StaffRole = "admin" | "staff";
export type TeamRole = StaffRole | "rider";
export type StaffProfile = {
  id: string;
  role: StaffRole;
  staff_role: StaffJobRole | null;
  display_name: string;
  full_name: string | null;
};
export type TeamProfile = Omit<StaffProfile, "role"> & { role: TeamRole };
export const OPERATIONS_HOME = "/workspace";

type TeamProfileRow = {
  id: string;
  role: TeamRole;
  staff_role: StaffJobRole | null;
  display_name: string;
  full_name?: string | null;
};

function isMissingFullNameColumn(error: { message?: string } | null): boolean {
  return Boolean(error?.message?.includes("profiles.full_name"));
}

export function isOperationsRole(role: TeamRole): role is StaffRole {
  return role === "admin" || role === "staff";
}
export function isSuperAdmin(profile: Pick<StaffProfile, "role">): boolean {
  return profile.role === "admin";
}
export function hasStaffPermission(
  profile: Pick<StaffProfile, "role" | "staff_role">,
  permission: StaffPermission
): boolean {
  if (profile.role === "admin") return true;
  return profile.staff_role
    ? roleHasPermission(profile.staff_role, permission)
    : false;
}
export function operationsDestination(raw: string | null | undefined): string {
  const requested = safeNextPath(raw, OPERATIONS_HOME);
  return requested === OPERATIONS_HOME || requested.startsWith(`${OPERATIONS_HOME}/`) ? requested : OPERATIONS_HOME;
}
export async function getTeamProfileForUser(supabase: SupabaseClient, userId: string): Promise<TeamProfile | null> {
  const withFullName = await supabase
    .from("profiles")
    .select("id, role, staff_role, display_name, full_name")
    .eq("id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (withFullName.error && isMissingFullNameColumn(withFullName.error)) {
    const fallback = await supabase
      .from("profiles")
      .select("id, role, staff_role, display_name")
      .eq("id", userId)
      .eq("is_active", true)
      .maybeSingle();
    if (fallback.error) {
      console.error("[auth] team profile lookup failed:", fallback.error.message);
      return null;
    }
    const row = fallback.data as TeamProfileRow | null;
    return row ? { ...row, full_name: null } : null;
  }

  if (withFullName.error) {
    console.error("[auth] team profile lookup failed:", withFullName.error.message);
    return null;
  }

  const row = withFullName.data as TeamProfileRow | null;
  return row ? { ...row, full_name: row.full_name ?? null } : null;
}
export const getStaffProfile = cache(async (): Promise<StaffProfile | null> => {
  const supabase = await createAdminSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const profile = await getTeamProfileForUser(supabase, user.id);
  if (!profile || !isOperationsRole(profile.role)) return null;
  return { id: profile.id, role: profile.role, staff_role: profile.staff_role, display_name: profile.display_name, full_name: profile.full_name };
});
export async function requireStaff(returnTo = OPERATIONS_HOME): Promise<{ user: User; profile: StaffProfile }> {
  const supabase = await createAdminSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  const profile = await getStaffProfile();
  if (!profile) redirect("/account");
  return { user, profile };
}
export async function requireStaffPermission(
  permission: StaffPermission,
  returnTo = OPERATIONS_HOME
): Promise<{ user: User; profile: StaffProfile }> {
  const context = await requireStaff(returnTo);
  if (!hasStaffPermission(context.profile, permission)) redirect(OPERATIONS_HOME);
  return context;
}
export async function requireSuperAdmin(returnTo = `${OPERATIONS_HOME}/team`): Promise<{ user: User; profile: StaffProfile }> {
  const context = await requireStaff(returnTo);
  if (!isSuperAdmin(context.profile)) redirect(OPERATIONS_HOME);
  return context;
}
