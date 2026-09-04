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
      expect(screen.getByText(/hi!?\s*ananya/i)).toBeInTheDocument();
    });
  });

  it("switches tables cleanly when scanning a different table QR", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/qr/validate")) {
        return new Response(
          JSON.stringify({
            token: "pre-token-table-2",
            table: { label: "Table 2" },
            sameTableSession: false
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.includes("/api/auth/customer/session")) {
        // Table 1 session was revoked when validating Table 2
        return new Response(JSON.stringify({ error: "Session expired or revoked" }), { status: 401 });
      }

      return new Response("Not found", { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<CustomerOrderPage qrId="table-2" signature="sig456" />);

    // Must show Table 2 confirmed on landing screen
    await waitFor(() => {
      expect(screen.getByText(/Table 2\s*·\s*Scan confirmed/i)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /order food/i })).toBeInTheDocument();
  });

  it("preserves active session when re-scanning or reloading on the same table", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/qr/validate")) {
        return new Response(
          JSON.stringify({
            token: "pre-token-table-1",
            table: { label: "Table 1" },
            sameTableSession: true
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.includes("/api/auth/customer/session")) {
        return new Response(
          JSON.stringify({
            customer: { name: "Rohan", mobileNumber: "+919811122233" },
            table: { label: "Table 1" }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.includes("/api/menu")) {
        return new Response(JSON.stringify({ categories: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.includes("/api/cart")) {
        return new Response(JSON.stringify({ cart: { id: 1, items: [], totalPaise: 0 } }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.includes("/api/orders/current") || url.includes("/api/customer/orders")) {
        return new Response(JSON.stringify({ orders: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      return new Response("Not found", { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<CustomerOrderPage qrId="table-1" signature="sig123" />);

    // Should stay directly on home screen for Table 1 without needing re-login
    await waitFor(() => {
      expect(screen.getByText(/hi!?\s*rohan/i)).toBeInTheDocument();
    });
  });
});
