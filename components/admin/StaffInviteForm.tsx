"use client";

import { useActionState } from "react";
import { MailPlus } from "lucide-react";
import {
  inviteStaff,
  type TeamActionState,
} from "@/app/workspace/team/actions";

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
            Staff-only access. The one-time email link is valid for 48 hours.
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
