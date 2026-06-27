import { CheckoutForm } from "@/components/shop/CheckoutForm";
import { DoodleBg } from "@/components/shared/DoodleBg";
import { Footer } from "@/components/shared/Footer";
import { Header } from "@/components/shared/Header";
import { getCurrentUser, getCustomerProfile, getSavedAddresses } from "@/lib/auth";
import { getStaffProfile } from "@/lib/admin";
import { getStoreAvailability } from "@/lib/store-availability-data";
import { createAdminSessionClient } from "@/lib/supabase/admin-session";

export const metadata = { title: "Checkout" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const operationsProfile = await getStaffProfile();
  const storeAvailability = await getStoreAvailability();
  const user = await getCurrentUser();
  const adminSupabase = operationsProfile
    ? await createAdminSessionClient()
    : null;
  const {
    data: { user: operationsUser },
  } = adminSupabase
    ? await adminSupabase.auth.getUser()
    : { data: { user: null } };
  const profile =
    user
      ? await getCustomerProfile()
      : operationsProfile
        ? { display_name: operationsProfile.display_name, phone: null }
        : null;
  const savedAddresses = user ? await getSavedAddresses() : [];
  const isLoggedIn = Boolean(user || operationsProfile);
  const email = user?.email ?? (operationsProfile ? operationsUser?.email ?? null : null);

  return (
    <>
      <Header />
      <DoodleBg className="flex-1">
        <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zb-bone">Almost revived</p>
            <h1 className="mt-2 font-display text-5xl text-zb-cream sm:text-6xl">CHECKOUT</h1>
            <p className="mt-3 max-w-2xl text-zb-cream/65">Choose how you want it, tell us where it is going, and review the total.</p>
          </div>
          <CheckoutForm
            isLoggedIn={isLoggedIn}
            email={email}
            profile={profile ?? { display_name: null, phone: null }}
            savedAddresses={savedAddresses}
            operationsRole={user ? null : operationsProfile?.role ?? null}
            webstoreOpen={storeAvailability.isOpen}
            closureLabel={storeAvailability.closureLabel}
            closedUntil={storeAvailability.closedUntil}
            prepBufferMinutes={storeAvailability.prepBufferMinutes}
          />
        </main>
      </DoodleBg>
      <Footer />
    </>
  );
}
