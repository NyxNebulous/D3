import { useState, useMemo } from "react";
import {
  CakeSlice,
  ChevronDown,
  ChevronRight,
  CookingPot,
  CupSoda,
  Flame,
  Layers,
  Search,
  SlidersHorizontal,
  UtensilsCrossed,
  Wheat,
  Wine,
  X
} from "lucide-react";
import { formatInrFromPaise } from "@d3/shared";
import type { MenuCategory } from "../../../api/client.js";
import { MenuItemRow } from "./MenuItemRow.js";
import { VegDot } from "./VegDot.js";

type MenuScreenProps = {
  customerTableText: string;
  menu: MenuCategory[];
  selectedCategoryId: number | null;
  onSelectCategory: (categoryId: number | null) => void;
  cartQuantities: Map<number, number>;
  onSetQuantity: (itemId: number, quantity: number) => void;
  cartCount: number;
  cartTotal: number;
  onGoToCart: () => void;
  busy: boolean;
};

type DietaryFilter = "all" | "veg" | "non-veg";

function getCategoryIcon(name: string) {
  const lower = name.toLowerCase();
  if (
    lower.includes("main") ||
    lower.includes("curry") ||
    lower.includes("dal") ||
    lower.includes("sabzi") ||
    lower.includes("rice")
  ) {
    return CookingPot;
  }
  if (
    lower.includes("drink") ||
    lower.includes("beverage") ||
    lower.includes("juice") ||
    lower.includes("shake")
  ) {
    return CupSoda;
  }
  if (
    lower.includes("starter") ||
    lower.includes("snack") ||
    lower.includes("spicy") ||
    lower.includes("tandoor")
  ) {
    return Flame;
  }
  if (
    lower.includes("bread") ||
    lower.includes("roti") ||
    lower.includes("naan") ||
    lower.includes("kulcha") ||
    lower.includes("paratha")
  ) {
    return Wheat;
  }
  if (
    lower.includes("sweet") ||
    lower.includes("dessert") ||
    lower.includes("ice") ||
    lower.includes("cake")
  ) {
    return CakeSlice;
  }
  return UtensilsCrossed;
}

