import { PasskeyEnrollment } from "@/components/admin/PasskeyEnrollment";
import { requireStaff } from "@/lib/admin";
import { getPasskeysForProfile } from "@/lib/passkeys";

export const dynamic = "force-dynamic";

export default async function StaffSecurityPage() {
  const { profile } = await requireStaff("/workspace/security");
  const passkeys = await getPasskeysForProfile(profile.id);

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl text-zb-cream">SIGN-IN SECURITY</h1>
      <p className="mt-1 text-sm text-zb-cream/55">
        Manage passwordless access for your staff account.
      </p>
      <div className="mt-6">
        <PasskeyEnrollment initialCount={passkeys.length} />
      </div>
    </div>
  );
}