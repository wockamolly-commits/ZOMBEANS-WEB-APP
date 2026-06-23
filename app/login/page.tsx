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
import { isAdminSurfacePath, safeNextPath } from "@/lib/safe-next";
import { createAdminSessionClient } from "@/lib/supabase/admin-session";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const requestedNext = safeNextPath((await searchParams).next);
  const isOperationsSignIn = isAdminSurfacePath(requestedNext);
  const adminSupabase = await createAdminSessionClient();
  const {
    data: { user: adminUser },
  } = await adminSupabase.auth.getUser();
  if (adminUser) {
    const profile = await getTeamProfileForUser(adminSupabase, adminUser.id);
    if (profile && isOperationsRole(profile.role)) redirect(OPERATIONS_HOME);
  }

  const user = await getCurrentUser();
  if (user && !isOperationsSignIn) {
    redirect("/account");
  }

  return (
    <>
      <Header />
      <DoodleBg className="flex-1">
        <main className="mx-auto w-full max-w-md px-4 py-16 sm:px-6">
          <h1 className="font-display text-5xl text-zb-cream">SIGN IN</h1>
          <p className="mt-3 text-zb-cream/65">
            Enter your email and we&apos;ll send a secure 6-digit sign-in code.
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