export function MenuScreen({
  customerTableText,
  menu,
  selectedCategoryId,
  onSelectCategory,
  cartQuantities,
  onSetQuantity,
  cartCount,
  cartTotal,
  onGoToCart,
  busy
}: MenuScreenProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [dietaryFilter, setDietaryFilter] = useState<DietaryFilter>("all");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Filter categories and items based on search and dietary preferences
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return menu
      .map((cat) => {
        const matchingItems = cat.items.filter((item) => {
          // Dietary filter
          if (dietaryFilter === "veg" && !item.isVeg) return false;
          if (dietaryFilter === "non-veg" && item.isVeg) return false;

          // Search query filter
          if (q && !item.name.toLowerCase().includes(q)) return false;

          return true;
        });

        return {
          ...cat,
          items: matchingItems
        };
      })
      .filter((cat) => {
        // If a specific category is chosen, only display that category (unless searching)
        if (!q && selectedCategoryId !== null && cat.id !== selectedCategoryId) {
          return false;
        }
        // When searching or filtered, only keep categories that have matching items
        return cat.items.length > 0;
      });
  }, [menu, searchQuery, dietaryFilter, selectedCategoryId]);

  const totalMatchingItems = useMemo(() => {
    return filteredCategories.reduce((sum, cat) => sum + cat.items.length, 0);
  }, [filteredCategories]);

  return (
    <section className="flex flex-col flex-1 min-h-0 overflow-hidden relative bg-ink">
      {/* Search & Dietary Filter Toolbar */}
      <div className="p-3.5 px-5 pb-2 border-b border-hairline/80 flex items-center gap-2.5 shrink-0 bg-surface-1/30">
        {/* Search Input */}
        <div className="flex-1 relative flex items-center">
          <Search
            size={16}
            className="absolute left-3 text-clay pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search dishes, drinks..."
            className="w-full bg-surface-2 border border-hairline rounded-xl pl-9 pr-8 py-2 text-sm text-parchment placeholder:text-clay-dim focus:outline-none focus:border-ember transition"
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 text-clay hover:text-parchment p-1 rounded cursor-pointer"
              title="Clear search"
              type="button"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>

        {/* Dietary Filter Dropdown / Pill */}
        <div className="relative">
          <button
            onClick={() => setShowFilterDropdown((prev) => !prev)}
            className={`flex items-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
              dietaryFilter !== "all"
                ? "bg-ember-muted border-ember text-ember-hover"
                : "bg-surface-2 border-hairline text-parchment hover:border-hairline-strong"
            }`}
            type="button"
          >
            {dietaryFilter === "veg" ? (
              <>
                <VegDot isVeg={true} />
                <span>Veg</span>
              </>
            ) : dietaryFilter === "non-veg" ? (
              <>
                <VegDot isVeg={false} />
                <span>Non-Veg</span>
              </>
            ) : (
              <>
                <SlidersHorizontal size={13} className="text-clay" />
                <span>Filter</span>
              </>
            )}
            <ChevronDown size={13} className="text-clay" />
          </button>

          {showFilterDropdown ? (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setShowFilterDropdown(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-44 bg-surface-2 border border-hairline rounded-xl p-1.5 shadow-2xl z-40 flex flex-col gap-1 text-xs">
                <button
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-left font-semibold transition ${
                    dietaryFilter === "all"
                      ? "bg-surface-3 text-parchment"
                      : "text-clay hover:bg-surface-1 hover:text-parchment"
                  }`}
                  onClick={() => {
                    setDietaryFilter("all");
                    setShowFilterDropdown(false);
                  }}
                  type="button"
                >
                  <span>All Dishes</span>
                  {dietaryFilter === "all" ? <span className="text-ember font-bold">✓</span> : null}
                </button>

                <button
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-left font-semibold transition ${
                    dietaryFilter === "veg"
                      ? "bg-surface-3 text-parchment"
                      : "text-clay hover:bg-surface-1 hover:text-parchment"
                  }`}
                  onClick={() => {
                    setDietaryFilter("veg");
                    setShowFilterDropdown(false);
                  }}
                  type="button"
                >
                  <span className="flex items-center gap-2">
                    <VegDot isVeg={true} />
                    <span>Veg Only</span>
                  </span>
                  {dietaryFilter === "veg" ? <span className="text-ember font-bold">✓</span> : null}
                </button>

                <button
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-left font-semibold transition ${
                    dietaryFilter === "non-veg"
                      ? "bg-surface-3 text-parchment"
                      : "text-clay hover:bg-surface-1 hover:text-parchment"
                  }`}
                  onClick={() => {
                    setDietaryFilter("non-veg");
                    setShowFilterDropdown(false);
                  }}
                  type="button"
                >
                  <span className="flex items-center gap-2">
                    <VegDot isVeg={false} />
                    <span>Non-Veg Only</span>
                  </span>
                  {dietaryFilter === "non-veg" ? (
                    <span className="text-ember font-bold">✓</span>
                  ) : null}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Visual Category Carousel (Cards matching reference design) */}
      {!searchQuery && (
        <div
          className="flex gap-2.5 overflow-x-auto p-3.5 px-5 shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-b border-hairline/60"
          aria-label="Menu categories"
        >
          {/* "All" Category Card */}
          <button
            className={`flex flex-col items-center justify-center p-2.5 px-3 rounded-2xl min-w-[76px] transition cursor-pointer border ${
              selectedCategoryId === null
                ? "bg-ember-muted/70 border-ember text-ember-hover shadow-xs"
                : "bg-surface-1 border-hairline text-clay hover:text-parchment hover:border-hairline-strong"
            }`}
            onClick={() => onSelectCategory(null)}
            type="button"
          >
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center mb-1.5 transition ${
                selectedCategoryId === null
                  ? "bg-ember text-[#1a0d06]"
                  : "bg-surface-2 text-clay-dim"
              }`}
            >
              <Layers size={20} aria-hidden="true" />
            </div>
            <span className="text-[11.5px] font-bold tracking-tight">All</span>
          </button>

          {/* Individual Category Cards */}
          {menu.map((category) => {
            const isSelected = selectedCategoryId === category.id;
            const IconComponent = getCategoryIcon(category.name);

            return (
              <button
                key={category.id}
                className={`flex flex-col items-center justify-center p-2.5 px-3 rounded-2xl min-w-[76px] transition cursor-pointer border ${
                  isSelected
                    ? "bg-ember-muted/70 border-ember text-ember-hover shadow-xs"
                    : "bg-surface-1 border-hairline text-clay hover:text-parchment hover:border-hairline-strong"
                }`}
                onClick={() => onSelectCategory(category.id)}
                type="button"
              >
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center mb-1.5 transition ${
                    isSelected
                      ? "bg-ember text-[#1a0d06]"
                      : "bg-surface-2 text-clay-dim"
                  }`}
                >
                  <IconComponent size={20} aria-hidden="true" />
                </div>
                <span className="text-[11.5px] font-bold tracking-tight truncate max-w-[72px]">
                  {category.name}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Menu Items Scroll Container */}
      <div className="flex-1 overflow-y-auto p-4 px-5 pb-32">
        {totalMatchingItems > 0 ? (
          filteredCategories.map((category) => (
            <div key={category.id} className="mb-6 last:mb-2">
              {/* Category Section Header with Count */}
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-hairline">
                <h3 className="text-sm font-bold text-parchment tracking-wide uppercase">
                  {category.name}{" "}
                  <span className="text-clay font-normal lowercase">
                    ({category.items.length})
                  </span>
                </h3>
              </div>

              {/* Items in Category */}
              <div className="flex flex-col">
                {category.items.map((item) => {
                  const quantity = cartQuantities.get(item.id) ?? 0;
                  return (
                    <MenuItemRow
                      key={item.id}
                      item={item}
                      quantity={quantity}
                      onSetQuantity={onSetQuantity}
                      disabled={busy}
                    />
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          /* Empty State when Search or Filter has no matches */
          <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
            <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-surface-1 border border-hairline text-clay-dim">
              <UtensilsCrossed aria-hidden="true" size={24} />
            </div>
            <h4 className="text-base font-bold text-parchment m-0">No dishes found</h4>
            <p className="text-xs text-clay max-w-xs m-0 leading-relaxed">
              {searchQuery
                ? `No items matched "${searchQuery}". Try searching with a different keyword.`
                : "No dishes match your selected filter."}
            </p>
            {(searchQuery || dietaryFilter !== "all" || selectedCategoryId !== null) && (
              <button
                className="mt-2 bg-surface-2 hover:bg-surface-3 border border-hairline text-xs font-bold text-parchment py-2 px-4 rounded-xl cursor-pointer transition"
                onClick={() => {
                  setSearchQuery("");
                  setDietaryFilter("all");
                  onSelectCategory(null);
                }}
                type="button"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Floating Cart Action Bar */}
      {cartCount > 0 ? (
        <button
          className="fixed left-1/2 -translate-x-1/2 bottom-[78px] w-[min(calc(480px-32px),calc(100%-32px))] bg-surface-2 border border-hairline-strong rounded-2xl p-3.5 px-4 flex items-center justify-between shadow-[0_-8px_24px_rgba(0,0,0,0.55)] cursor-pointer z-20 text-parchment hover:bg-surface-3 active:scale-[0.99] transition"
          onClick={onGoToCart}
          type="button"
        >
          <span className="flex items-center gap-2.5">
            <span className="bg-ember text-[#1a0d06] text-xs font-extrabold w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0">
              {cartCount}
            </span>
            <span className="text-sm font-bold text-parchment">
              {formatInrFromPaise(cartTotal)}
            </span>
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-ember flex items-center gap-1">
            View Cart
            <ChevronRight aria-hidden="true" size={15} />
          </span>
        </button>
      ) : null}
    </section>
  );
}
