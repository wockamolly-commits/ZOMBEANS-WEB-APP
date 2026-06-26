import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { DoodleBg } from "@/components/shared/DoodleBg";
import { PesoPrice } from "@/components/shared/PesoPrice";
import {
  findGroup,
  getGroupCategories,
  getGroupItems,
  getDefaultPriceCents,
  MENU_GROUPS,
  type StaticItem,
} from "@/lib/menu-static";
import {
  getStorefrontAvailability,
  type StorefrontAvailability,
} from "@/lib/storefront-availability";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return MENU_GROUPS.map((g) => ({ group: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ group: string }>;
}) {
  const { group: slug } = await params;
  const group = findGroup(slug);
  return { title: group?.name ?? "Menu" };
}

function ItemCard({
  item,
  groupSlug,
  availability,
}: {
  item: StaticItem;
  groupSlug: string;
  availability?: StorefrontAvailability;
}) {
  const isAvailable = availability?.isAvailable ?? true;
  const content = (
    <>
      <div
        className="relative aspect-square overflow-hidden"
        style={{
          background:
            "radial-gradient(circle at 50% 38%, rgba(255,248,232,0.92) 0%, rgba(237,224,214,0.58) 34%, transparent 66%), linear-gradient(145deg, #d7cdb9 0%, #b9bda5 52%, #96a386 100%)",
        }}
      >
        {!isAvailable && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-zb-primary-dark/72 px-3 text-center backdrop-blur-[2px]">
            <span className="rounded-full border border-zb-bone/55 bg-zb-primary px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-zb-bone">
              {availability?.statusLabel ?? "Unavailable"}
            </span>
          </div>
        )}
        <div className="absolute inset-[8%] rounded-full border border-zb-primary/10 shadow-[inset_0_0_40px_rgba(255,248,232,0.2)]" aria-hidden />
        <div className="absolute inset-x-[12%] bottom-[8%] h-[10%] rounded-full bg-zb-primary-dark/20 blur-md" aria-hidden />
        <Image
          src={item.image}
          alt={item.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-contain drop-shadow-[0_12px_14px_rgba(30,32,22,0.22)] transition-transform duration-300 group-hover:scale-105"
        />
        {item.isBestseller && (
          <span className="absolute top-2 left-2 rounded-full bg-zb-bone text-zb-primary-dark text-[10px] font-bold tracking-wider px-2 py-0.5">
            BESTSELLER
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="font-semibold text-zb-cream leading-tight">{item.name}</p>
        <p className="text-xs text-zb-cream/65 mt-0.5 line-clamp-2">
          {item.description}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <PesoPrice cents={getDefaultPriceCents(item)} />
          {!isAvailable ? (
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-zb-bone">
              Paused
            </span>
          ) : item.variations.length > 1 && (
            <span className="text-[10px] text-zb-cream/55 font-mono-tabular">
              {item.variations.length} sizes
            </span>
          )}
        </div>
      </div>
    </>
  );

  if (!isAvailable) {
    return (
      <div className="overflow-hidden rounded-2xl border border-zb-bone/40 bg-card/75 opacity-85">
        {content}
      </div>
    );
  }

  return (
    <Link
      href={`/menu/${groupSlug}/${item.slug}`}
      className="group overflow-hidden rounded-2xl border border-border bg-card transition hover:border-zb-bone/60"
    >
      {content}
    </Link>
  );
}

export default async function MenuGroupPage({
  params,
}: {
  params: Promise<{ group: string }>;
}) {
  const { group: slug } = await params;
  const group = findGroup(slug);
  if (!group) notFound();

  const categories = getGroupCategories(group);
  const flatItems = getGroupItems(group);
  const availability = await getStorefrontAvailability(
    flatItems.map((item) => item.slug)
  );

  return (
    <>
      <Header />
      <DoodleBg className="flex-1">
      <main>
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8 pb-2">
          <Link
            href="/menu"
            className="inline-flex items-center gap-1.5 text-sm text-zb-cream/70 hover:text-zb-cream transition"
          >
            <ArrowLeft className="size-4" /> All categories
          </Link>
        </section>
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-4 pb-6">
          <p className="text-xs font-semibold tracking-[0.2em] text-zb-bone uppercase">
            Menu · {group.name}
          </p>
          <h1 className="font-display text-4xl sm:text-5xl text-zb-cream mt-2">
            {group.name.toUpperCase()}
          </h1>
          <p className="mt-2 text-zb-cream/75 max-w-2xl">{group.blurb}</p>
          <p className="mt-1 text-sm text-zb-cream/55 font-mono-tabular">
            {flatItems.length} items
          </p>
        </section>

        {/* Best Sellers: single flat grid */}
        {group.bestsellersOnly && (
          <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {flatItems.map((item) => (
                <ItemCard
                  key={item.slug}
                  item={item}
                  groupSlug={group.slug}
                  availability={availability.get(item.slug)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Category-grouped layout */}
        {!group.bestsellersOnly && categories.length > 0 && (
          <>
            {/* Sticky in-group category jump nav */}
            <div className="sticky top-16 z-30 border-y border-border bg-zb-primary/95 backdrop-blur supports-[backdrop-filter]:bg-zb-primary/85">
              <nav
                className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 flex gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                aria-label="Subcategories"
              >
                {categories.map((cat) => (
                  <a
                    key={cat.slug}
                    href={`#${cat.slug}`}
                    className="shrink-0 rounded-full border border-zb-sage/40 bg-zb-primary-strong/70 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-zb-cream/85 hover:bg-zb-bone hover:text-zb-primary-dark hover:border-zb-bone transition"
                  >
                    {cat.name}
                  </a>
                ))}
              </nav>
            </div>

            {categories.map((cat, idx) => (
              <section
                key={cat.slug}
                id={cat.slug}
                className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 scroll-mt-32"
              >
                <div className="flex items-end justify-between gap-4 mb-5">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.2em] text-zb-bone">
                      {String(idx + 1).padStart(2, "0")}
                    </p>
                    <h2 className="font-display text-3xl sm:text-4xl text-zb-cream mt-0.5">
                      {cat.name}
                    </h2>
                  </div>
                  <p className="text-xs text-zb-cream/55 font-mono-tabular">
                    {cat.items.length}{" "}
                    {cat.items.length === 1 ? "item" : "items"}
                  </p>
                </div>
                <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                  {cat.items.map((item) => (
                    <ItemCard
                      key={item.slug}
                      item={item}
                      groupSlug={group.slug}
                      availability={availability.get(item.slug)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </main>
      </DoodleBg>
      <Footer />
    </>
  );
}
