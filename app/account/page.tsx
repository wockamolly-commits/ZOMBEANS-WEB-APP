import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { DoodleBg } from "@/components/shared/DoodleBg";
import { getCurrentUser, getCustomerProfile, getSavedAddresses } from "@/lib/auth";
import { ProfileForm } from "@/components/account/ProfileForm";
import { AddressManager } from "@/components/account/AddressManager";
import { formatPeso } from "@/lib/peso";
import { createClient } from "@/lib/supabase/server";
import { getGoogleMapsBrowserKey } from "@/lib/google-maps";

export const metadata = { title: "Your account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  const profile = await getCustomerProfile();
  const addresses = await getSavedAddresses();

  const supabase = await createClient();
  const { data: settingsRow } = await supabase
    .from("app_settings")
    .select("maps_enabled, store_lat, store_lng, delivery_fee_tiers, delivery_max_km")
    .eq("id", 1)
    .single();
  const mapsApiKey = getGoogleMapsBrowserKey();
  const mapsEnabled = Boolean(settingsRow?.maps_enabled) && Boolean(mapsApiKey);
  const deliveryTiers = ((settingsRow?.delivery_fee_tiers as
    | { max_km: number; fee_cents: number }[]
    | null) ?? []).map((tier) => ({
    maxKm: tier.max_km,
    feeCents: tier.fee_cents,
  }));
  // RLS already restricts to the current user; the explicit user_id filter is
  // defense-in-depth (orders.user_id is nullable for guests, and policies are
  // OR-combined, so a future broad SELECT policy can't leak others' orders here).
  const { data: orders } = await supabase
    .from("orders")
    .select("short_code, status, total_cents, placed_at")
    .eq("user_id", user.id)
    .order("placed_at", { ascending: false });

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

          <section className="mt-6 rounded-2xl border border-zb-sage/25 bg-zb-primary-strong/75 p-6">
            <h2 className="font-display text-2xl text-zb-cream">DELIVERY ADDRESSES</h2>
            <p className="mt-1 text-sm text-zb-cream/60">Reused when you order delivery.</p>
            <div className="mt-5">
              <AddressManager
                addresses={addresses}
                mapsEnabled={mapsEnabled}
                mapsApiKey={mapsApiKey}
                storeLat={Number(settingsRow?.store_lat ?? 10.4884825)}
                storeLng={Number(settingsRow?.store_lng ?? 123.4111058)}
                deliveryTiers={deliveryTiers}
                deliveryMaxKm={Number(settingsRow?.delivery_max_km ?? 6)}
              />
            </div>
          </section>

          <section className="mt-6 rounded-2xl border border-zb-sage/25 bg-zb-primary-strong/75 p-6">
            <h2 className="font-display text-2xl text-zb-cream">YOUR ORDERS</h2>
            {!orders || orders.length === 0 ? (
              <p className="mt-3 text-sm text-zb-cream/60">
                No orders yet. <Link href="/menu" className="text-zb-bone hover:underline">Browse the menu</Link>.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-zb-sage/20">
                {orders.map((o) => (
                  <li key={o.short_code}>
                    <Link href={`/order/${o.short_code}`} className="flex items-center justify-between gap-3 py-3 transition hover:text-zb-bone">
                      <div className="min-w-0">
                        <p className="font-mono-tabular font-semibold text-zb-cream">{o.short_code}</p>
                        <p className="text-xs text-zb-cream/55">
                          {new Date(o.placed_at as string).toLocaleString("en-PH")} · {o.status}
                        </p>
                      </div>
                      <span className="font-mono-tabular text-sm text-zb-cream/85">
                        {formatPeso(o.total_cents as number)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      </DoodleBg>
      <Footer />
    </>
  );
}
