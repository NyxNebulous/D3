import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";

type ToolbarButtonProps = {
  icon: ComponentType<LucideProps>;
  label: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  variant?: "primary" | "secondary" | "quiet";
};

export function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  type = "button",
  disabled = false,
  variant = "secondary"
}: ToolbarButtonProps) {
  const variantClasses =
    variant === "primary"
      ? "bg-ember text-[#1a0d06] hover:bg-ember-hover active:bg-ember-deep"
      : variant === "quiet"
        ? "bg-transparent text-clay hover:text-parchment hover:bg-surface-1"
        : "bg-surface-1 text-parchment border border-hairline hover:bg-surface-2 hover:border-hairline-strong";

  return (
    <button
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold transition cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed ${variantClasses}`}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type={type}
    >
      <Icon aria-hidden="true" size={18} />
      <span>{label}</span>
    </button>
  );
}
