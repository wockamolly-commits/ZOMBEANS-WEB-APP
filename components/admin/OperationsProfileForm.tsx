"use client";

import { Save } from "lucide-react";
import { useActionState } from "react";
import {
  updateOperationsProfile,
  type OperationsProfileState,
} from "@/app/workspace/account/actions";

const inputClass =
  "mt-2 h-12 w-full rounded-xl border border-zb-sage/35 bg-zb-primary-dark/55 px-4 text-zb-cream placeholder:text-zb-cream/35 focus:border-zb-bone focus:outline-none focus:ring-2 focus:ring-zb-bone/20";
const initialState: OperationsProfileState = { status: "idle" };

type OperationsProfileFormProps = {
  initial: {
    display_name: string;
    full_name: string | null;
  };
};

export function OperationsProfileForm({ initial }: OperationsProfileFormProps) {
  const [state, action, pending] = useActionState(
    updateOperationsProfile,
    initialState
  );

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium text-zb-cream">
        Display name
        <input
          name="displayName"
          defaultValue={initial.display_name}
          minLength={2}
          maxLength={80}
          required
          autoComplete="nickname"
          className={inputClass}
          placeholder="Name shown in the dashboard"
        />
      </label>
      <label className="text-sm font-medium text-zb-cream">
        Full name
        <input
          name="fullName"
          defaultValue={initial.full_name ?? initial.display_name}
          minLength={2}
          maxLength={120}
          required
          autoComplete="name"
          className={inputClass}
          placeholder="Legal or full profile name"
        />
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-zb-bone px-5 text-sm font-semibold text-zb-primary-dark transition hover:bg-zb-bone-soft disabled:opacity-55"
        >
          <Save className="size-4" aria-hidden />
          {pending ? "Saving..." : "Save profile"}
        </button>
        {state.status === "saved" && (
          <span aria-live="polite" className="text-sm text-zb-bone">
            Saved.
          </span>
        )}
        {state.status === "error" && (
          <span role="alert" className="text-sm text-zb-danger">
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
