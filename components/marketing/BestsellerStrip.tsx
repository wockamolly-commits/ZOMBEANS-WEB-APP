import Link from "next/link";
import Image from "next/image";
import { getBestsellers, getDefaultPriceCents } from "@/lib/menu-static";
import { PesoPrice } from "@/components/shared/PesoPrice";

export function BestsellerStrip() {
  const bestsellers = getBestsellers(6);
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-zb-bone">BESTSELLERS</p>
          <h2 className="font-display text-3xl sm:text-4xl text-zb-cream mt-1">
            The Ones We'll Fight You About
          </h2>
        </div>
        <Link href="/menu" className="hidden sm:inline text-sm text-zb-cream/80 hover:text-zb-cream">
          See all →
        </Link>
      </div>
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {bestsellers.map((item) => (
          <Link
            key={item.slug}
            href={`/menu/best-sellers/${item.slug}`}
            className="group rounded-2xl border border-border bg-card overflow-hidden transition hover:border-zb-bone/60"
          >
            <div className="aspect-square bg-zb-cream relative">
              <Image
                src={item.image}
                alt={item.name}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                className="object-contain p-3 transition-transform group-hover:scale-105"
              />
            </div>
            <div className="p-3">
              <p className="text-sm font-semibold text-zb-cream leading-tight line-clamp-2">{item.name}</p>
              <p className="mt-1">
                <PesoPrice cents={getDefaultPriceCents(item)} size="sm" />
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
