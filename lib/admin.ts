import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { safeNextPath } from "@/lib/safe-next";
import { createAdminSessionClient } from "@/lib/supabase/admin-session";

export type StaffRole = "admin" | "staff";
export type TeamRole = StaffRole | "rider";
export type StaffProfile = { id: string; role: StaffRole; display_name: string };
export type TeamProfile = Omit<StaffProfile, "role"> & { role: TeamRole };
export const OPERATIONS_HOME = "/workspace";

export function isOperationsRole(role: TeamRole): role is StaffRole {
  return role === "admin" || role === "staff";
}
export function isSuperAdmin(profile: Pick<StaffProfile, "role">): boolean {
  return profile.role === "admin";
}
export function operationsDestination(raw: string | null | undefined): string {
  const requested = safeNextPath(raw, OPERATIONS_HOME);
  return requested === OPERATIONS_HOME || requested.startsWith(`${OPERATIONS_HOME}/`) ? requested : OPERATIONS_HOME;
}
export async function getTeamProfileForUser(supabase: SupabaseClient, userId: string): Promise<TeamProfile | null> {
  const { data, error } = await supabase.from("profiles").select("id, role, display_name").eq("id", userId).eq("is_active", true).maybeSingle();
  if (error) { console.error("[auth] team profile lookup failed:", error.message); return null; }
  return data as TeamProfile | null;
}
export const getStaffProfile = cache(async (): Promise<StaffProfile | null> => {
  const supabase = await createAdminSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const profile = await getTeamProfileForUser(supabase, user.id);
  if (!profile || !isOperationsRole(profile.role)) return null;
  return { id: profile.id, role: profile.role, display_name: profile.display_name };
});
export async function requireStaff(returnTo = OPERATIONS_HOME): Promise<{ user: User; profile: StaffProfile }> {
  const supabase = await createAdminSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/admin/login?next=${encodeURIComponent(returnTo)}`);
  const profile = await getStaffProfile();
  if (!profile) redirect("/account");
  return { user, profile };
}
export async function requireSuperAdmin(returnTo = `${OPERATIONS_HOME}/team`): Promise<{ user: User; profile: StaffProfile }> {
  const context = await requireStaff(returnTo);
  if (!isSuperAdmin(context.profile)) redirect(OPERATIONS_HOME);
  return context;
}
