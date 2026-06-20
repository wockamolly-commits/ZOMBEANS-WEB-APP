import { redirect } from "next/navigation";
import { BadgeCheck, ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getInvitationByToken } from "@/lib/staff-invitations";
import { acceptStaffInvitation } from "./actions";
export const dynamic = "force-dynamic";
export const metadata = { title: "Accept staff invitation" };
type Props = { searchParams: Promise<{ token?: string; error?: string }> };
export default async function Page({ searchParams }: Props) {
  const { token, error } = await searchParams;
  if (!token) return <Message text={error === "email_mismatch" ? "Sign in using the exact invited email address." : "This invitation is invalid, expired, or already used."} />;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/staff-invite/accept?token=${token}`)}`);
  const invitation = await getInvitationByToken(token);
  const valid = invitation?.status === "pending" && !invitation.is_expired && invitation.email.toLowerCase() === user.email?.toLowerCase();
  if (!valid) return <Message text="This invitation is unavailable or belongs to a different email address." />;
  return <main className="flex min-h-dvh items-center justify-center bg-zb-primary px-4 text-zb-cream"><div className="w-full max-w-lg rounded-3xl border border-zb-sage/30 bg-zb-primary-strong/80 p-7"><BadgeCheck className="size-10 text-zb-bone" /><h1 className="mt-5 font-display text-4xl">JOIN THE ZOMBEANS TEAM</h1><p className="mt-3 text-zb-cream/65">You were invited as {invitation.role === "admin" ? "a Super Admin" : "staff"}.</p><div className="mt-5 rounded-xl bg-zb-primary-dark/50 p-4"><p className="font-semibold">{invitation.display_name}</p><p className="text-sm text-zb-cream/55">{invitation.email}</p></div><form action={acceptStaffInvitation}><input type="hidden" name="token" value={token} /><button className="mt-6 h-12 w-full rounded-xl bg-zb-bone font-semibold text-zb-primary-dark">Accept invitation</button></form></div></main>;
}
function Message({ text }: { text: string }) { return <main className="flex min-h-dvh items-center justify-center bg-zb-primary px-4 text-zb-cream"><div className="max-w-lg rounded-3xl border border-zb-danger/30 bg-zb-primary-strong/80 p-7"><ShieldAlert className="size-10 text-zb-bone" /><h1 className="mt-5 font-display text-4xl">INVITATION UNAVAILABLE</h1><p className="mt-3 text-zb-cream/65">{text}</p><a href="/login" className="mt-6 inline-flex rounded-xl border border-zb-bone/40 px-4 py-2 text-sm">Return to sign in</a></div></main>; }

