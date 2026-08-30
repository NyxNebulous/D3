export const CURRENCY = "INR" as const;

export function formatInrFromPaise(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: CURRENCY,
    maximumFractionDigits: 2
  }).format(paise / 100);
}

