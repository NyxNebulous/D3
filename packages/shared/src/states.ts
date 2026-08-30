export const paymentStates = ["UNPAID", "PAID_OFFLINE"] as const;
export type PaymentState = (typeof paymentStates)[number];

export const fulfillmentStates = ["PENDING", "COMPLETED"] as const;
export type FulfillmentState = (typeof fulfillmentStates)[number];

