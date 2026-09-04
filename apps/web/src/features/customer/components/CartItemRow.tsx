import { formatInrFromPaise } from "@d3/shared";
import type { CartItem } from "../../../api/client.js";
import { Stepper } from "./Stepper.js";

type CartItemRowProps = {
  item: CartItem;
  onSetQuantity: (itemId: number, quantity: number) => void;
  disabled?: boolean;
};

export function CartItemRow({
  item,
  onSetQuantity,
  disabled = false
}: CartItemRowProps) {
  return (
    <div className="flex justify-between items-center gap-3 p-3.5 px-4 rounded-2xl border border-hairline bg-surface-1 hover:bg-surface-2 transition shadow-xs mb-2.5 last:mb-0">
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-semibold tracking-tight text-parchment mb-1 break-words">
          {item.name}
        </div>
        <div className="text-xs text-clay font-medium">
          {item.quantity} × {formatInrFromPaise(item.unitPricePaise)}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <Stepper
          itemName={item.name}
          quantity={item.quantity}
          onIncrement={() => onSetQuantity(item.menuItemId, item.quantity + 1)}
          onDecrement={() => onSetQuantity(item.menuItemId, item.quantity - 1)}
          disabled={disabled}
        />
        <div className="min-w-[72px] text-right text-[14px] font-bold text-parchment">
          {formatInrFromPaise(item.lineTotalPaise)}
        </div>
      </div>
    </div>
  );
}
