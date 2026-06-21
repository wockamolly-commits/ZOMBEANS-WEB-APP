import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/app/login/LoginForm";
import { DoodleBg } from "@/components/shared/DoodleBg";
import { Footer } from "@/components/shared/Footer";
import { Header } from "@/components/shared/Header";
import {
  getTeamProfileForUser,
  isOperationsRole,
  OPERATIONS_HOME,
} from "@/lib/admin";
import { createAdminSessionClient } from "@/lib/supabase/admin-session";

export const metadata = { title: "Admin sign in" };
export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const supabase = await createAdminSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const profile = await getTeamProfileForUser(supabase, user.id);
    if (profile && isOperationsRole(profile.role)) redirect(OPERATIONS_HOME);
  }

  return (
    <>
      <Header />
      <DoodleBg className="flex-1">
        <main className="mx-auto w-full max-w-md px-4 py-16 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zb-bone">
            Authorized team access
          </p>
          <h1 className="mt-3 font-display text-5xl text-zb-cream">
            ADMIN SIGN IN
          </h1>
          <p className="mt-3 text-zb-cream/65">
            Super Admin and invited staff accounts sign in by email link.
          </p>
          <Suspense fallback={null}>
            <LoginForm adminOnly />
          </Suspense>
        </main>
      </DoodleBg>
      <Footer />
    </>
  );
}
