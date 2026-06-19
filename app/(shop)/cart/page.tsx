import { CartView } from "@/components/shop/CartView";
import { KitchenClosingBanner } from "@/components/shop/KitchenClosingBanner";
import { DoodleBg } from "@/components/shared/DoodleBg";
import { Footer } from "@/components/shared/Footer";
import { Header } from "@/components/shared/Header";

export const metadata = { title: "Your Cart" };

export default function CartPage() {
  return (
    <>
      <Header />
      <DoodleBg className="flex-1">
        <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zb-bone">
              Your order
            </p>
            <h1 className="mt-2 font-display text-5xl text-zb-cream sm:text-6xl">
              CART
            </h1>
          </div>
          <KitchenClosingBanner />
          <CartView />
        </main>
      </DoodleBg>
      <Footer />
    </>
  );
}
