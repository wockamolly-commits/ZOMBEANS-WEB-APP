import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { ProductCustomizer } from "@/components/shop/ProductCustomizer";
import { ProductRecommendations } from "@/components/shop/ProductRecommendations";
import { DoodleBg } from "@/components/shared/DoodleBg";
import { Footer } from "@/components/shared/Footer";
import { Header } from "@/components/shared/Header";
import {
  findStorefrontGroup,
  getStorefrontGroupItems,
  getStorefrontMenuModel,
} from "@/lib/storefront-menu";
import { getStorefrontAvailability } from "@/lib/storefront-availability";
import { getStorefrontOptionGroups } from "@/lib/storefront-options";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/menu/[group]/[item]">) {
  const { group: groupSlug, item: itemSlug } = await params;
  const menu = await getStorefrontMenuModel();
  const group = findStorefrontGroup(menu.groups, groupSlug);
  const item =
    group &&
    getStorefrontGroupItems(group, menu.categories).find(
      (entry) => entry.slug === itemSlug
    );
  return {
    title: item?.name ?? "Menu item",
    description: item?.description,
  };
}

export default async function ProductPage({
  params,
}: PageProps<"/menu/[group]/[item]">) {
  const { group: groupSlug, item: itemSlug } = await params;
  const menu = await getStorefrontMenuModel();
  const group = findStorefrontGroup(menu.groups, groupSlug);
  const item =
    group &&
    getStorefrontGroupItems(group, menu.categories).find(
      (entry) => entry.slug === itemSlug
    );
  if (!group || !item) notFound();
  const [optionGroups, availabilityMap] = await Promise.all([
    getStorefrontOptionGroups(item.slug),
    getStorefrontAvailability([item.slug]),
  ]);
  const availability = availabilityMap.get(item.slug);
  const isAvailable = availability?.isAvailable ?? true;

  return (
    <>
      <Header />
      <DoodleBg className="flex-1">
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-10 lg:px-8">
          <Link
            href={`/menu/${group.slug}`}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-zb-cream/65 transition hover:text-zb-cream"
          >
            <ArrowLeft className="size-4" /> Back to {group.name}
          </Link>

          <div className="overflow-hidden rounded-[2rem] border border-zb-sage/30 bg-zb-primary-strong/90 shadow-[0_28px_80px_rgba(8,18,9,0.28)] backdrop-blur">
            <div className="grid lg:grid-cols-[minmax(0,0.92fr)_minmax(30rem,1.08fr)]">
              <section className="min-w-0 border-b border-zb-sage/25 p-4 sm:p-6 lg:border-b-0 lg:border-r lg:p-8">
                <div className="lg:sticky lg:top-24">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] border border-zb-sage/25 bg-[radial-gradient(circle_at_50%_36%,rgba(255,248,232,0.98)_0%,rgba(237,224,214,0.72)_38%,rgba(101,132,91,0.58)_100%)] lg:aspect-[5/4]">
                    <div className="absolute inset-x-[18%] bottom-[8%] h-[10%] rounded-full bg-zb-primary-dark/25 blur-xl" />
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      preload
                      sizes="(max-width: 1024px) 92vw, 42vw"
                      className="object-contain p-8 drop-shadow-[0_20px_24px_rgba(30,32,22,0.32)] sm:p-12"
                    />
                    {item.isBestseller && (
                      <span className="absolute left-4 top-4 inline-flex rounded-full bg-zb-bone px-3 py-1.5 text-[10px] font-bold tracking-wider text-zb-primary-dark shadow-sm">
                        ZOMBEANS BESTSELLER
                      </span>
                    )}
                  </div>

                  <ProductRecommendations currentItemSlug={item.slug} />
                </div>
              </section>

              <section className="min-w-0 p-5 sm:p-8 lg:p-10 xl:p-12">
                <div className="mb-7 border-b border-zb-sage/20 pb-7">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zb-bone">
                    {group.name}
                  </p>
                  <h1 className="mt-3 max-w-xl font-display text-4xl leading-[0.95] text-zb-cream sm:text-5xl xl:text-6xl">
                    {item.name}
                  </h1>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-zb-cream/65 sm:text-base sm:leading-7">
                    {item.description}
                  </p>
                </div>
                {isAvailable ? (
                  <ProductCustomizer
                    item={item}
                    groupSlug={group.slug}
                    optionGroups={optionGroups}
                  />
                ) : (
                  <div className="rounded-2xl border border-zb-bone/40 bg-zb-bone/10 p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-zb-bone">
                      {availability?.statusLabel ?? "Unavailable"}
                    </p>
                    <h2 className="mt-2 font-display text-3xl text-zb-cream">
                      This item is paused
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-zb-cream/65">
                      It cannot be added to cart or ordered right now. Please choose
                      another favorite from the menu.
                    </p>
                    <Link
                      href={`/menu/${group.slug}`}
                      className="mt-5 inline-flex h-11 items-center rounded-xl bg-zb-bone px-5 font-semibold text-zb-primary-dark transition hover:bg-zb-bone-soft"
                    >
                      Back to {group.name}
                    </Link>
                  </div>
                )}
              </section>
            </div>
          </div>
        </main>
      </DoodleBg>
      <Footer />
    </>
  );
}
