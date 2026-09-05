import { Bell, FireExtinguisher, FireExtinguisherIcon, Flame, FlameIcon, FlameKindling, Grid2x2, Heart, ReceiptText, ShoppingCart } from "lucide-react";
import { formatInrFromPaise } from "@d3/shared";
import type { MenuCategory, Order, SessionContext } from "../../../api/client.js";
import { ThemeToggle } from "../../../components/ThemeToggle.js";

type HomeScreenProps = {
  session: SessionContext | null;
  customerTableText: string;
  tableShortLabel: string;
  menu: MenuCategory[];
  cartCount: number;
  cartTotal: number;
  orders: Order[];
  onNavigate: (screen: "menu" | "cart" | "orders") => void;
};

export function HomeScreen({
  session,
  customerTableText,
  tableShortLabel,
  menu,
  cartCount,
  cartTotal,
  orders,
  onNavigate
}: HomeScreenProps) {
  const totalMenuItems = menu.reduce((n, c) => n + c.items.length, 0);

  return (
    <section className="flex flex-col flex-1 min-h-0 overflow-y-auto p-5 pb-2.5 overscroll-contain">
      <div className="flex items-start justify-between py-3 pb-4 gap-4">
        <div>
          <div className="text-[24px] font-bold text-parchment mb-1">
            <div className="flex items-center gap-2">
              Hi! {session?.customer.name.split(" ")[0] ?? "there"} <Flame aria-hidden="true" size={28} />
            </div>
          </div>
          <div className="text-[14px] text-clay uppercase tracking-wider">
            {customerTableText}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle size={14} className="p-1.5 rounded-full" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5 pb-6">
        <button
          className="bg-surface-1 border border-hairline hover:bg-surface-2 hover:border-hairline-strong rounded-2xl p-5.5 px-5 flex flex-col justify-between gap-3.5 text-left text-parchment cursor-pointer transition min-h-[160px] active:scale-[0.98]"
          onClick={() => onNavigate("menu")}
          type="button"
        >
          <span className="w-12 h-12 rounded-xl bg-ember-muted text-ember flex items-center justify-center shrink-0">
            <Grid2x2 aria-hidden="true" size={24} />
          </span>
          <div>
            <div className="text-base font-bold text-parchment mb-1">Menu</div>
            <div className="text-[12.5px] text-clay leading-snug">
              {menu.length > 0
                ? `${totalMenuItems} items across ${menu.length} ${menu.length === 1 ? "category" : "categories"}`
                : "Browse our menu"}
            </div>
          </div>
        </button>

        <button
          className="bg-surface-1 border border-hairline hover:bg-surface-2 hover:border-hairline-strong rounded-2xl p-5.5 px-5 flex flex-col justify-between gap-3.5 text-left text-parchment cursor-pointer transition min-h-[160px] active:scale-[0.98]"
          onClick={() => onNavigate("cart")}
          type="button"
        >
          <span className="w-12 h-12 rounded-xl bg-ember-muted text-ember flex items-center justify-center shrink-0">
            <ShoppingCart aria-hidden="true" size={24} />
          </span>
          <div>
            <div className="text-base font-bold text-parchment mb-1">Cart</div>
            <div className="text-[12.5px] text-clay leading-snug">
              {cartCount > 0
                ? `${cartCount} item${cartCount > 1 ? "s" : ""} · ${formatInrFromPaise(cartTotal)}`
                : "Empty"}
            </div>
          </div>
        </button>

        <button
          className="bg-surface-1 border border-hairline hover:bg-surface-2 hover:border-hairline-strong rounded-2xl p-5.5 px-5 flex flex-col justify-between gap-3.5 text-left text-parchment cursor-pointer transition min-h-[160px] active:scale-[0.98]"
          onClick={() => onNavigate("orders")}
          type="button"
        >
          <span className="w-12 h-12 rounded-xl bg-ember-muted text-ember flex items-center justify-center shrink-0">
            <ReceiptText aria-hidden="true" size={24} />
          </span>
          <div>
            <div className="text-base font-bold text-parchment mb-1">Orders</div>
            <div className="text-[12.5px] text-clay leading-snug">
              {orders.length > 0
                ? `${orders.length} active order${orders.length > 1 ? "s" : ""}`
                : "No orders yet"}
            </div>
          </div>
        </button>

        <button
          className="bg-surface-1 border border-hairline rounded-2xl p-5.5 px-5 flex flex-col justify-between gap-3.5 text-left text-parchment opacity-55 cursor-not-allowed min-h-[160px]"
          type="button"
          disabled
        >
          <span className="w-12 h-12 rounded-xl bg-ember-muted text-ember flex items-center justify-center shrink-0">
            <Bell aria-hidden="true" size={24} />
          </span>
          <div>
            <div className="text-base font-bold text-parchment mb-1">Call staff</div>
            <div className="text-[12.5px] text-clay leading-snug">Request assistance</div>
          </div>
        </button>
      </div>

      {/* Engraved Morse Code: "made by nyx" */}
      <div className="flex-1 flex flex-col items-center justify-center select-none">
        <span
          className="font-mono text-[12px] font-semibold tracking-[0.32em] text-clay/15 hover:text-parchment/80 transition-colors cursor-default"
        >
          &nbsp;&nbsp; __ ·_ _·· · &nbsp;&nbsp; _··· _·__ &nbsp;&nbsp; 
        </span>
        <span
          className="font-mono text-[12px] font-semibold tracking-[0.32em] text-clay/15 hover:text-parchment/80 transition-colors cursor-default"
        >
          &nbsp;&nbsp; _· _·__ _··_ &nbsp;&nbsp; 
        </span>
        <Heart className="mt-2 text-clay/5"/>
      </div>
    </section>
  );
}
