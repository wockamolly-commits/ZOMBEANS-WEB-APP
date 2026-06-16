import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  href = "/",
  showTagline = true,
}: {
  className?: string;
  href?: string;
  showTagline?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn("flex items-center gap-2 group", className)}
      aria-label="Zombeans — home"
    >
      <Image
        src="/images/brand/zombeans-logo.png"
        alt=""
        width={40}
        height={40}
        className="size-10 shrink-0 drop-shadow-[0_0_8px_rgba(58,222,58,0.2)] transition-transform group-hover:scale-105"
        priority
      />
      <div className="flex flex-col leading-none">
        <span className="font-display text-2xl tracking-wide text-zb-cream">
          Zombeans
        </span>
        {showTagline && (
          <span className="text-[10px] font-semibold tracking-[0.18em] text-zb-cream/70">
            RISE UP FROM THE DEAD
          </span>
        )}
      </div>
    </Link>
  );
}
