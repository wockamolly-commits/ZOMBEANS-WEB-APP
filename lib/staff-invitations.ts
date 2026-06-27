import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PermissionOverride, StaffJobRole } from "@/lib/staff-roles";
import { isStaffPermission } from "@/lib/staff-roles";

export type StaffInvitation = {
  id: string;
  email: string;
  display_name: string;
  role: "staff" | "rider";
  staff_role: StaffJobRole;
  status: "pending" | "accepted" | "revoked";
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
  is_expired?: boolean;
};

export type ManagedStaff = {
  id: string;
  email: string;
  display_name: string;
  full_name: string | null;
  role: "admin" | "staff" | "rider";
  staff_role: StaffJobRole | null;
  is_active: boolean;
  created_at: string;
  permission_overrides: PermissionOverride[];
};

type ManagedStaffRow = Omit<ManagedStaff, "email"> & {
  full_name?: string | null;
};

function isMissingFullNameColumn(error: { message?: string } | null): boolean {
  return Boolean(error?.message?.includes("profiles.full_name"));
}

export async function getStaffManagementData(): Promise<{
  staff: ManagedStaff[];
  invitations: StaffInvitation[];
}> {
  const admin = createAdminClient();
  const profilesWithFullName = await admin
    .from("profiles")
    .select("id, display_name, full_name, role, staff_role, is_active, created_at")
    .in("role", ["admin", "staff", "rider"])
    .eq("is_active", true)
    .order("created_at");

  const profilesResult =
    profilesWithFullName.error && isMissingFullNameColumn(profilesWithFullName.error)
      ? await admin
          .from("profiles")
          .select("id, display_name, role, staff_role, is_active, created_at")
          .in("role", ["admin", "staff", "rider"])
          .eq("is_active", true)
          .order("created_at")
      : profilesWithFullName;

  const invitationsResult = await admin
    .from("staff_invitations")
    .select(
      "id, email, display_name, role, staff_role, status, expires_at, accepted_at, revoked_at, created_at"
    )
    .order("created_at", { ascending: false });

  if (profilesResult.error) throw profilesResult.error;
  if (invitationsResult.error) throw invitationsResult.error;
  const { data: users, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) throw error;
  const activeUsersById = new Map(
    users.users
      .filter((user) => !user.deleted_at)
      .map((user) => [user.id, user.email ?? "Unknown email"])
  );
  const overridesResult = await admin
    .from("staff_permission_overrides")
    .select("profile_id, permission, granted");
  if (overridesResult.error) throw overridesResult.error;

  const overridesByProfile = new Map<string, PermissionOverride[]>();
  for (const row of overridesResult.data ?? []) {
    if (!isStaffPermission(row.permission)) continue;
    const list = overridesByProfile.get(row.profile_id) ?? [];
    list.push({ permission: row.permission, granted: Boolean(row.granted) });
    overridesByProfile.set(row.profile_id, list);
  }

  return {
    staff: ((profilesResult.data ?? []) as ManagedStaffRow[])
      .filter((profile) => activeUsersById.has(profile.id))
      .map((profile) => ({
        ...profile,
        full_name: profile.full_name ?? null,
        email: activeUsersById.get(profile.id) ?? "Unknown email",
        permission_overrides: overridesByProfile.get(profile.id) ?? [],
      })),
    invitations: ((invitationsResult.data ?? []) as StaffInvitation[]).map(
      (invite) => ({
        ...invite,
        is_expired: new Date(invite.expires_at).getTime() <= Date.now(),
      })
    ),
  };
}
