import { useState, type FormEvent } from "react";
import type { MenuCategory, MenuItem } from "../../../api/client.js";

type MenuItemFormModalProps = {
  item: MenuItem | null; // null for new item, MenuItem for editing
  categories: MenuCategory[];
  defaultCategoryId: number | null;
  onSave: (data: {
    id?: number;
    categoryId: number;
    name: string;
    pricePaise: number;
    isVeg: boolean;
  }) => Promise<void>;
  onClose: () => void;
  busy: boolean;
};

export function MenuItemFormModal({
  item,
  categories,
  defaultCategoryId,
  onSave,
  onClose,
  busy
}: MenuItemFormModalProps) {
  const [categoryId, setCategoryId] = useState<number>(
    item?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? 0
  );
  const [name, setName] = useState(item?.name ?? "");
  const [price, setPrice] = useState(
    item ? (item.pricePaise / 100).toString() : ""
  );
  const [isVeg, setIsVeg] = useState(item?.isVeg ?? true);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      setError("Please enter a valid positive price.");
      return;
    }
    if (!name.trim()) {
      setError("Item name is required.");
      return;
    }

    try {
      await onSave({
        id: item?.id,
        categoryId,
        name: name.trim(),
        pricePaise: Math.round(priceNum * 100),
        isVeg
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save item.");
    }
  }

  return (
    <div className="fixed inset-0 bg-[#08090b]/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-surface-2 border border-hairline rounded-2xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-4">
        <h2 className="text-[17px] font-bold text-parchment m-0">
          {item ? "Edit Menu Item" : "New Menu Item"}
        </h2>

        {error ? (
          <div className="p-2.5 px-3 rounded-lg bg-rust-bg text-rust text-xs font-semibold">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-clay uppercase tracking-wider" htmlFor="item-category">
              Category
            </label>
            <select
              id="item-category"
              value={categoryId}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              required
              className="w-full bg-surface-1 border border-hairline rounded-lg p-3 px-3.5 text-parchment text-sm focus:outline-none focus:border-ember transition"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-clay uppercase tracking-wider" htmlFor="item-name">
              Item Name
            </label>
            <input
              id="item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Paneer Butter Masala"
              required
              className="w-full bg-surface-1 border border-hairline rounded-lg p-3 px-3.5 text-parchment text-sm focus:outline-none focus:border-ember transition placeholder:text-clay-dim"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-clay uppercase tracking-wider" htmlFor="item-price">
              Price (₹)
            </label>
            <input
              id="item-price"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 240.00"
              required
              className="w-full bg-surface-1 border border-hairline rounded-lg p-3 px-3.5 text-parchment text-sm focus:outline-none focus:border-ember transition placeholder:text-clay-dim"
            />
          </div>

          <div className="flex items-center gap-2.5 pt-1">
            <input
              id="item-veg"
              type="checkbox"
              checked={isVeg}
              onChange={(e) => setIsVeg(e.target.checked)}
              className="w-4 h-4 rounded accent-sage cursor-pointer"
            />
            <label htmlFor="item-veg" className="text-sm font-semibold text-parchment cursor-pointer select-none">
              Vegetarian Item
            </label>
          </div>

          <div className="flex gap-2.5 mt-2">
            <button
              type="submit"
              disabled={busy}
              className="flex-1 bg-ember hover:bg-ember-hover active:bg-ember-deep text-[#1a0d06] rounded-lg py-2.5 px-4 text-sm font-bold transition cursor-pointer disabled:opacity-55"
            >
              {item ? "Save Changes" : "Create Item"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="bg-transparent border border-hairline text-clay hover:text-parchment rounded-lg py-2.5 px-4 text-sm font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
