"use server";

import { randomUUID } from "node:crypto";
import { refresh, revalidatePath } from "next/cache";
import { headers } from "next/headers";
import * as z from "zod";
import { requireSuperAdmin } from "@/lib/admin";
import { isConfiguredSuperAdminEmail } from "@/lib/admin-auth";
import {
  GRANTABLE_PERMISSIONS,
  isStaffJobRole,
  isStaffRoleAvailable,
  roleDefaultPermissions,
  STAFF_ROLES,
} from "@/lib/staff-roles";
import { createAdminClient } from "@/lib/supabase/admin";

export type TeamActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const inviteSchema = z.object({
  email: z.email().trim().toLowerCase(),
  displayName: z.string().trim().min(2).max(80),
  role: z.string().refine(isStaffJobRole),
});
const idSchema = z.uuid();

async function siteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  if (!host) throw new Error("Site URL is not configured.");
  return `${protocol}://${host}`;
}

export async function inviteStaff(
  _previous: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  const { profile: actor } = await requireSuperAdmin("/workspace/team");
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    displayName: formData.get("displayName"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Check the invitation details." };
  }

  const admin = createAdminClient();
  const { email, displayName, role } = parsed.data;
  if (!isStaffRoleAvailable(role)) {
    return {
      status: "error",
      message: `${STAFF_ROLES[role].label} invitations are not available yet.`,
    };
  }
  if (isConfiguredSuperAdminEmail(email)) {
    return {
      status: "error",
      message: "The primary Super Admin email cannot be invited as staff.",
    };
  }
  const existing = await admin.rpc("resolve_active_operations_email", {
    p_email: email,
  });
  if (existing.error) {
    return { status: "error", message: "Could not check the staff account." };
  }
  if (existing.data?.length) {
    return {
      status: "error",
      message: "That email already has active team access.",
    };
  }

  await admin
    .from("staff_invitations")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("status", "pending")
    .ilike("email", email);

  const invitationId = randomUUID();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const created = await admin.from("staff_invitations").insert({
    id: invitationId,
    email,
    display_name: displayName,
    role: "staff",
    staff_role: role,
    invited_by_profile_id: actor.id,
    expires_at: expiresAt,
  });
  if (created.error) {
    console.error("[team] invitation insert failed:", created.error.message);
    return { status: "error", message: "Could not create the invitation." };
  }

  const redirectUrl = new URL("/auth/invite", await siteUrl());
  redirectUrl.searchParams.set("invitationId", invitationId);
  redirectUrl.searchParams.set("email", email);
  redirectUrl.searchParams.set("next", "/workspace");

  const sent = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: redirectUrl.toString(),
    data: {
      display_name: displayName,
      staff_invitation_id: invitationId,
      staff_role: role,
    },
  });
  if (sent.error) {
    await admin.from("staff_invitations").delete().eq("id", invitationId);
    console.error("[team] invitation email failed:", sent.error.message);
    return {
      status: "error",
      message:
        sent.error.status === 429
          ? "Too many invitation email requests. Please wait a bit and try again."
          : "The invitation email could not be sent. Check the email provider settings.",
    };
  }

  const userId = sent.data.user?.id;
  if (userId) {
    const metadata = await admin.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...(sent.data.user?.user_metadata ?? {}),
        display_name: displayName,
        staff_invitation_id: invitationId,
        staff_role: role,
      },
    });
    if (metadata.error) {
      console.error(
        "[team] invitation metadata update failed:",
        metadata.error.message
      );
    }
  }

  await admin.from("audit_logs").insert({
    actor_profile_id: actor.id,
    action: "staff_invitation.created",
    target_table: "staff_invitations",
    target_id: invitationId,
    diff: {
      email,
      display_name: displayName,
      account_role: "staff",
      staff_role: role,
      expires_at: expiresAt,
    },
  });
  revalidatePath("/workspace/team");
  return {
    status: "success",
    message: `${STAFF_ROLES[role].label} invitation link sent to ${email}. Their 6-digit code will be sent after they open it.`,
  };
}

