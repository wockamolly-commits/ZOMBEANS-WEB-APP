import Link from "next/link";
import Image from "next/image";
import { buttonVariants } from "@/components/ui/button";
import { Coffee, Clock } from "lucide-react";
import { DoodleBg } from "@/components/shared/DoodleBg";
import { cn } from "@/lib/utils";

export function Hero() {
  return (
    <DoodleBg className="border-b border-border">
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 grid gap-10 lg:grid-cols-[1.1fr_1fr] items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-zb-sage/40 bg-zb-primary-strong/60 px-3 py-1 text-xs font-semibold tracking-widest text-zb-bone">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            OPEN NOW · 7 AM – 10 PM
          </div>
          <h1 className="font-display mt-4 text-5xl sm:text-6xl lg:text-7xl leading-[0.95] text-zb-cream">
            BREW. BRAIN.
            <br />
            <span className="text-zb-bone">BITE.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base sm:text-lg text-zb-cream/85 leading-relaxed">
            Some cafés wake you up. We bring you back to life. Premium coffee,
            matcha, rice bowls and croffles — order for{" "}
            <span className="text-zb-cream font-semibold">dine-in</span>,{" "}
            <span className="text-zb-cream font-semibold">pickup</span>, or{" "}
            <span className="text-zb-cream font-semibold">delivery</span>.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/menu"
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-12 px-6 text-base font-semibold bg-zb-bone text-zb-primary-dark hover:bg-zb-bone-soft"
              )}
            >
              Order Now
            </Link>
            <Link
              href="/menu"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-12 px-6 text-base border-zb-sage/40 bg-transparent text-zb-cream hover:bg-zb-primary-strong hover:text-zb-cream"
              )}
            >
              Browse Menu
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-zb-cream/70">
            <span className="inline-flex items-center gap-1.5"><Clock className="size-4" /> Pickup ready in ~20 min</span>
            <span className="inline-flex items-center gap-1.5"><Coffee className="size-4" /> Delivery within San Carlos</span>
          </div>
        </div>
        <div className="relative flex justify-center lg:justify-end">
          <div className="absolute inset-0 rounded-full bg-emerald-400/10 blur-3xl" aria-hidden />
          <Image
            src="/images/brand/zombeans-logo.png"
            alt=""
            width={420}
            height={420}
            className="relative size-[260px] sm:size-[320px] lg:size-[420px] drop-shadow-[0_0_60px_rgba(58,222,58,0.25)]"
            priority
          />
        </div>
      </section>
    </DoodleBg>
  );
}
