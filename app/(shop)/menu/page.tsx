import Link from "next/link";
import Image from "next/image";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { DoodleBg } from "@/components/shared/DoodleBg";
import { KitchenClosingBanner } from "@/components/shop/KitchenClosingBanner";
import { StoreClosedNotice } from "@/components/shop/StoreClosedNotice";
import { MENU_GROUPS, getGroupItems } from "@/lib/menu-static";

export const metadata = { title: "Our Menu" };
export const dynamic = "force-dynamic";

export default function MenuLandingPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <DoodleBg className="min-h-[calc(100vh-4rem)]">
          <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-10 text-center">
            <p className="text-xs font-semibold tracking-[0.25em] text-zb-bone uppercase">
              The Zombeans collection
            </p>
            <h1 className="font-display mt-3 text-5xl sm:text-7xl text-zb-cream leading-none">
              OUR MENU
            </h1>
            <p className="mt-4 text-sm sm:text-base tracking-[0.18em] text-zb-cream/80 uppercase">
              Pick a card to begin
            </p>
          </section>

          <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-24 space-y-8">
            <StoreClosedNotice />
            <KitchenClosingBanner />
            <div className="grid gap-5 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {MENU_GROUPS.map((group) => {
                const count = getGroupItems(group).length;
                return (
                  <Link
                    key={group.slug}
                    href={`/menu/${group.slug}`}
                    className="group relative aspect-[3/4] rounded-3xl overflow-hidden transition-transform hover:-translate-y-1"
                  >
                    {/* Outer trading-card frame — thick sage border */}
                    <div className="absolute inset-0 rounded-3xl border-[3px] border-zb-sage/70 bg-zb-primary-strong shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)] transition group-hover:border-zb-bone group-hover:shadow-[0_15px_40px_-12px_rgba(229,192,123,0.35)]" />

                    {/* Tiled themed pattern */}
                    <div
                      className="absolute inset-[3px] rounded-[calc(1.5rem-3px)] overflow-hidden bg-zb-primary"
                      aria-hidden
                    >
                      <div
                        className="absolute inset-0 opacity-[0.22] group-hover:opacity-30 transition"
                        style={{
                          backgroundImage: `url(${group.patternImage})`,
                          backgroundRepeat: "repeat",
                          backgroundSize: "150px 150px",
                        }}
                      />
                      {/* Vertical gradient overlay so bottom text stays readable */}
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-zb-primary-dark/85" />
                    </div>

                    {/* Inner hairline border — the "card window" */}
                    <div
                      className="absolute inset-3 rounded-2xl border border-zb-sage/40 pointer-events-none"
                      aria-hidden
                    />

                    {/* Card content */}
                    <div className="relative h-full flex flex-col items-center p-5 sm:p-6">
                      {/* Top kind pill */}
                      <div className="rounded-full border border-zb-sage/50 bg-zb-primary-dark/70 px-3 py-1 text-[10px] font-bold tracking-[0.2em] text-zb-bone uppercase">
                        {group.kind}
                      </div>

                      {/* Centerpiece product photo */}
                      <div className="relative flex-1 w-full mt-4 mb-3">
                        <Image
                          src={group.previewImage}
                          alt=""
                          fill
                          sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 24vw"
                          className="object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition-transform group-hover:scale-105"
                        />
                      </div>

                      {/* Bottom label band */}
                      <div className="w-full text-center">
                        <h2 className="font-display text-2xl sm:text-3xl text-zb-cream leading-tight">
                          {group.name.toUpperCase()}
                        </h2>
                        <p className="mt-1 text-xs text-zb-cream/70">
                          {group.blurb}
                        </p>
                        <div className="mt-3 flex items-center justify-center gap-2">
                          <span className="font-mono-tabular text-[10px] tracking-wider text-zb-bone/90 uppercase">
                            {count} items
                          </span>
                          <span className="h-px w-6 bg-zb-sage/40" />
                          <span className="text-[10px] font-semibold tracking-[0.18em] text-zb-bone uppercase group-hover:underline underline-offset-4">
                            View →
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        </DoodleBg>
      </main>
      <Footer />
    </>
  );
}
