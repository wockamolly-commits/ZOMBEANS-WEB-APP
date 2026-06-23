import { Clock3, ShieldCheck } from "lucide-react";
import { RevokeStaffAccessForm } from "@/components/admin/RevokeStaffAccessForm";
import { StaffInviteForm } from "@/components/admin/StaffInviteForm";
import { requireSuperAdmin } from "@/lib/admin";
import { getStaffManagementData } from "@/lib/staff-invitations";
import { STAFF_ROLES } from "@/lib/staff-roles";
import { revokeInvitation } from "./actions";

export const dynamic = "force-dynamic";

const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));

export default async function TeamPage() {
  const { profile: current } = await requireSuperAdmin("/workspace/team");
  const { staff, invitations } = await getStaffManagementData();

  return (
    <div>
      <div className="flex items-center gap-3">
        <ShieldCheck className="size-7 text-zb-bone" />
        <div>
          <h1 className="font-display text-3xl text-zb-cream">TEAM ACCESS</h1>
          <p className="text-sm text-zb-cream/55">
            Invite staff, assign dashboard roles, and revoke access centrally.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <StaffInviteForm />
      </div>

      <section className="mt-8">
        <h2 className="font-display text-2xl text-zb-cream">TEAM MEMBERS</h2>
        <div className="mt-3 overflow-hidden rounded-2xl border border-zb-sage/25">
          {staff.map((member) => {
            const roleLabel =
              member.role === "admin"
                ? "Super Admin"
                : member.staff_role
                  ? STAFF_ROLES[member.staff_role].label
                  : "Staff";

            return (
              <div
                key={member.id}
                className="flex flex-col gap-3 border-b border-zb-sage/20 bg-zb-primary-strong/45 p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{member.display_name}</p>
                    <span className="rounded-full bg-zb-bone/10 px-2 py-0.5 text-[10px] font-bold uppercase text-zb-bone">
                      {roleLabel}
                    </span>
                    {!member.is_active && (
                      <span className="text-xs text-zb-danger">Revoked</span>
                    )}
                  </div>
                  <p className="text-sm text-zb-cream/55">{member.email}</p>
                </div>
                {member.id === current.id ? (
                  <span className="text-xs text-zb-cream/45">
                    Your account
                  </span>
                ) : (
                  <RevokeStaffAccessForm profileId={member.id} />
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl text-zb-cream">INVITATIONS</h2>
        <div className="mt-3 overflow-hidden rounded-2xl border border-zb-sage/25">
          {invitations.length === 0 ? (
            <p className="p-5 text-sm text-zb-cream/50">No invitations yet.</p>
          ) : (
            invitations.map((invite) => {
              const expired = invite.status === "pending" && invite.is_expired;
              return (
                <div
                  key={invite.id}
                  className="flex flex-col gap-3 border-b border-zb-sage/20 bg-zb-primary-strong/45 p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold">
                      {invite.display_name}{" "}
                      <span className="rounded-full bg-zb-bone/10 px-2 py-0.5 text-[10px] font-bold uppercase text-zb-bone">
                        {STAFF_ROLES[invite.staff_role].label}
                      </span>{" "}
                      <span className="text-xs uppercase text-zb-cream/45">
                        {expired ? "expired" : invite.status}
                      </span>
                    </p>
                    <p className="text-sm text-zb-cream/55">{invite.email}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-zb-cream/40">
                      <Clock3 className="size-3" />
                      Expires {dateLabel(invite.expires_at)}
                    </p>
                  </div>
                  {invite.status === "pending" && !expired && (
                    <form action={revokeInvitation}>
                      <input
                        type="hidden"
                        name="invitationId"
                        value={invite.id}
                      />
                      <button
                        type="submit"
                        className="rounded-lg border border-zb-danger/35 px-3 py-2 text-xs font-semibold"
                      >
                        Revoke invitation
                      </button>
                    </form>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
