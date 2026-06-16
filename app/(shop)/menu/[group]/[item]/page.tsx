import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { ProductCustomizer } from "@/components/shop/ProductCustomizer";
import { DoodleBg } from "@/components/shared/DoodleBg";
import { Footer } from "@/components/shared/Footer";
import { Header } from "@/components/shared/Header";
import {
  MENU_GROUPS,
  findGroup,
  getGroupItems,
} from "@/lib/menu-static";

export function generateStaticParams() {
  return MENU_GROUPS.flatMap((group) =>
    getGroupItems(group).map((item) => ({
      group: group.slug,
      item: item.slug,
    }))
  );
}

export async function generateMetadata({
  params,
}: PageProps<"/menu/[group]/[item]">) {
  const { group: groupSlug, item: itemSlug } = await params;
  const group = findGroup(groupSlug);
  const item = group && getGroupItems(group).find((entry) => entry.slug === itemSlug);
  return {
    title: item?.name ?? "Menu item",
    description: item?.description,
  };
}

export default async function ProductPage({
  params,
}: PageProps<"/menu/[group]/[item]">) {
  const { group: groupSlug, item: itemSlug } = await params;
  const group = findGroup(groupSlug);
  const item = group && getGroupItems(group).find((entry) => entry.slug === itemSlug);
  if (!group || !item) notFound();

  return (
    <>
      <Header />
      <DoodleBg className="flex-1">
        <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 md:grid-cols-2 md:gap-12 md:py-14 lg:px-8">
          <section>
            <Link
              href={`/menu/${group.slug}`}
              className="mb-5 inline-flex items-center gap-1.5 text-sm text-zb-cream/70 transition hover:text-zb-cream"
            >
              <ArrowLeft className="size-4" /> Back to {group.name}
            </Link>
            <div className="relative aspect-square overflow-hidden rounded-3xl border border-zb-sage/30 bg-[radial-gradient(circle_at_50%_38%,rgba(255,248,232,0.95)_0%,rgba(237,224,214,0.6)_35%,rgba(101,132,91,0.5)_100%)]">
              <div className="absolute inset-x-[12%] bottom-[8%] h-[10%] rounded-full bg-zb-primary-dark/20 blur-xl" />
              <Image
                src={item.image}
                alt={item.name}
                fill
                priority
                sizes="(max-width: 768px) 92vw, 46vw"
                className="object-contain p-6 drop-shadow-[0_18px_20px_rgba(30,32,22,0.3)] sm:p-10"
              />
            </div>
          </section>

          <section className="self-center rounded-3xl border border-zb-sage/25 bg-zb-primary/85 p-5 backdrop-blur sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zb-bone">
              {group.name}
            </p>
            <h1 className="mt-3 font-display text-4xl leading-none text-zb-cream sm:text-6xl">
              {item.name}
            </h1>
            {item.isBestseller && (
              <span className="mt-4 inline-flex rounded-full bg-zb-bone px-3 py-1 text-[10px] font-bold tracking-wider text-zb-primary-dark">
                ZOMBEANS BESTSELLER
              </span>
            )}
            <p className="mb-8 mt-5 text-base leading-7 text-zb-cream/75">
              {item.description}
            </p>
            <ProductCustomizer item={item} groupSlug={group.slug} />
          </section>
        </main>
      </DoodleBg>
      <Footer />
    </>
  );
}
