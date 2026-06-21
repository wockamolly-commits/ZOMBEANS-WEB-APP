import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type InvitationRole = "staff";
export type StaffInvitation = { id: string; email: string; display_name: string; role: InvitationRole; status: "pending" | "accepted" | "revoked"; expires_at: string; accepted_at: string | null; revoked_at: string | null; created_at: string; is_expired?: boolean };
export type ManagedStaff = { id: string; email: string; display_name: string; role: "admin" | "staff"; is_active: boolean; created_at: string };

export async function getStaffManagementData(): Promise<{ staff: ManagedStaff[]; invitations: StaffInvitation[] }> {
  const admin = createAdminClient();
  const [profilesResult, invitationsResult] = await Promise.all([
    admin.from("profiles").select("id, display_name, role, is_active, created_at").in("role", ["admin", "staff"]).order("created_at"),
    admin.from("staff_invitations").select("id, email, display_name, role, status, expires_at, accepted_at, revoked_at, created_at").order("created_at", { ascending: false }),
  ]);
  if (profilesResult.error) throw profilesResult.error;
  if (invitationsResult.error) throw invitationsResult.error;
  const { data: users, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const emailById = new Map(users.users.map((user) => [user.id, user.email ?? "Unknown email"]));
  return {
    staff: ((profilesResult.data ?? []) as Array<Omit<ManagedStaff, "email">>).map((profile) => ({ ...profile, email: emailById.get(profile.id) ?? "Unknown email" })),
    invitations: ((invitationsResult.data ?? []) as StaffInvitation[]).map((invite) => ({ ...invite, is_expired: new Date(invite.expires_at).getTime() <= Date.now() })),
  };
}


