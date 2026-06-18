import Link from "next/link";
import { Logo } from "./Logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CartLink } from "@/components/shop/CartLink";
import { AuthNav } from "./AuthNav";

export function Header() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-zb-primary/85 bg-zb-primary border-b border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Logo />
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-zb-cream/85">
            <Link href="/menu" className="px-3 py-2 rounded-md hover:text-zb-cream hover:bg-zb-primary-strong transition">
              Menu
            </Link>
            <Link href="/about" className="px-3 py-2 rounded-md hover:text-zb-cream hover:bg-zb-primary-strong transition">
              About
            </Link>
            <Link href="/contact" className="px-3 py-2 rounded-md hover:text-zb-cream hover:bg-zb-primary-strong transition">
              Contact
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <AuthNav />
            <CartLink />
            <Link
              href="/menu"
              className={cn(
                buttonVariants(),
                "h-10 px-4 font-semibold bg-zb-bone text-zb-primary-dark hover:bg-zb-bone-soft"
              )}
            >
              Order Now
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
