"use client";

import { useActionState } from "react";
import { MailPlus } from "lucide-react";
import {
  inviteStaff,
  type TeamActionState,
} from "@/app/workspace/team/actions";
import { STAFF_ROLES, type StaffJobRole } from "@/lib/staff-roles";

const initial: TeamActionState = { status: "idle" };

export function StaffInviteForm() {
  const [state, action, pending] = useActionState(inviteStaff, initial);
  return (
    <form
      action={action}
      className="rounded-2xl border border-zb-sage/25 bg-zb-primary-strong/60 p-5"
    >
      <div className="flex items-center gap-3">
        <MailPlus className="size-5 text-zb-bone" />
        <div>
          <h2 className="font-display text-xl text-zb-cream">INVITE STAFF</h2>
          <p className="text-xs text-zb-cream/50">
            Staff-only access. The invite is valid for 48 hours; sign-in uses a
            6-digit email code.
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-zb-cream/75">
          Name
          <input
            name="displayName"
            required
            maxLength={80}
            className="mt-2 h-11 w-full rounded-xl border border-zb-sage/35 bg-zb-primary-dark/55 px-3"
          />
        </label>
        <label className="text-sm text-zb-cream/75">
          Email
          <input
            name="email"
            type="email"
            required
            className="mt-2 h-11 w-full rounded-xl border border-zb-sage/35 bg-zb-primary-dark/55 px-3"
          />
        </label>
      </div>
      <fieldset className="mt-5">
        <legend className="text-sm font-medium text-zb-cream/75">Role</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {(Object.entries(STAFF_ROLES) as Array<
            [StaffJobRole, (typeof STAFF_ROLES)[StaffJobRole]]
          >).map(([value, role]) => (
            <label
              key={value}
              className={`rounded-xl border p-4 ${
                role.available
                  ? "cursor-pointer border-zb-sage/35 bg-zb-primary-dark/35 has-checked:border-zb-bone has-checked:bg-zb-bone/10"
                  : "cursor-not-allowed border-zb-sage/15 bg-zb-primary-dark/20 opacity-55"
              }`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="role"
                  value={value}
                  defaultChecked={value === "cashier"}
                  disabled={!role.available}
                  className="accent-zb-bone"
                />
                <span className="font-semibold text-zb-cream">
                  {role.label}
                </span>
                {!role.available && (
                  <span className="ml-auto rounded-full bg-zb-cream/10 px-2 py-0.5 text-[10px] font-bold uppercase text-zb-cream/55">
                    Coming soon
                  </span>
                )}
              </span>
              <span className="mt-2 block text-xs leading-5 text-zb-cream/50">
                {role.description}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {state.status !== "idle" && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className="mt-4 rounded-lg border border-zb-bone/30 px-3 py-2 text-sm"
        >
          {state.message}
        </p>
      )}
      <button
        disabled={pending}
        className="mt-5 h-11 rounded-xl bg-zb-bone px-5 text-sm font-semibold text-zb-primary-dark disabled:opacity-55"
      >
        {pending ? "Sending…" : "Send staff invitation"}
      </button>
    </form>
  );
}
