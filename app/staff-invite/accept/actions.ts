"use server";
import { redirect } from "next/navigation";
import * as z from "zod";
import { createClient } from "@/lib/supabase/server";
import { hashInvitationToken } from "@/lib/staff-invitations";
const schema = z.object({ token: z.string().min(32).max(200) });
export async function acceptStaffInvitation(formData: FormData): Promise<void> {
  const parsed = schema.safeParse({ token: formData.get("token") });
  if (!parsed.success) redirect("/staff-invite/accept?error=invalid");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/staff-invite/accept?token=${parsed.data.token}`)}`);
  const { error } = await supabase.rpc("accept_staff_invitation", { p_token_hash: hashInvitationToken(parsed.data.token) });
  if (error) redirect(`/staff-invite/accept?error=${error.message.includes("EMAIL_MISMATCH") ? "email_mismatch" : "invalid"}`);
  redirect("/workspace/security");
}
