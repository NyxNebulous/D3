import { UtensilsCrossed, Wine } from "lucide-react";

type CustomerHeaderProps = {
  customerTableText: string;
};

export function CustomerHeader({ customerTableText }: CustomerHeaderProps) {
  return (
    <header className="p-4 px-5 border-b border-hairline flex items-center justify-between gap-3 shrink-0 bg-surface-1/60 backdrop-blur-md z-10">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-ember flex items-center justify-center text-[#1a0d06] shadow-xs shrink-0">
          <UtensilsCrossed size={18} aria-hidden="true" />
        </div>
        <div>
          <div className="text-[16px] font-bold text-parchment leading-tight tracking-wider">
            D3
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 bg-surface-2 border border-hairline py-1.5 px-3 rounded-full text-xs font-semibold text-parchment shadow-xs">
        <Wine size={13} className="text-ember" aria-hidden="true" />
        <span>{customerTableText}</span>
      </div>
    </header>
  );
}
