type ConfirmDeleteModalProps = {
  type: "category" | "item";
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
};

export function ConfirmDeleteModal({
  type,
  name,
  onConfirm,
  onCancel,
  busy
}: ConfirmDeleteModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-surface-2 border border-hairline rounded-2xl p-6 w-full max-w-sm shadow-2xl flex flex-col gap-3.5">
        <h2 className="text-[17px] font-bold text-parchment m-0">
          Delete {type === "category" ? "Category" : "Menu Item"}?
        </h2>
        <p className="text-[13px] text-clay m-0 leading-relaxed">
          Are you sure you want to delete <strong className="text-parchment font-semibold">{name}</strong>?
          {type === "category" && " This will remove all items in this category."}
        </p>
        <div className="flex gap-2.5 mt-2">
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="flex-1 bg-rust hover:bg-rust/90 text-parchment rounded-lg py-2.5 px-4 text-sm font-bold transition cursor-pointer disabled:opacity-55"
          >
            Delete
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="bg-transparent border border-hairline text-clay hover:text-parchment rounded-lg py-2.5 px-4 text-sm font-semibold transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
