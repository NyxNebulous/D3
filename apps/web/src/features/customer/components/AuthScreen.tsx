import type { FormEvent } from "react";
import { ArrowRight, Bug } from "lucide-react";
import { Notice, type NoticeVariant } from "../../../components/Notice.js";
import { ThemeToggle } from "../../../components/ThemeToggle.js";

type NoticeState = {
  variant: NoticeVariant;
  title: string;
  subtitle: string;
};

type AuthScreenProps = {
  customerTableText: string;
  name: string;
  onNameChange: (value: string) => void;
  mobileNumber: string;
  onMobileNumberChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
  notice: NoticeState | null;
  onReportBug?: () => void;
};

export function AuthScreen({
  customerTableText,
  name,
  onNameChange,
  mobileNumber,
  onMobileNumberChange,
  onSubmit,
  busy,
  notice,
  onReportBug
}: AuthScreenProps) {
  return (
    <section className="flex flex-col flex-1 min-h-0 overflow-y-auto p-6 px-5 items-stretch justify-center relative">
      <div className="absolute top-5 right-5 flex items-center gap-2">
        {onReportBug ? (
          <button
            onClick={onReportBug}
            type="button"
            className="p-2 rounded-xl border border-hairline bg-surface-2 hover:bg-surface-3 text-clay hover:text-ember transition cursor-pointer flex items-center justify-center shadow-xs"
            title="Report a bug"
            aria-label="Report a bug"
          >
            <Bug size={16} />
          </button>
        ) : null}
        <ThemeToggle size={16} />
      </div>
      <div className="bg-surface-2 border border-hairline rounded-3xl p-7 px-6 shadow-[0_20px_50px_rgba(0,0,0,0.4)] flex flex-col">
        <h1 className="text-[19px] font-bold text-parchment mb-0.5">Start your order</h1>
        <div className="text-[12.5px] text-clay mb-5">{customerTableText} · D3</div>

        {notice ? (
          <Notice variant={notice.variant} title={notice.title} subtitle={notice.subtitle} />
        ) : null}

        <form onSubmit={onSubmit}>
          <div className="mb-3.5">
            <label
              className="block text-[11px] font-bold text-clay uppercase tracking-wider mb-1.5"
              htmlFor="customer-name"
            >
              Name
            </label>
            <input
              id="customer-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Your name"
              required
              className="w-full bg-surface-1 border border-hairline rounded-lg p-3.5 px-3.5 text-parchment text-[15px] focus:outline-none focus:border-ember transition placeholder:text-clay-dim"
            />
          </div>

          <div className="mb-3.5">
            <label
              className="block text-[11px] font-bold text-clay uppercase tracking-wider mb-1.5"
              htmlFor="customer-mobile"
            >
              Mobile number
            </label>
            <input
              id="customer-mobile"
              inputMode="tel"
              value={mobileNumber}
              onChange={(e) => onMobileNumberChange(e.target.value)}
              placeholder="10-digit mobile number"
              required
              className="w-full bg-surface-1 border border-hairline rounded-lg p-3.5 px-3.5 text-parchment text-[15px] focus:outline-none focus:border-ember transition placeholder:text-clay-dim"
            />
          </div>

          <button
            className="w-full bg-ember hover:bg-ember-hover active:bg-ember-deep active:scale-[0.98] text-[#1a0d06] rounded-[14px] py-3.5 px-5 text-[15px] font-bold flex items-center justify-center gap-2 transition cursor-pointer mt-2 disabled:opacity-55 disabled:cursor-not-allowed"
            disabled={busy}
            type="submit"
          >
            Start ordering
            <ArrowRight aria-hidden="true" size={16} />
          </button>
        </form>
      </div>
    </section>
  );
}
