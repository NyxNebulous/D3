import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearStaffToken, getStaffToken } from "../../api/client.js";
import { AdminPage } from "./AdminPage.js";

describe("AdminPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearStaffToken();
  });

  it("renders the staff login form when unauthenticated and logs in to dashboard", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/admin/session")) {
        return new Response(JSON.stringify({ message: "Unauthenticated" }), { status: 401 });
      }

      if (url.includes("/api/admin/login")) {
        return new Response(
          JSON.stringify({
            token: "staff-test-token-123",
            staff: { id: 1, username: "manager1" }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.includes("/api/admin/orders")) {
        return new Response(
          JSON.stringify({
            orders: [
              {
                id: 1,
                publicOrderNumber: "ORD-001",
                customerName: "Aarav",
                mobileNumber: "9876543210",
                tableLabel: "Table 4",
                totalPaise: 45000,
                currency: "INR",
                paymentState: "UNPAID",
                fulfillmentState: "PENDING",
                paidAt: null,
                completedAt: null,
                createdAt: new Date().toISOString(),
                items: [
                  {
                    id: 10,
                    menuItemId: 5,
                    itemName: "Butter Naan",
                    isVeg: true,
                    quantity: 2,
                    unitPricePaise: 6000,
                    lineTotalPaise: 12000
                  }
                ]
              }
            ]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.includes("/api/admin/menu")) {
        return new Response(
          JSON.stringify({
            categories: [
              {
                id: 1,
                name: "Breads",
                sortOrder: 1,
                items: [
                  {
                    id: 5,
                    categoryId: 1,
                    name: "Butter Naan",
                    pricePaise: 6000,
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

      return new Response("Not found", { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<AdminPage />);

    // Should see Staff Sign In
    expect(await screen.findByRole("heading", { name: /staff sign in/i })).toBeInTheDocument();
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitBtn = screen.getByRole("button", { name: /sign in to dashboard/i });

    fireEvent.change(usernameInput, { target: { value: "manager1" } });
    fireEvent.change(passwordInput, { target: { value: "secret123" } });
    fireEvent.click(submitBtn);

    // After login, should see dashboard with Live Orders
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^admin$/i })).toBeInTheDocument();
      expect(screen.getAllByText("ORD-001").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/table 4/i).length).toBeGreaterThanOrEqual(1);
    });

    // Switch to Menu tab
    const menuTabBtn = screen.getByRole("button", { name: /^menu$/i });
    fireEvent.click(menuTabBtn);

    await waitFor(() => {
      expect(screen.getAllByText("Breads").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Butter Naan")).toBeInTheDocument();
      expect(getStaffToken()).toBe("staff-test-token-123");
    });
  });

  it("toggles password visibility between masked and plain text", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ error: "Unauthenticated" }), { status: 401 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminPage />);

    const passwordInput = await screen.findByLabelText(/password/i);
    expect(passwordInput).toHaveAttribute("type", "password");

    const toggleBtn = screen.getByTitle(/show password/i);
    fireEvent.click(toggleBtn);
    expect(passwordInput).toHaveAttribute("type", "text");

    fireEvent.click(toggleBtn);
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("stays on login screen and clears staff state if loadAdminData fails after login", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/admin/session")) {
        return new Response(JSON.stringify({ message: "Unauthenticated" }), { status: 401 });
      }

      if (url.includes("/api/admin/login")) {
        return new Response(
          JSON.stringify({
            token: "invalid-token",
            staff: { id: 1, username: "manager1" }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.includes("/api/admin/orders") || url.includes("/api/admin/menu")) {
        return new Response(
          JSON.stringify({ error: "Unauthenticated" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response("Not found", { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<AdminPage />);

    expect(await screen.findByRole("heading", { name: /staff sign in/i })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "manager1" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in to dashboard/i }));

    // Should stay on Staff Sign In and show error notice instead of an empty dashboard
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /staff sign in/i })).toBeInTheDocument();
      expect(screen.getByText(/login failed/i)).toBeInTheDocument();
      expect(getStaffToken()).toBeNull();
    });
  });
});
