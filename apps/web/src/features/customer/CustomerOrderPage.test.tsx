import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearAuthToken } from "../../api/client.js";
import { CustomerOrderPage } from "./CustomerOrderPage.js";

describe("CustomerOrderPage", () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
    sessionStorage.clear();
    clearAuthToken();
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

  it("optimistically updates item quantity immediately without waiting for server response", async () => {
    let resolveCartPut: (val: Response) => void;
    const cartPutPromise = new Promise<Response>((resolve) => {
      resolveCartPut = resolve;
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

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
        return new Response(
          JSON.stringify({
            categories: [
              {
                id: 1,
                name: "Mains",
                sortOrder: 1,
                items: [
                  {
                    id: 42,
                    categoryId: 1,
                    name: "Paneer Butter Masala",
                    pricePaise: 24000,
                    isVeg: true,
                    sortOrder: 1
                  }
                ]
              }
            ]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.includes("/api/cart") && method === "PUT") {
        // Return unresolved promise so server response is deliberately delayed
        return cartPutPromise;
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

    render(<CustomerOrderPage qrId="" signature="" />);

    // Wait for home screen
    await waitFor(() => {
      expect(screen.getByText(/hi!?\s*rohan/i)).toBeInTheDocument();
    });

    // Navigate to menu
    const menuButtons = screen.getAllByRole("button", { name: /menu/i });
    fireEvent.click(menuButtons[0]!);

    // Find "ADD +" button for Paneer Butter Masala
    const addButton = await screen.findByRole("button", { name: /add paneer butter masala/i });
    expect(addButton).toBeInTheDocument();

    // Click ADD +
    fireEvent.click(addButton);

    // EVEN THOUGH PUT /api/cart/items HAS NOT RESOLVED YET:
    // Quantity stepper, floating cart, and nav badge must update immediately (0ms optimistic feedback)
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: /increase paneer butter masala/i })).toBeInTheDocument();

    // Now resolve the server response
    resolveCartPut!(
      new Response(
        JSON.stringify({
          cart: {
            id: 1,
            items: [
              {
                menuItemId: 42,
                name: "Paneer Butter Masala",
                categoryName: "Mains",
                isVeg: true,
                quantity: 1,
                unitPricePaise: 24000,
                lineTotalPaise: 24000
              }
            ],
            totalPaise: 24000,
            currency: "INR"
          }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    await waitFor(() => {
      expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(1);
    });
  });
});
