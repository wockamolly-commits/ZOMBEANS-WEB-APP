import { UserRound } from "lucide-react";
import { OperationsProfileForm } from "@/components/admin/OperationsProfileForm";
import { requireStaff } from "@/lib/admin";
import { STAFF_ROLES } from "@/lib/staff-roles";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account settings" };

export default async function WorkspaceAccountPage() {
  const { user, profile } = await requireStaff("/workspace/account");
  const roleLabel =
    profile.role === "admin"
      ? "Super Admin"
      : profile.staff_role
        ? STAFF_ROLES[profile.staff_role].label
        : "Staff";

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3">
        <UserRound className="size-7 text-zb-bone" />
        <div>
          <h1 className="font-display text-3xl text-zb-cream">
            ACCOUNT SETTINGS
          </h1>
          <p className="text-sm text-zb-cream/55">
            Manage the name shown across your workspace account.
          </p>
        </div>
      </div>

      <section className="mt-6 rounded-2xl border border-zb-sage/25 bg-zb-primary-strong/60 p-5 sm:p-6">
        <div className="mb-5 flex flex-col gap-2 border-b border-zb-sage/20 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-2xl text-zb-cream">PROFILE</h2>
            <p className="mt-1 text-sm text-zb-cream/55">{user.email}</p>
          </div>
          <span className="w-fit rounded-full bg-zb-bone/10 px-2.5 py-1 text-[11px] font-bold uppercase text-zb-bone">
            {roleLabel}
          </span>
        </div>

        <OperationsProfileForm
          initial={{
            display_name: profile.display_name,
            full_name: profile.full_name,
          }}
        />
      </section>
    </div>
  );
}
