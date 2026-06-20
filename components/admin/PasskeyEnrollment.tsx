"use client";

import { useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { KeyRound, Loader2 } from "lucide-react";

type RegistrationOptions = Parameters<
  typeof startRegistration
>[0]["optionsJSON"];

export function PasskeyEnrollment({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function enroll() {
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      const optionsResponse = await fetch("/api/auth/passkey/register/options", {
        method: "POST",
      });
      const optionsResult = (await optionsResponse.json()) as {
        options?: RegistrationOptions;
        error?: string;
      };
      if (!optionsResponse.ok || !optionsResult.options) {
        throw new Error(optionsResult.error ?? "Could not start enrollment.");
      }

      const registration = await startRegistration({
        optionsJSON: optionsResult.options,
      });
      const verifyResponse = await fetch("/api/auth/passkey/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: registration }),
      });
      const verification = (await verifyResponse.json()) as {
        ok?: boolean;
        error?: string;
      };
      if (!verifyResponse.ok || !verification.ok) {
        throw new Error(verification.error ?? "Passkey enrollment failed.");
      }

      setCount((current) => current + 1);
      setMessage("Passkey enrolled. You can now sign in without a password or email link.");
    } catch (caught) {
      const cancelled =
        caught instanceof DOMException && caught.name === "NotAllowedError";
      setError(
        cancelled
          ? "Passkey enrollment was cancelled."
          : caught instanceof Error
            ? caught.message
            : "Passkey enrollment failed."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zb-sage/25 bg-zb-primary-strong/60 p-6">
      <div className="flex items-start gap-3">
        <KeyRound className="mt-1 size-5 text-zb-bone" aria-hidden />
        <div>
          <h2 className="font-display text-2xl text-zb-cream">PASSKEYS</h2>
          <p className="mt-1 text-sm text-zb-cream/60">
            {count === 0
              ? "No passkeys enrolled yet."
              : `${count} passkey${count === 1 ? "" : "s"} enrolled.`}
          </p>
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-zb-cream/70">
        Enroll this device or password manager. Future staff sign-ins require
        only your assigned email and the device&apos;s biometric, PIN, or screen lock.
      </p>
      {message && <p className="mt-4 text-sm text-zb-bone">{message}</p>}
      {error && <p role="alert" className="mt-4 text-sm text-zb-danger">{error}</p>}
      <button
        type="button"
        onClick={enroll}
        disabled={pending}
        className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-zb-bone px-4 text-sm font-semibold text-zb-primary-dark transition hover:bg-zb-bone-soft disabled:opacity-55"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
        {pending ? "Enrolling…" : "Add a passkey"}
      </button>
    </div>
  );
}