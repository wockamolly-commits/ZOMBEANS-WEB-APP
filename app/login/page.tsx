import { Suspense } from "react";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { DoodleBg } from "@/components/shared/DoodleBg";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <Header />
      <DoodleBg className="flex-1">
        <main className="mx-auto w-full max-w-md px-4 py-16 sm:px-6">
          <h1 className="font-display text-5xl text-zb-cream">SIGN IN</h1>
          <p className="mt-3 text-zb-cream/65">
            We&apos;ll email you a one-time sign-in link — no password needed.
          </p>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </main>
      </DoodleBg>
      <Footer />
    </>
  );
}
