import { CheckoutForm } from "@/components/shop/CheckoutForm";
import { DoodleBg } from "@/components/shared/DoodleBg";
import { Footer } from "@/components/shared/Footer";
import { Header } from "@/components/shared/Header";
import { getCurrentUser, getCustomerProfile, getSavedAddresses } from "@/lib/auth";
import { getStaffProfile } from "@/lib/admin";
import { getStoreAvailability } from "@/lib/store-availability-data";
import { createAdminSessionClient } from "@/lib/supabase/admin-session";
import { createReadOnlyClient } from "@/lib/supabase/server";
import { getGoogleMapsBrowserKey } from "@/lib/google-maps";

export const metadata = { title: "Checkout" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const operationsProfile = await getStaffProfile();
  const storeAvailability = await getStoreAvailability();
  const settingsClient = await createAdminSessionClient();
  const { data: settingsRow } = await settingsClient
    .from("app_settings")
    .select("maps_enabled, store_lat, store_lng, delivery_fee_tiers, delivery_max_km")
    .eq("id", 1)
    .single();
  const deliveryTiers = ((settingsRow?.delivery_fee_tiers as
    | { max_km: number; fee_cents: number }[]
    | null) ?? []).map((tier) => ({
    maxKm: tier.max_km,
    feeCents: tier.fee_cents,
  }));
  const mapsApiKey = getGoogleMapsBrowserKey();
  const mapsEnabled = Boolean(settingsRow?.maps_enabled) && Boolean(mapsApiKey);
  const user = await getCurrentUser();
  const adminSupabase = operationsProfile
    ? settingsClient
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
  const customerAccessToken = user
    ? await readCustomerAccessToken()
    : null;
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
            physicalOpen={storeAvailability.physicalOpen}
            physicalLabel={storeAvailability.physicalLabel}
            mapsEnabled={mapsEnabled}
            mapsApiKey={mapsApiKey}
            storeLat={Number(settingsRow?.store_lat ?? 10.4884825)}
            storeLng={Number(settingsRow?.store_lng ?? 123.4111058)}
            deliveryTiers={deliveryTiers}
            deliveryMaxKm={Number(settingsRow?.delivery_max_km ?? 6)}
            initialCustomerAccessToken={customerAccessToken}
          />
        </main>
      </DoodleBg>
      <Footer />
    </>
  );
}

async function readCustomerAccessToken() {
  const supabase = await createReadOnlyClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}
