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
  return (
    <button
      className={`toolbar-button toolbar-button--${variant}`}
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

