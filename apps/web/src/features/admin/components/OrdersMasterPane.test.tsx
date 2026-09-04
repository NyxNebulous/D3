import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Order } from "../../../api/client.js";
import { OrdersMasterPane } from "./OrdersMasterPane.js";

const mockOrders: Order[] = [
  {
    id: 1,
    publicOrderNumber: "#101",
    customerName: "Aarav",
    mobileNumber: "9876543210",
    tableLabel: "Table 1",
    totalPaise: 45000,
    currency: "INR",
    paymentState: "UNPAID",
    fulfillmentState: "PENDING",
    paidAt: null,
    completedAt: null,
    createdAt: "2026-09-04T10:00:00.000Z",
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
  },
  {
    id: 2,
    publicOrderNumber: "#102",
    customerName: "Sneha",
    mobileNumber: "9876543211",
    tableLabel: "Table 2",
    totalPaise: 80000,
    currency: "INR",
    paymentState: "PAID_OFFLINE", // Paid before being cooked!
    fulfillmentState: "PENDING",
    paidAt: "2026-09-04T10:05:00.000Z",
    completedAt: null,
    createdAt: "2026-09-04T10:02:00.000Z",
    items: [
      {
        id: 11,
        menuItemId: 6,
        itemName: "Paneer Tikka",
        isVeg: true,
        quantity: 1,
        unitPricePaise: 25000,
        lineTotalPaise: 25000
      }
    ]
  },
  {
    id: 3,
    publicOrderNumber: "#103",
    customerName: "Rohan",
    mobileNumber: "9876543212",
    tableLabel: "Table 3",
    totalPaise: 35000,
    currency: "INR",
    paymentState: "UNPAID",
    fulfillmentState: "COMPLETED", // Cooked and served, awaiting bill payment!
    paidAt: null,
    completedAt: "2026-09-04T10:15:00.000Z",
    createdAt: "2026-09-04T09:50:00.000Z",
    items: [
      {
        id: 12,
        menuItemId: 7,
        itemName: "Dal Makhani",
        isVeg: true,
        quantity: 1,
        unitPricePaise: 22000,
        lineTotalPaise: 22000
      }
    ]
  },
  {
    id: 4,
    publicOrderNumber: "#104",
    customerName: "Priya",
    mobileNumber: "9876543213",
    tableLabel: "Table 4",
    totalPaise: 50000,
    currency: "INR",
    paymentState: "PAID_OFFLINE", // Cooked and paid!
    fulfillmentState: "COMPLETED",
    paidAt: "2026-09-04T10:10:00.000Z",
    completedAt: "2026-09-04T10:08:00.000Z",
    createdAt: "2026-09-04T09:40:00.000Z",
    items: [
      {
        id: 13,
        menuItemId: 8,
        itemName: "Veg Biryani",
        isVeg: true,
        quantity: 1,
        unitPricePaise: 32000,
        lineTotalPaise: 32000
      }
    ]
  }
];

describe("OrdersMasterPane", () => {
  it("partitions orders into To Cook, Unsettled, and Settled with correct counts and independent payment state", () => {
    render(
      <OrdersMasterPane
        orders={mockOrders}
        selectedOrderId={1}
        onSelectOrder={vi.fn()}
        isRefreshing={false}
        onRefresh={vi.fn()}
      />
    );

    // Verify 3 tabs exist
    const toCookTab = screen.getByRole("button", { name: /^to cook/i });
    const unsettledTab = screen.getByRole("button", { name: /^unsettled/i });
    const settledTab = screen.getByRole("button", { name: /^settled/i });

    expect(toCookTab).toBeInTheDocument();
    expect(unsettledTab).toBeInTheDocument();
    expect(settledTab).toBeInTheDocument();

    // To Cook has 2 orders: #101 (unpaid, pending) AND #102 (paid offline, pending)
    expect(screen.getByText("#101")).toBeInTheDocument();
    expect(screen.getByText("#102")).toBeInTheDocument();
    expect(screen.queryByText("#103")).not.toBeInTheDocument();
    expect(screen.queryByText("#104")).not.toBeInTheDocument();

    // Verify FIFO order in To Cook: #101 (createdAt: 10:00) is rendered before #102 (createdAt: 10:02)
    const orderElements = screen.getAllByRole("button").filter((b) => b.textContent?.includes("Table"));
    expect(orderElements[0]).toHaveTextContent("#101");
    expect(orderElements[1]).toHaveTextContent("#102");

    // Click Unsettled tab (should only show #103: completed & unpaid)
    fireEvent.click(unsettledTab);
    expect(screen.getByText("#103")).toBeInTheDocument();
    expect(screen.queryByText("#101")).not.toBeInTheDocument();
    expect(screen.queryByText("#102")).not.toBeInTheDocument();
    expect(screen.queryByText("#104")).not.toBeInTheDocument();

    // Click Settled tab (should only show #104: completed & paid)
    fireEvent.click(settledTab);
    expect(screen.getByText("#104")).toBeInTheDocument();
    expect(screen.queryByText("#101")).not.toBeInTheDocument();
    expect(screen.queryByText("#102")).not.toBeInTheDocument();
    expect(screen.queryByText("#103")).not.toBeInTheDocument();
  });
});
