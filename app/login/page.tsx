"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { DoodleBg } from "@/components/shared/DoodleBg";
import { requestMagicLink, type LoginState } from "./actions";

const initial: LoginState = { status: "idle" };

function LoginForm() {
  const next = useSearchParams().get("next") ?? "";
  const [state, action, pending] = useActionState(requestMagicLink, initial);

  return (
    <>
      <Header />
      <DoodleBg className="flex-1">
        <main className="mx-auto w-full max-w-md px-4 py-16 sm:px-6">
          <h1 className="font-display text-5xl text-zb-cream">SIGN IN</h1>
          <p className="mt-3 text-zb-cream/65">
            We&apos;ll email you a one-time sign-in link — no password needed.
          </p>

          {state.status === "sent" ? (
            <div className="mt-8 rounded-2xl border border-zb-bone/45 bg-zb-bone/10 p-5 text-sm text-zb-cream">
              Check <span className="font-semibold">{state.email}</span> for your
              sign-in link. You can close this tab once you&apos;ve opened it.
            </div>
          ) : (
            <form action={action} className="mt-8 space-y-4">
              <input type="hidden" name="next" value={next} />
              <label className="block text-sm font-medium text-zb-cream">
                Email
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@email.com"
                  className="mt-2 h-12 w-full rounded-xl border border-zb-sage/35 bg-zb-primary-dark/55 px-4 text-zb-cream placeholder:text-zb-cream/35 focus:border-zb-bone focus:outline-none focus:ring-2 focus:ring-zb-bone/20"
                />
              </label>
              {state.status === "error" && (
                <p role="alert" className="rounded-lg border border-zb-danger/40 bg-zb-danger/10 px-3 py-2 text-xs text-zb-cream">
                  {state.message}
                </p>
              )}
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-zb-bone px-4 font-semibold text-zb-primary-dark transition hover:bg-zb-bone-soft disabled:cursor-not-allowed disabled:opacity-55"
              >
                {pending ? "Sending…" : "Email me a link"}
              </button>
            </form>
          )}
        </main>
      </DoodleBg>
      <Footer />
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
