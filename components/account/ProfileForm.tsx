"use client";

import { useActionState } from "react";
import { updateProfile, type ProfileState } from "@/app/account/actions";

const inputClass =
  "mt-2 h-12 w-full rounded-xl border border-zb-sage/35 bg-zb-primary-dark/55 px-4 text-zb-cream placeholder:text-zb-cream/35 focus:border-zb-bone focus:outline-none focus:ring-2 focus:ring-zb-bone/20";
const initial: ProfileState = { status: "idle" };

export function ProfileForm({
  initial: data,
}: {
  initial: { display_name: string | null; phone: string | null };
}) {
  const [state, action, pending] = useActionState(updateProfile, initial);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium text-zb-cream">
        Name
        <input name="display_name" defaultValue={data.display_name ?? ""} className={inputClass} placeholder="Your name" />
      </label>
      <label className="text-sm font-medium text-zb-cream">
        Mobile number
        <input name="phone" defaultValue={data.phone ?? ""} inputMode="tel" className={inputClass} placeholder="09XX XXX XXXX" />
      </label>
      <div className="sm:col-span-2 flex items-center gap-3">
        <button type="submit" disabled={pending} className="inline-flex h-11 items-center justify-center rounded-xl bg-zb-bone px-5 font-semibold text-zb-primary-dark transition hover:bg-zb-bone-soft disabled:opacity-55">
          {pending ? "Saving…" : "Save profile"}
        </button>
        {state.status === "saved" && <span aria-live="polite" className="text-sm text-zb-bone">Saved.</span>}
        {state.status === "error" && <span role="alert" className="text-sm text-zb-danger">{state.message}</span>}
      </div>
    </form>
  );
}
