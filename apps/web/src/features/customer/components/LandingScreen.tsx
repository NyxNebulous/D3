import { ArrowRight } from "lucide-react";
import { ThemeToggle } from "../../../components/ThemeToggle.js";

type LandingScreenProps = {
  customerTableText: string;
  onProceed: () => void;
};

export function LandingScreen({ customerTableText, onProceed }: LandingScreenProps) {
  return (
    <section className="flex flex-col flex-1 min-h-dvh justify-center items-center overflow-y-auto bg-[radial-gradient(circle_at_30%_20%,rgba(255,107,53,0.18),transparent_55%),radial-gradient(circle_at_75%_75%,rgba(255,107,53,0.1),transparent_50%),theme(colors.ink)] p-5 relative">
      <div className="absolute top-5 right-5">
        <ThemeToggle size={16} />
      </div>
      <div className="bg-surface-2 border border-hairline rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] py-10 px-8 text-center w-[300px] max-w-[calc(100%-40px)] flex flex-col items-center">
        <div className="w-14 h-14 rounded-lg bg-ember flex items-center justify-center text-[22px] font-extrabold text-[#1a0d06] tracking-tight mb-5 shrink-0">
          D3
        </div>
        <h1 className="text-[22px] font-bold tracking-wide text-parchment mb-1">D3</h1>
        <p className="text-[13px] text-clay mb-6">
          {customerTableText ? `${customerTableText} · Scan confirmed` : "Scan table QR code"}
        </p>
        {customerTableText ? (
          <button
            className="w-full bg-ember hover:bg-ember-hover active:bg-ember-deep active:scale-[0.98] text-[#1a0d06] rounded-[14px] py-3.5 px-5 text-[15px] font-bold flex items-center justify-center gap-2 transition cursor-pointer"
            onClick={onProceed}
            type="button"
          >
            Order food
            <ArrowRight aria-hidden="true" size={16} />
          </button>
        ) : (
          <div className="text-[13px] text-clay bg-surface-1 border border-hairline rounded-xl p-3 text-center leading-relaxed">
            Please scan the QR code on your table to view the menu and place orders.
          </div>
        )}
      </div>
    </section>
  );
}
