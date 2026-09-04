export function formatPaymentState(state: string): string {
  switch (state) {
    case "PAID_OFFLINE":
      return "Paid";
    case "UNPAID":
      return "Unpaid";
    default:
      return state;
  }
}

export function formatFulfillmentState(state: string): string {
  switch (state) {
    case "PENDING":
      return "Preparing";
    case "COMPLETED":
      return "Ready";
    default:
      return state;
  }
}

export function PaymentBadge({ state }: { state: string }) {
  const isPaid = state === "PAID_OFFLINE";
  return (
    <span
      className={`inline-flex items-center text-[10.5px] font-bold py-1 px-2.5 rounded-full uppercase tracking-wider ${
        isPaid ? "bg-sage-bg text-sage" : "bg-rust-bg text-rust"
      }`}
    >
      {formatPaymentState(state)}
    </span>
  );
}

export function FulfillmentBadge({ state }: { state: string }) {
  const isCompleted = state === "COMPLETED";
  return (
    <span
      className={`inline-flex items-center text-[10.5px] font-bold py-1 px-2.5 rounded-full uppercase tracking-wider ${
        isCompleted ? "bg-sage-bg text-sage" : "bg-ember-muted text-ember"
      }`}
    >
      {formatFulfillmentState(state)}
    </span>
  );
}
