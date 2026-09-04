import { Grid2x2, Home, ReceiptText, ShoppingCart } from "lucide-react";

export type CustomerScreen = "landing" | "auth" | "home" | "menu" | "cart" | "orders";

type CustomerBottomNavProps = {
  activeScreen: CustomerScreen;
  cartCount: number;
  onSelectScreen: (screen: "home" | "menu" | "cart" | "orders") => void;
};

export function CustomerBottomNav({
  activeScreen,
  cartCount,
  onSelectScreen
}: CustomerBottomNavProps) {
  return (
    <nav
      className="flex border-t border-hairline bg-surface-1 py-2 px-2 pb-[max(12px,env(safe-area-inset-bottom))] shrink-0 z-10"
      aria-label="Primary"
    >
      <button
        className={`flex-1 flex flex-col items-center gap-1 bg-transparent border-none py-1.5 cursor-pointer transition ${
          activeScreen === "home" ? "text-ember" : "text-clay-dim hover:text-parchment"
        }`}
        onClick={() => onSelectScreen("home")}
        type="button"
      >
        <Home aria-hidden="true" size={21} />
        <span className="text-[10.5px] font-semibold">Home</span>
      </button>

      <button
        className={`flex-1 flex flex-col items-center gap-1 bg-transparent border-none py-1.5 cursor-pointer transition ${
          activeScreen === "menu" ? "text-ember" : "text-clay-dim hover:text-parchment"
        }`}
        onClick={() => onSelectScreen("menu")}
        type="button"
      >
        <Grid2x2 aria-hidden="true" size={21} />
        <span className="text-[10.5px] font-semibold">Menu</span>
      </button>

      <button
        className={`flex-1 flex flex-col items-center gap-1 bg-transparent border-none py-1.5 cursor-pointer transition ${
          activeScreen === "cart" ? "text-ember" : "text-clay-dim hover:text-parchment"
        }`}
        onClick={() => onSelectScreen("cart")}
        type="button"
      >
        <span className="relative inline-flex">
          <ShoppingCart aria-hidden="true" size={21} />
          {cartCount > 0 ? (
            <span className="absolute -top-1 -right-2 bg-ember text-[#1a0d06] text-[9px] font-extrabold w-[15px] h-[15px] rounded-full flex items-center justify-center">
              {cartCount}
            </span>
          ) : null}
        </span>
        <span className="text-[10.5px] font-semibold">Cart</span>
      </button>

      <button
        className={`flex-1 flex flex-col items-center gap-1 bg-transparent border-none py-1.5 cursor-pointer transition ${
          activeScreen === "orders" ? "text-ember" : "text-clay-dim hover:text-parchment"
        }`}
        onClick={() => onSelectScreen("orders")}
        type="button"
      >
        <ReceiptText aria-hidden="true" size={21} />
        <span className="text-[10.5px] font-semibold">Orders</span>
      </button>
    </nav>
  );
}
