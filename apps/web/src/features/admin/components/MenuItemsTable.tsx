import { Pencil, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { formatInrFromPaise } from "@d3/shared";
import type { MenuCategory, MenuItem } from "../../../api/client.js";
import { VegDot } from "../../customer/components/VegDot.js";

type MenuItemsTableProps = {
  selectedCategory: MenuCategory | null;
  onAddItem: () => void;
  onEditItem: (item: MenuItem) => void;
  onDeleteItem: (itemId: number, itemName: string) => void;
};

export function MenuItemsTable({
  selectedCategory,
  onAddItem,
  onEditItem,
  onDeleteItem
}: MenuItemsTableProps) {
  if (!selectedCategory) {
    return (
      <div className="flex-1 p-6 flex flex-col items-center justify-center text-clay">
        Select a category from the sidebar
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto max-md:p-4">
      <div className="flex justify-between items-center mb-4.5">
        <h2 className="text-[17px] font-bold text-parchment break-words">
          {selectedCategory.name}
        </h2>
        <button
          className="bg-transparent border-[1.5px] border-hairline-strong hover:border-clay text-parchment rounded-lg py-2 px-3.5 text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
          onClick={onAddItem}
          type="button"
        >
          <Plus aria-hidden="true" size={15} />
          Add Item
        </button>
      </div>

      {selectedCategory.items.length > 0 ? (
        <div className="border border-hairline rounded-lg overflow-hidden">
          <div className="grid grid-cols-[minmax(0,1fr)_90px_70px_70px] max-sm:grid-cols-[minmax(0,1fr)_75px_50px_60px] gap-3 max-sm:gap-2 px-3.5 py-2.5 text-[11px] text-clay uppercase tracking-wider border-b border-hairline-strong items-center bg-surface-1">
            <span>Item</span>
            <span>Price</span>
            <span>Type</span>
            <span className="text-right">Actions</span>
          </div>

          {selectedCategory.items.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[minmax(0,1fr)_90px_70px_70px] max-sm:grid-cols-[minmax(0,1fr)_75px_50px_60px] items-center gap-3 max-sm:gap-2 p-3 px-3.5 border-b border-hairline last:border-b-0 text-[13.5px] text-parchment hover:bg-surface-1/50 transition"
            >
              <div className="min-w-0 break-words font-semibold pr-2 flex items-center gap-2">
                <VegDot isVeg={item.isVeg} />
                <span className="truncate">{item.name}</span>
              </div>
              <div className="whitespace-nowrap font-semibold">
                {formatInrFromPaise(item.pricePaise)}
              </div>
              <div>
                <span
                  className={`text-[10.5px] font-bold py-0.5 px-2 rounded-full uppercase tracking-wider ${
                    item.isVeg ? "bg-sage-bg text-sage" : "bg-rust-bg text-rust"
                  }`}
                >
                  {item.isVeg ? "Veg" : "Non-Veg"}
                </span>
              </div>
              <div className="flex items-center justify-end gap-1.5">
                <button
                  className="w-7 h-7 rounded-md border border-hairline text-clay hover:text-parchment hover:border-hairline-strong hover:bg-surface-1 flex items-center justify-center cursor-pointer transition"
                  onClick={() => onEditItem(item)}
                  title="Edit item"
                  type="button"
                >
                  <Pencil aria-hidden="true" size={13} />
                </button>
                <button
                  className="w-7 h-7 rounded-md border border-hairline text-clay hover:text-rust hover:border-rust hover:bg-rust-bg flex items-center justify-center cursor-pointer transition"
                  onClick={() => onDeleteItem(item.id, item.name)}
                  title="Delete item"
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2.5 py-12 px-6 text-center border border-dashed border-hairline rounded-lg">
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-surface-1 text-clay-dim">
            <UtensilsCrossed aria-hidden="true" size={20} />
          </div>
          <h3 className="text-sm font-bold text-parchment m-0">No items in this category</h3>
          <p className="text-xs text-clay max-w-xs m-0">
            Click &quot;Add Item&quot; above to create your first item in {selectedCategory.name}.
          </p>
        </div>
      )}
    </div>
  );
}
