import { useState, type FormEvent } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import type { MenuCategory } from "../../../api/client.js";

type MenuSidebarProps = {
  categories: MenuCategory[];
  selectedCategoryId: number | null;
  onSelectCategory: (categoryId: number) => void;
  onCreateCategory: (name: string) => Promise<void>;
  onRenameCategory: (categoryId: number, newName: string) => Promise<void>;
  onDeleteCategory: (categoryId: number, name: string) => void;
  busy: boolean;
};

export function MenuSidebar({
  categories,
  selectedCategoryId,
  onSelectCategory,
  onCreateCategory,
  onRenameCategory,
  onDeleteCategory,
  busy
}: MenuSidebarProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [renamingCategory, setRenamingCategory] = useState<MenuCategory | null>(null);
  const [renameValue, setRenameValue] = useState("");

  async function handleAddSubmit(e: FormEvent) {
    e.preventDefault();
    if (!newCatName.trim()) return;
    await onCreateCategory(newCatName.trim());
    setNewCatName("");
    setShowAddForm(false);
  }

  async function handleRenameSubmit(e: FormEvent) {
    e.preventDefault();
    if (!renamingCategory || !renameValue.trim()) return;
    await onRenameCategory(renamingCategory.id, renameValue.trim());
    setRenamingCategory(null);
    setRenameValue("");
  }

  return (
    <aside className="w-[250px] max-md:w-full border-r max-md:border-r-0 max-md:border-b border-hairline p-4.5 flex flex-col gap-2 shrink-0 overflow-y-auto">
      <div className="text-[11px] text-clay uppercase tracking-wider font-bold my-0.5 mb-2">
        Categories
      </div>

      <div className="flex flex-col max-md:flex-row gap-1.5 max-md:overflow-x-auto max-md:pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {categories.map((category) => {
          const isActive = category.id === selectedCategoryId;
          const isRenaming = renamingCategory?.id === category.id;

          if (isRenaming) {
            return (
              <form
                key={category.id}
                onSubmit={handleRenameSubmit}
                className="flex items-center gap-1.5 p-1 px-2 rounded-lg bg-surface-2 border border-ember"
              >
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="w-full bg-surface-1 text-parchment text-xs px-2 py-1 rounded border border-hairline focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="p-1 text-sage hover:bg-sage-bg rounded cursor-pointer"
                  title="Save"
                >
                  <Check size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setRenamingCategory(null)}
                  className="p-1 text-clay hover:bg-surface-3 rounded cursor-pointer"
                  title="Cancel"
                >
                  <X size={14} />
                </button>
              </form>
            );
          }

          return (
            <div
              key={category.id}
              className={`flex items-center justify-between gap-1.5 rounded-lg p-1 px-2.5 transition max-md:shrink-0 max-md:border max-md:border-hairline ${
                isActive ? "bg-surface-2" : "hover:bg-surface-1"
              }`}
            >
              <button
                className={`flex-1 min-w-0 flex items-center justify-between gap-2 bg-transparent border-none py-1.5 text-left text-[13.5px] font-semibold cursor-pointer ${
                  isActive ? "text-parchment" : "text-clay hover:text-parchment"
                }`}
                onClick={() => onSelectCategory(category.id)}
                type="button"
              >
                <span className="min-w-0 break-words line-clamp-1">{category.name}</span>
                <span className="text-xs text-clay-dim shrink-0">{category.items.length}</span>
              </button>

              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  className="p-1 text-clay-dim hover:text-parchment hover:bg-surface-3 rounded cursor-pointer transition"
                  onClick={() => {
                    setRenamingCategory(category);
                    setRenameValue(category.name);
                  }}
                  title="Rename category"
                  type="button"
                >
                  <Pencil aria-hidden="true" size={13} />
                </button>
                <button
                  className="p-1 text-clay-dim hover:text-rust hover:bg-rust-bg rounded cursor-pointer transition"
                  onClick={() => onDeleteCategory(category.id, category.name)}
                  title="Delete category"
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2">
        {showAddForm ? (
          <form
            onSubmit={handleAddSubmit}
            className="flex flex-col gap-2 bg-surface-1 border border-hairline p-2.5 rounded-lg"
          >
            <input
              autoFocus
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="Category name"
              required
              className="w-full bg-surface-2 border border-hairline rounded p-2 text-parchment text-xs focus:outline-none focus:border-ember"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="flex-1 bg-ember hover:bg-ember-hover text-[#1a0d06] text-xs font-bold py-1.5 px-3 rounded cursor-pointer transition"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="bg-transparent border border-hairline text-clay hover:text-parchment text-xs font-semibold py-1.5 px-3 rounded cursor-pointer transition"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            className="bg-transparent border border-dashed border-hairline-strong hover:border-clay text-clay hover:text-parchment text-[13px] font-semibold p-2.5 rounded-lg cursor-pointer flex items-center justify-center gap-1.5 w-full transition"
            onClick={() => setShowAddForm(true)}
            type="button"
          >
            <Plus aria-hidden="true" size={15} />
            Add Category
          </button>
        )}
      </div>
    </aside>
  );
}
