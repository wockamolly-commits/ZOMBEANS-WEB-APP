"use server";
import { randomBytes, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { requireSuperAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashInvitationToken } from "@/lib/staff-invitations";

export type TeamActionState = { status: "idle" | "success" | "error"; message?: string };
const inviteSchema = z.object({ email: z.email().trim().toLowerCase(), displayName: z.string().trim().min(2).max(80), role: z.enum(["staff", "admin"]) });
const idSchema = z.uuid();

export async function inviteStaff(_previous: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const { profile: actor } = await requireSuperAdmin("/workspace/team");
  const parsed = inviteSchema.safeParse({ email: formData.get("email"), displayName: formData.get("displayName"), role: formData.get("role") });
  if (!parsed.success) return { status: "error", message: "Check the invitation details." };
  const admin = createAdminClient();
  const { email, displayName, role } = parsed.data;
  const existing = await admin.rpc("resolve_active_operations_email", { p_email: email });
  if (existing.error) return { status: "error", message: "Could not check the staff account." };
  if (existing.data?.length) return { status: "error", message: "That email already has active staff access." };
  await admin.from("staff_invitations").update({ status: "revoked", revoked_at: new Date().toISOString() }).eq("status", "pending").ilike("email", email);
  const token = randomBytes(32).toString("base64url");
  const invitationId = randomUUID();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const created = await admin.from("staff_invitations").insert({ id: invitationId, email, display_name: displayName, role, token_hash: hashInvitationToken(token), invited_by_profile_id: actor.id, expires_at: expiresAt });
  if (created.error) return { status: "error", message: "Could not create the invitation." };
  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin") ?? "http://localhost:3000").replace(/\/$/, "");
  const acceptPath = `/staff-invite/accept?token=${encodeURIComponent(token)}`;
  const redirectTo = `${origin}/auth/confirm?next=${encodeURIComponent(acceptPath)}`;
  const sent = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { display_name: displayName, staff_invitation_id: invitationId } });
  if (sent.error) {
    const existingAccount = sent.error.message.toLowerCase().includes("already");
    const fallback = existingAccount
      ? await admin.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo, shouldCreateUser: false } })
      : { error: sent.error };
    if (fallback.error) {
      await admin.from("staff_invitations").delete().eq("id", invitationId);
      return { status: "error", message: "The invitation email could not be sent. Check Supabase email settings." };
    }
  }
  await admin.from("audit_logs").insert({ actor_profile_id: actor.id, action: "staff_invitation.created", target_table: "staff_invitations", target_id: invitationId, diff: { email, display_name: displayName, role, expires_at: expiresAt } });
  revalidatePath("/workspace/team");
  return { status: "success", message: `Invitation sent to ${email}. It expires in 48 hours.` };
}

export async function revokeInvitation(formData: FormData): Promise<void> {
  const { profile: actor } = await requireSuperAdmin("/workspace/team");
  const id = idSchema.safeParse(formData.get("invitationId")); if (!id.success) return;
  const admin = createAdminClient();
  const result = await admin.from("staff_invitations").update({ status: "revoked", revoked_at: new Date().toISOString() }).eq("id", id.data).eq("status", "pending").select("id").maybeSingle();
  if (result.data) await admin.from("audit_logs").insert({ actor_profile_id: actor.id, action: "staff_invitation.revoked", target_table: "staff_invitations", target_id: id.data });
  revalidatePath("/workspace/team");
}

export async function setStaffAccess(formData: FormData): Promise<void> {
  const { profile: actor } = await requireSuperAdmin("/workspace/team");
  const id = idSchema.safeParse(formData.get("profileId")); if (!id.success || id.data === actor.id) return;
  const active = formData.get("active") === "true";
  const admin = createAdminClient();
  const result = await admin.from("profiles").update({ is_active: active }).eq("id", id.data).in("role", ["admin", "staff"]).select("id, role").maybeSingle();
  if (result.data) await admin.from("audit_logs").insert({ actor_profile_id: actor.id, action: active ? "staff_access.restored" : "staff_access.revoked", target_table: "profiles", target_id: id.data, diff: { role: result.data.role, is_active: active } });
  revalidatePath("/workspace/team");
}

