import { describe, expect, it } from "vitest";
import { createOrderSchema, paymentStates, updateCartItemSchema } from "../src/index.js";

describe("shared V1 schemas", () => {
  it("keeps payment states offline-only", () => {
    expect(paymentStates).toEqual(["UNPAID", "PAID_OFFLINE"]);
  });

  it("rejects client-provided totals during order creation", () => {
    expect(createOrderSchema.safeParse({ totalPaise: 1 }).success).toBe(false);
  });

  it("accepts quantity zero so the backend can remove cart items", () => {
    expect(updateCartItemSchema.parse({ menuItemId: 1, quantity: 0 })).toEqual({
      menuItemId: 1,
      quantity: 0
    });
  });

  it("accepts batch cart item updates", () => {
    expect(
      updateCartItemSchema.parse({
        items: [
          { menuItemId: 1, quantity: 2 },
          { menuItemId: 2, quantity: 0 }
        ]
      })
    ).toEqual({
      items: [
        { menuItemId: 1, quantity: 2 },
        { menuItemId: 2, quantity: 0 }
      ]
    });
  });
});

