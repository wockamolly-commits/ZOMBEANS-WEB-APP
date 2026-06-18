import { redirect } from "next/navigation";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { DoodleBg } from "@/components/shared/DoodleBg";
import { getCurrentUser, getCustomerProfile } from "@/lib/auth";
import { ProfileForm } from "@/components/account/ProfileForm";

export const metadata = { title: "Your account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  const profile = await getCustomerProfile();

  return (
    <>
      <Header />
      <DoodleBg className="flex-1">
        <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-5xl text-zb-cream">YOUR ACCOUNT</h1>
            <a href="/auth/signout" className="text-sm font-semibold text-zb-bone hover:underline">
              Sign out
            </a>
          </div>
          <p className="mt-2 text-sm text-zb-cream/60">{user.email}</p>

          <section className="mt-8 rounded-2xl border border-zb-sage/25 bg-zb-primary-strong/75 p-6">
            <h2 className="font-display text-2xl text-zb-cream">PROFILE</h2>
            <p className="mt-1 text-sm text-zb-cream/60">Used to pre-fill your checkout.</p>
            <div className="mt-5">
              <ProfileForm initial={profile ?? { display_name: null, phone: null }} />
            </div>
          </section>

          {/* ADDRESSES section added in Task 10 */}
          {/* ORDERS section added in Task 11 */}
        </main>
      </DoodleBg>
      <Footer />
    </>
  );
}
