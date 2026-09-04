type StatusPillProps = {
  tone: "neutral" | "success" | "warning";
  children: string;
};

export function StatusPill({ tone, children }: StatusPillProps) {
  const toneClasses =
    tone === "success"
      ? "bg-sage-bg text-sage"
      : tone === "warning"
        ? "bg-ember-muted text-ember-hover"
        : "bg-surface-2 text-clay";

  return (
    <span
      className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${toneClasses}`}
    >
      {children}
    </span>
  );
}