export async function revokeInvitation(formData: FormData): Promise<void> {
  const { profile: actor } = await requireSuperAdmin("/workspace/team");
  const id = idSchema.safeParse(formData.get("invitationId"));
  if (!id.success) return;

  const admin = createAdminClient();
  const result = await admin
    .from("staff_invitations")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", id.data)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (result.data) {
    await admin.from("audit_logs").insert({
      actor_profile_id: actor.id,
      action: "staff_invitation.revoked",
      target_table: "staff_invitations",
      target_id: id.data,
    });
  }
  revalidatePath("/workspace/team");
}

export async function revokeStaffAccess(
  _previous: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  const { profile: actor } = await requireSuperAdmin("/workspace/team");
  const id = idSchema.safeParse(formData.get("profileId"));
  if (!id.success || id.data === actor.id) {
    return { status: "error", message: "That team member could not be found." };
  }

  const admin = createAdminClient();
  const profile = await admin
    .from("profiles")
    .select("id, role, staff_role, is_active")
    .eq("id", id.data)
    .maybeSingle();
  if (profile.error) {
    console.error("[team] staff profile lookup failed:", profile.error.message);
    return { status: "error", message: "Could not check team member access." };
  }
  if (!profile.data) {
    const cleaned = await admin.rpc("delete_operations_profile", {
      p_profile_id: id.data,
    });
    if (cleaned.error) {
      console.error(
        "[team] orphaned auth cleanup failed:",
        cleaned.error.message
      );
    }
    const deleted = await admin.auth.admin.deleteUser(id.data);
    if (deleted.error) {
      console.error(
        "[team] orphaned auth delete failed:",
        deleted.error.message
      );
      return {
        status: "error",
        message: "Could not delete the remaining Auth user.",
      };
    }
    revalidatePath("/workspace/team");
    refresh();
    return {
      status: "success",
      message: "Remaining Auth user deleted.",
    };
  }
  if (profile.data.role === "admin") {
    return {
      status: "error",
      message: "The Super Admin account cannot be revoked here.",
    };
  }

  const user = await admin.auth.admin.getUserById(id.data);
  if (user.error) {
    console.error("[team] staff auth lookup failed:", user.error.message);
  }
  const email = user.data.user?.email ?? null;
  const revokedAt = new Date().toISOString();

  const acceptedInvitations = await admin
    .from("staff_invitations")
    .update({ status: "revoked", revoked_at: revokedAt })
    .eq("accepted_by_profile_id", id.data)
    .in("status", ["pending", "accepted"]);
  if (acceptedInvitations.error) {
    console.error(
      "[team] accepted invitation revoke failed:",
      acceptedInvitations.error.message
    );
  }

  if (email) {
    const emailInvitations = await admin
      .from("staff_invitations")
      .update({ status: "revoked", revoked_at: revokedAt })
      .ilike("email", email)
      .in("status", ["pending", "accepted"]);
    if (emailInvitations.error) {
      console.error(
        "[team] email invitation revoke failed:",
        emailInvitations.error.message
      );
    }
  }

  const ban = await admin.auth.admin.updateUserById(id.data, {
    ban_duration: "876000h",
  });
  if (ban.error) {
    console.error("[team] staff auth ban failed:", ban.error.message);
  }

  const cleaned = await admin.rpc("delete_operations_profile", {
    p_profile_id: id.data,
  });
  let profileRemoved = false;
  let profileDeactivated = false;

  if (cleaned.error) {
    console.error("[team] staff profile cleanup failed:", cleaned.error.message);

    const revoked = await admin
      .from("profiles")
      .update({ is_active: false })
      .eq("id", id.data)
      .in("role", ["staff", "rider"])
      .select("id")
      .maybeSingle();
    if (revoked.error || !revoked.data) {
      console.error(
        "[team] staff profile revoke failed:",
        revoked.error?.message ?? "profile was not updated"
      );
    } else {
      profileDeactivated = true;
    }
  } else {
    profileRemoved = cleaned.data === true;
    profileDeactivated = profileRemoved;
  }

  const deleted = await admin.auth.admin.deleteUser(id.data);
  if (deleted.error) {
    console.error("[team] staff auth delete failed:", deleted.error.message);
    return {
      status: "error",
      message: profileDeactivated
        ? "Dashboard access was removed, but the Auth user is still blocked by database constraints."
        : "Could not delete team member access. Check database constraints.",
    };
  }

  const audit = await admin.from("audit_logs").insert({
    actor_profile_id: actor.id,
    action: "staff_access.revoked",
    target_table: "profiles",
    target_id: id.data,
    diff: {
      email,
      role: profile.data.role,
      staff_role: profile.data.staff_role,
      was_active: profile.data.is_active,
      is_active: profileDeactivated ? false : profile.data.is_active,
      auth_user_deleted: !deleted.error,
      auth_user_banned: !ban.error,
      profile_deactivated: profileDeactivated,
      profile_removed: profileRemoved,
    },
  });
  if (audit.error) {
    console.error("[team] staff revoke audit failed:", audit.error.message);
  }

  revalidatePath("/workspace", "layout");
  revalidatePath("/workspace/team");
  refresh();
  return { status: "success", message: "Team member access revoked." };
}

