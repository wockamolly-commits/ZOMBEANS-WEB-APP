"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import { KeyRound, Mail } from "lucide-react";
import {
  requestMagicLink,
  requestStaffEnrollmentLink,
  type LoginState,
} from "./actions";

type AuthenticationOptions = Parameters<
  typeof startAuthentication
>[0]["optionsJSON"];

type OptionsResult =
  | { staff: false }
  | { staff: true; enrolled: false }
  | { staff: true; enrolled: true; options: AuthenticationOptions }
  | { error: string; code?: string };

const initial: LoginState = { status: "idle" };

export function LoginForm() {
  const next = useSearchParams().get("next") ?? "";
  const [state, setState] = useState<LoginState>(initial);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    if (!email) return;

    setPending(true);
    setState(initial);
    try {
      const optionsResponse = await fetch(
        "/api/auth/passkey/authenticate/options",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        }
      );
      const result = (await optionsResponse.json()) as OptionsResult;
      if (!optionsResponse.ok || "error" in result) {
        setState({
          status: "error",
          message: "error" in result ? result.error : "Could not sign in.",
          email,
        });
        return;
      }

      if (!result.staff) {
        formData.set("next", next);
        setState(await requestMagicLink(initial, formData));
        return;
      }

      if (!result.enrolled) {
        setState(await requestStaffEnrollmentLink(email));
        return;
      }

      const authentication = await startAuthentication({
        optionsJSON: result.options,
      });
      const verifyResponse = await fetch(
        "/api/auth/passkey/authenticate/verify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ response: authentication, next }),
        }
      );
      const verification = (await verifyResponse.json()) as {
        ok?: boolean;
        destination?: string;
        error?: string;
      };
      if (!verifyResponse.ok || !verification.ok || !verification.destination) {
        setState({
          status: "error",
          message: verification.error ?? "Passkey sign-in failed.",
          email,
        });
        return;
      }

      window.location.assign(verification.destination);
    } catch (error) {
      const cancelled = error instanceof DOMException && error.name === "NotAllowedError";
      setState({
        status: "error",
        message: cancelled
          ? "Passkey sign-in was cancelled."
          : "Could not sign in. Try again.",
        email,
      });
    } finally {
      setPending(false);
    }
  }

  if (state.status === "sent") {
    return (
      <div className="mt-8 rounded-2xl border border-zb-bone/45 bg-zb-bone/10 p-5 text-sm text-zb-cream">
        Check <span className="font-semibold">{state.email}</span> for your
        sign-in link. You can close this tab once you&apos;ve opened it.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block text-sm font-medium text-zb-cream">
        Email
        <span className="relative block">
          <Mail className="pointer-events-none absolute left-4 top-1/2 mt-1 size-4 -translate-y-1/2 text-zb-bone" />
          <input
            name="email"
            type="email"
            required
            autoComplete="username webauthn"
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
        {pending ? "Signing in…" : "Continue"}
      </button>
      <p className="text-center text-xs leading-5 text-zb-cream/55">
        Customers receive a one-time email link. Staff are prompted for their
        enrolled passkey.
      </p>
    </form>
  );
}