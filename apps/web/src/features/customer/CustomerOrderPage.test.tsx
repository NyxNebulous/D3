import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerOrderPage } from "./CustomerOrderPage.js";

describe("CustomerOrderPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the direct login form with Name and Mobile number and starts ordering", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/auth/customer/session")) {
        return new Response(JSON.stringify({ message: "No session" }), { status: 401 });
      }

      if (url.includes("/api/qr/validate")) {
        return new Response(
          JSON.stringify({
            table: { label: "Table 3" },
            expiresAt: new Date(Date.now() + 600000).toISOString()
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.includes("/api/auth/customer/login")) {
        return new Response(
          JSON.stringify({
            customer: { name: "Ananya", mobileNumber: "+919876543210" },
            table: { label: "Table 3" },
            session: { id: 101, expiresAt: new Date(Date.now() + 86400000).toISOString() }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.includes("/api/menu")) {
        return new Response(
          JSON.stringify({ categories: [] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.includes("/api/cart")) {
        return new Response(
          JSON.stringify({ cart: { id: 1, items: [], totalPaise: 0 } }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.includes("/api/orders/current") || url.includes("/api/customer/orders")) {
        return new Response(
          JSON.stringify({ orders: [] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response("Not found", { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<CustomerOrderPage qrId="table-3" signature="abc123" />);

    // Click "Order food" from landing
    const orderFoodButton = await screen.findByRole("button", { name: /order food/i });
    fireEvent.click(orderFoodButton);

    // Should see Name and Mobile Number inputs directly (no OTP)
    const nameInput = await screen.findByLabelText(/name/i);
    const mobileInput = await screen.findByLabelText(/mobile number/i);
    const startOrderButton = screen.getByRole("button", { name: /start ordering/i });

    expect(screen.queryByLabelText(/enter otp/i)).not.toBeInTheDocument();

    fireEvent.change(nameInput, { target: { value: "Ananya" } });
    fireEvent.change(mobileInput, { target: { value: "+919876543210" } });
    fireEvent.click(startOrderButton);

    // Wait for transition to home screen
    await waitFor(() => {
      expect(screen.getByText(/hi ananya/i)).toBeInTheDocument();
    });
  });
});