export async function updateStaffPermissions(
  _previous: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  const { profile: actor } = await requireSuperAdmin("/workspace/team");
  const targetId = idSchema.safeParse(formData.get("profileId"));
  if (!targetId.success || targetId.data === actor.id) {
    return { status: "error", message: "That team member could not be found." };
  }

  const admin = createAdminClient();
  const target = await admin
    .from("profiles")
    .select("id, role, staff_role, is_active")
    .eq("id", targetId.data)
    .maybeSingle();
  if (target.error) {
    console.error("[team] permission target lookup failed:", target.error.message);
    return { status: "error", message: "Could not load that team member." };
  }
  if (!target.data || !target.data.is_active) {
    return { status: "error", message: "That team member could not be found." };
  }
  if (target.data.role === "admin") {
    return {
      status: "error",
      message: "Super Admin permissions cannot be edited here.",
    };
  }

  const defaults = new Set(
    roleDefaultPermissions(
      isStaffJobRole(target.data.staff_role) ? target.data.staff_role : null
    )
  );

  const toUpsert: {
    profile_id: string;
    permission: string;
    granted: boolean;
    updated_by: string;
    updated_at: string;
  }[] = [];
  const toClear: string[] = [];
  const now = new Date().toISOString();
  const effective: Record<string, boolean> = {};

  for (const entry of GRANTABLE_PERMISSIONS) {
    const desired = formData.get(`perm:${entry.permission}`) === "on";
    effective[entry.permission] = desired;
    const isDefault = defaults.has(entry.permission);
    if (desired === isDefault) {
      toClear.push(entry.permission);
    } else {
      toUpsert.push({
        profile_id: targetId.data,
        permission: entry.permission,
        granted: desired,
        updated_by: actor.id,
        updated_at: now,
      });
    }
  }

  if (toClear.length) {
    const cleared = await admin
      .from("staff_permission_overrides")
      .delete()
      .eq("profile_id", targetId.data)
      .in("permission", toClear);
    if (cleared.error) {
      console.error("[team] permission clear failed:", cleared.error.message);
      return { status: "error", message: "Could not update permissions." };
    }
  }

  if (toUpsert.length) {
    const upserted = await admin
      .from("staff_permission_overrides")
      .upsert(toUpsert, { onConflict: "profile_id,permission" });
    if (upserted.error) {
      console.error("[team] permission upsert failed:", upserted.error.message);
      return { status: "error", message: "Could not update permissions." };
    }
  }

  await admin.from("audit_logs").insert({
    actor_profile_id: actor.id,
    action: "staff_permissions.updated",
    target_table: "profiles",
    target_id: targetId.data,
    diff: { permissions: effective },
  });

  revalidatePath("/workspace", "layout");
  revalidatePath("/workspace/team");
  return { status: "success", message: "Permissions updated." };
}
