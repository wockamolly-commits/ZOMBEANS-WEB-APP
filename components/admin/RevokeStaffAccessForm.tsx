"use client";

import { useActionState } from "react";
import {
  revokeStaffAccess,
  type TeamActionState,
} from "@/app/workspace/team/actions";

const initial: TeamActionState = { status: "idle" };

export function RevokeStaffAccessForm({ profileId }: { profileId: string }) {
  const [state, action, pending] = useActionState(revokeStaffAccess, initial);

  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <input type="hidden" name="profileId" value={profileId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-zb-bone/35 px-3 py-2 text-xs font-semibold disabled:opacity-55"
      >
        {pending ? "Revoking..." : "Revoke access"}
      </button>
      {state.status === "error" && (
        <p role="alert" className="max-w-52 text-xs text-zb-danger">
          {state.message}
        </p>
      )}
    </form>
  );
}
