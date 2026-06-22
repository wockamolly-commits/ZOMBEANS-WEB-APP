"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { PesoPrice } from "@/components/shared/PesoPrice";
import {
  CART_UPDATED_EVENT,
  readCart,
} from "@/lib/cart";
import { getDefaultPriceCents } from "@/lib/menu-static";
import {
  getProductRecommendations,
  type ProductRecommendation,
} from "@/lib/recommendations";

function RecommendationCard({
  recommendation,
}: {
  recommendation: ProductRecommendation;
}) {
  const { item, groupSlug, reason } = recommendation;

  return (
    <Link
      href={`/menu/${groupSlug}/${item.slug}`}
      className="group grid min-w-[16rem] grid-cols-[4.25rem_1fr] gap-3 rounded-2xl border border-zb-sage/25 bg-zb-primary-strong/60 p-2.5 transition hover:-translate-y-0.5 hover:border-zb-bone/55 hover:bg-zb-primary-strong/90 sm:min-w-0"
    >
      <div className="relative aspect-square overflow-hidden rounded-xl bg-zb-cream/90">
        <Image
          src={item.image}
          alt={item.name}
          fill
          sizes="68px"
          className="object-contain p-1.5 transition group-hover:scale-105"
        />
      </div>
      <div className="min-w-0 self-center">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold text-zb-cream">
            {item.name}
          </p>
          <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-zb-cream/35 transition group-hover:text-zb-bone" />
        </div>
        <div className="mt-1.5 text-sm">
          <PesoPrice cents={getDefaultPriceCents(item)} />
        </div>
        <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-zb-bone/75">
          {reason}
        </p>
      </div>
    </Link>
  );
}

export function ProductRecommendations({
  currentItemSlug,
}: {
  currentItemSlug: string;
}) {
  const [recommendations, setRecommendations] = useState(() =>
    getProductRecommendations([currentItemSlug], 4)
  );

  useEffect(() => {
    function refreshRecommendations() {
      const orderSlugs = readCart().map((line) => line.itemSlug);
      setRecommendations(
        getProductRecommendations(
          Array.from(new Set([...orderSlugs, currentItemSlug])),
          4
        )
      );
    }

    refreshRecommendations();
    window.addEventListener(CART_UPDATED_EVENT, refreshRecommendations);
    window.addEventListener("storage", refreshRecommendations);

    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, refreshRecommendations);
      window.removeEventListener("storage", refreshRecommendations);
    };
  }, [currentItemSlug]);

  if (!recommendations.length) return null;

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zb-bone">
            Goes well with your order
          </p>
          <h2 className="mt-1 font-display text-2xl text-zb-cream">
            YOU MIGHT ALSO LIKE
          </h2>
        </div>
        <Link
          href="/menu"
          className="shrink-0 text-xs font-semibold text-zb-bone hover:underline"
        >
          Explore menu
        </Link>
      </div>
      <div className="recommendation-rail -mx-1 flex gap-3 overflow-x-auto px-1 pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-1 xl:grid-cols-2">
        {recommendations.map((recommendation) => (
          <RecommendationCard
            key={recommendation.item.slug}
            recommendation={recommendation}
          />
        ))}
      </div>
    </div>
  );
}
