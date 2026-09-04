import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";

export type NoticeVariant = "success" | "info" | "warning" | "error";

type NoticeProps = {
  variant: NoticeVariant;
  title: string;
  subtitle: string;
  onDismiss?: () => void;
};

export function Notice({ variant, title, subtitle, onDismiss }: NoticeProps) {
  const Icon =
    variant === "success"
      ? CheckCircle2
      : variant === "warning"
        ? TriangleAlert
        : variant === "error"
          ? AlertCircle
          : Info;

  const iconStyle =
    variant === "success"
      ? "bg-sage-bg text-sage"
      : variant === "error"
        ? "bg-rust-bg text-rust"
        : "bg-ember-muted text-ember-hover";

  return (
    <div
      className="flex items-start justify-between gap-3 p-3 px-3.5 rounded-xl border border-hairline-strong bg-surface-2 shadow-xl my-3 text-left relative"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className={`shrink-0 w-[30px] h-[30px] flex items-center justify-center rounded-lg ${iconStyle}`}>
          <Icon aria-hidden="true" size={16} />
        </div>
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <div className="text-[13.5px] font-bold text-parchment leading-snug">{title}</div>
          <div className="text-xs text-clay leading-relaxed break-words">{subtitle}</div>
        </div>
      </div>
      {onDismiss ? (
        <button
          onClick={onDismiss}
          className="text-clay hover:text-parchment p-1 rounded-md cursor-pointer transition shrink-0 ml-1"
          aria-label="Dismiss notice"
          type="button"
        >
          <X size={15} />
        </button>
      ) : null}
    </div>
  );
}
