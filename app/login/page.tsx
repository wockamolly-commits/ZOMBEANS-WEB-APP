import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { DoodleBg } from "@/components/shared/DoodleBg";
import { getCurrentUser } from "@/lib/auth";
import {
  getTeamProfileForUser,
  isOperationsRole,
  OPERATIONS_HOME,
} from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    const supabase = await createClient();
    const profile = await getTeamProfileForUser(supabase, user.id);
    redirect(
      profile && isOperationsRole(profile.role) ? OPERATIONS_HOME : "/account"
    );
  }

  return (
    <>
      <Header />
      <DoodleBg className="flex-1">
        <main className="mx-auto w-full max-w-md px-4 py-16 sm:px-6">
          <h1 className="font-display text-5xl text-zb-cream">SIGN IN</h1>
          <p className="mt-3 text-zb-cream/65">
            Customers use an email link. Staff use their enrolled passkey.
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