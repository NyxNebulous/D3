import { ShoppingCart } from "lucide-react";
import { formatInrFromPaise } from "@d3/shared";
import type { Cart } from "../../../api/client.js";
import { CartItemRow } from "./CartItemRow.js";

type CartScreenProps = {
  cart: Cart | null;
  cartCount: number;
  cartTotal: number;
  onSetQuantity: (itemId: number, quantity: number) => void;
  onPlaceOrder: () => void;
  busy: boolean;
};

export function CartScreen({
  cart,
  cartCount,
  cartTotal,
  onSetQuantity,
  onPlaceOrder,
  busy
}: CartScreenProps) {
  return (
    <section className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="p-3.5 px-5 border-b border-hairline flex items-baseline justify-between shrink-0 bg-surface-1/40">
        <h2 className="text-xs text-clay uppercase tracking-wider font-bold">Your Cart</h2>
        <span className="text-xs text-clay font-medium">
          {cartCount} item{cartCount !== 1 ? "s" : ""}
        </span>
      </div>

      {cart && cart.items.length > 0 ? (
        <>
          <div className="flex-1 overflow-y-auto p-4 px-5">
            {cart.items.map((item) => (
              <CartItemRow
                key={item.menuItemId}
                item={item}
                onSetQuantity={onSetQuantity}
                disabled={busy}
              />
            ))}
          </div>

          <div className="p-4 px-5 border-t border-hairline shrink-0 bg-surface-1">
            <div className="flex justify-between text-[13.5px] text-clay mb-1.5">
              <span>Subtotal</span>
              <span>{formatInrFromPaise(cartTotal)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-parchment my-2.5 mb-4">
              <span>Total</span>
              <span>{formatInrFromPaise(cartTotal)}</span>
            </div>
            <button
              className="w-full bg-ember hover:bg-ember-hover active:bg-ember-deep active:scale-[0.98] text-[#1a0d06] rounded-[14px] py-3.5 px-5 text-[15px] font-bold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed"
              disabled={busy}
              onClick={onPlaceOrder}
              type="button"
            >
              Place order
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2.5 py-10 px-6 text-center flex-1">
          <div className="w-[52px] h-[52px] flex items-center justify-center rounded-2xl bg-surface-1 border border-hairline text-clay-dim">
            <ShoppingCart aria-hidden="true" size={22} />
          </div>
          <h3 className="text-[15px] font-bold text-parchment m-0">Your cart is empty</h3>
          <p className="text-[13px] text-clay max-w-[240px] m-0">
            Add items from the menu to start an order.
          </p>
        </div>
      )}
    </section>
  );
}
