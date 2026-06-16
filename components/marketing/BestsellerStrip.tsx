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
            The Ones We&apos;ll Fight You About
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
            <div
              className="relative aspect-square overflow-hidden"
              style={{
                background:
                  "radial-gradient(circle at 50% 38%, rgba(255,248,232,0.92) 0%, rgba(237,224,214,0.58) 34%, transparent 66%), linear-gradient(145deg, #d7cdb9 0%, #b9bda5 52%, #96a386 100%)",
              }}
            >
              <div className="absolute inset-[8%] rounded-full border border-zb-primary/10 shadow-[inset_0_0_40px_rgba(255,248,232,0.2)]" aria-hidden />
              <div className="absolute inset-x-[12%] bottom-[8%] h-[10%] rounded-full bg-zb-primary-dark/20 blur-md" aria-hidden />
              <Image
                src={item.image}
                alt={item.name}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                className="object-contain drop-shadow-[0_10px_12px_rgba(30,32,22,0.2)] transition-transform duration-300 group-hover:scale-105"
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
