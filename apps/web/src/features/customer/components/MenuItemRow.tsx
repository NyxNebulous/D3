import { formatInrFromPaise } from "@d3/shared";
import type { MenuItem } from "../../../api/client.js";
import { Stepper } from "./Stepper.js";
import { VegDot } from "./VegDot.js";

type MenuItemRowProps = {
  item: MenuItem;
  quantity: number;
  onSetQuantity: (itemId: number, quantity: number) => void;
  disabled?: boolean;
};

export function MenuItemRow({
  item,
  quantity,
  onSetQuantity,
  disabled = false
}: MenuItemRowProps) {
  return (
    <div className="flex justify-between items-center gap-4 p-4 rounded-2xl border border-hairline bg-surface-1/90 hover:bg-surface-2/70 hover:border-hairline-strong transition shadow-xs mb-3 last:mb-0">
      {/* Left Details: Veg indicator & Name aligned, with clean price below */}
      <div className="flex-1 min-w-0 pr-2">
        <div className="flex items-center gap-2 mb-1 min-w-0">
          <div className="shrink-0 flex items-center justify-center">
            <VegDot isVeg={item.isVeg} />
          </div>
          <h4 className="text-[15.5px] font-bold text-parchment leading-tight tracking-tight m-0 break-words">
            {item.name}
          </h4>
        </div>
        <div className="pl-[22px] text-[14px] font-semibold text-parchment/85 tracking-wide">
          {formatInrFromPaise(item.pricePaise)}
        </div>
      </div>

      {/* Right Action: ADD + / Stepper */}
      <div className="shrink-0 flex items-center">
        {quantity > 0 ? (
          <Stepper
            itemName={item.name}
            quantity={quantity}
            onIncrement={() => onSetQuantity(item.id, quantity + 1)}
            onDecrement={() => onSetQuantity(item.id, quantity - 1)}
            disabled={disabled}
          />
        ) : (
          <button
            className="min-w-[84px] bg-surface-1 border-[1.5px] border-ember text-ember text-xs font-bold uppercase tracking-wider py-1.5 px-4.5 rounded-full hover:bg-ember hover:text-[#1a0d06] active:scale-95 transition shadow-xs cursor-pointer disabled:opacity-50"
            aria-label={`Add ${item.name}`}
            disabled={disabled}
            onClick={() => onSetQuantity(item.id, 1)}
            type="button"
          >
            ADD +
          </button>
        )}
      </div>
    </div>
  );
}
