import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";

export type NoticeVariant = "success" | "info" | "warning" | "error";

type NoticeProps = {
  variant: NoticeVariant;
  title: string;
  subtitle: string;
};

export function Notice({ variant, title, subtitle }: NoticeProps) {
  const Icon =
    variant === "success"
      ? CheckCircle2
      : variant === "warning"
        ? TriangleAlert
        : variant === "error"
          ? AlertCircle
          : Info;

  return (
    <div className={`notice notice--${variant}`} role="status" aria-live="polite">
      <div className="notice__icon">
        <Icon aria-hidden="true" size={16} />
      </div>
      <div className="notice__content">
        <div className="notice__title">{title}</div>
        <div className="notice__subtitle">{subtitle}</div>
      </div>
    </div>
  );
}
