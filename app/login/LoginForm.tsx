"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { KeyRound, Mail } from "lucide-react";
import {
  requestAdminMagicLink,
  requestMagicLink,
  type LoginState,
} from "./actions";

const initial: LoginState = { status: "idle" };

export function LoginForm({ adminOnly = false }: { adminOnly?: boolean }) {
  const next = useSearchParams().get("next") ?? "";
  const [state, action, pending] = useActionState(
    adminOnly ? requestAdminMagicLink : requestMagicLink,
    initial
  );

  if (state.status === "sent") {
    return (
      <div className="mt-8 rounded-2xl border border-zb-bone/45 bg-zb-bone/10 p-5 text-sm text-zb-cream">
        Check <span className="font-semibold">{state.email}</span> for your
        secure sign-in link. You can close this tab once you&apos;ve opened it.
      </div>
    );
  }

  return (
    <form action={action} className="mt-8 space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block text-sm font-medium text-zb-cream">
        Email
        <span className="relative block">
          <Mail className="pointer-events-none absolute left-4 top-1/2 mt-1 size-4 -translate-y-1/2 text-zb-bone" />
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={state.email ?? ""}
            placeholder="you@email.com"
            className="mt-2 h-12 w-full rounded-xl border border-zb-sage/35 bg-zb-primary-dark/55 px-4 pl-11 text-zb-cream placeholder:text-zb-cream/35 focus:border-zb-bone focus:outline-none focus:ring-2 focus:ring-zb-bone/20"
          />
        </span>
      </label>
      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-lg border border-zb-danger/40 bg-zb-danger/10 px-3 py-2 text-xs text-zb-cream"
        >
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-zb-bone px-4 font-semibold text-zb-primary-dark transition hover:bg-zb-bone-soft disabled:cursor-not-allowed disabled:opacity-55"
      >
        <KeyRound className="size-4" aria-hidden />
        {pending ? "Sending link…" : "Email me a sign-in link"}
      </button>
      <p className="text-center text-xs leading-5 text-zb-cream/55">
        {adminOnly
          ? "Only the Super Admin and invited staff can use this portal."
          : "Customers and authorized staff use secure, one-time email links."}
      </p>
    </form>
  );
}
