import { ThemeToggle } from "../../../components/ThemeToggle.js";

type Staff = {
  id: number;
  username: string;
};

type AdminTopbarProps = {
  staff: Staff;
  activeTab: "orders" | "menu";
  onTabChange: (tab: "orders" | "menu") => void;
  onLogout: () => void;
};

export function AdminTopbar({
  staff,
  activeTab,
  onTabChange,
  onLogout
}: AdminTopbarProps) {
  return (
    <header className="flex items-center justify-between p-4 px-6 border-b border-hairline bg-ink shrink-0 gap-4 max-sm:p-3 max-sm:px-4">
      <div className="flex items-center gap-2.5">
        <button
          className="w-8 h-8 text-[13px] rounded-lg bg-ember font-extrabold text-[#1a0d06] flex items-center justify-center shrink-0"
          onClick={onLogout}
          type="button">
          D3
        </button>
        <div>
          <button
            className="text-[15px] font-bold text-parchment leading-tight"
            onClick={onLogout}
            type="button"
          >Admin</button>
        </div>
      </div>

      <nav className="flex gap-1 bg-surface-1 border border-hairline p-1 rounded-lg" aria-label="Admin navigation">
        <button
          className={`text-[13.5px] font-semibold py-2 px-4.5 rounded-md cursor-pointer transition ${activeTab === "orders" ? "bg-surface-2 text-parchment" : "text-clay hover:text-parchment"
            }`}
          onClick={() => onTabChange("orders")}
          type="button"
        >
          Orders
        </button>
        <button
          className={`text-[13.5px] font-semibold py-2 px-4.5 rounded-md cursor-pointer transition ${activeTab === "menu" ? "bg-surface-2 text-parchment" : "text-clay hover:text-parchment"
            }`}
          onClick={() => onTabChange("menu")}
          type="button"
        >
          Menu
        </button>
      </nav>

      <div className="flex items-center gap-2.5">
        <ThemeToggle size={15} className="p-1.5 rounded-lg" />
        <span className="text-xs text-clay hidden md:inline">
          <strong className="text-parchment font-semibold">{staff.username}</strong>
        </span>
        {/* <button
          className="text-xs text-clay hover:text-rust font-semibold cursor-pointer transition px-2 py-1 rounded-md hover:bg-surface-2"
          onClick={onLogout}
          type="button"
        >
          Sign out
        </button> */}
      </div>
    </header>
  );
}
