import { useState, useMemo } from "react";
import { CheckCircle2, Flame, RefreshCw, Wallet } from "lucide-react";
import { formatInrFromPaise } from "@d3/shared";
import type { Order } from "../../../api/client.js";
import { FulfillmentBadge, PaymentBadge } from "./StatusBadges.js";

type OrdersMasterPaneProps = {
  orders: Order[];
  selectedOrderId: number | null;
  onSelectOrder: (orderId: number) => void;
  isRefreshing: boolean;
  onRefresh: () => void;
};

type OrderFilterSection = "to-cook" | "unsettled" | "settled";

export function OrdersMasterPane({
  orders,
  selectedOrderId,
  onSelectOrder,
  isRefreshing,
  onRefresh
}: OrdersMasterPaneProps) {
  const [activeSection, setActiveSection] = useState<OrderFilterSection>("to-cook");

  // Helper to ensure strict FIFO (earliest orders first, new orders at bottom)
  const sortChronologicalAsc = (a: Order, b: Order) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return a.id - b.id;
  };

  // Stage 1: Kitchen Queue (Needs cooking, irrespective of paid or unpaid)
  const toCookOrders = useMemo(
    () => orders.filter((o) => o.fulfillmentState === "PENDING").sort(sortChronologicalAsc),
    [orders]
  );

  // Stage 2: Cooked & Served, Awaiting Payment (Unsettled)
  const unsettledOrders = useMemo(
    () =>
      orders
        .filter(
          (o) => o.fulfillmentState === "COMPLETED" && o.paymentState === "UNPAID"
        )
        .sort(sortChronologicalAsc),
    [orders]
  );

  // Stage 3: Fully Settled & Completed (Both cooked and paid)
  const settledOrders = useMemo(
    () =>
      orders
        .filter(
          (o) => o.fulfillmentState === "COMPLETED" && o.paymentState === "PAID_OFFLINE"
        )
        .sort(sortChronologicalAsc),
    [orders]
  );

  const displayedOrders = useMemo(() => {
    switch (activeSection) {
      case "to-cook":
        return toCookOrders;
      case "unsettled":
        return unsettledOrders;
      case "settled":
      default:
        return settledOrders;
    }
  }, [activeSection, toCookOrders, unsettledOrders, settledOrders]);

  function renderOrderCard(order: Order) {
    const isSelected = order.id === selectedOrderId;
    const isSettled =
      order.paymentState === "PAID_OFFLINE" && order.fulfillmentState === "COMPLETED";

    const itemsSummary = order.items
      .map((item) => `${item.quantity}× ${item.itemName}`)
      .join(", ");

    return (
      <button
        key={order.id}
        className={`p-3.5 px-4.5 border-b border-hairline cursor-pointer flex flex-col gap-1.5 w-full text-left text-parchment transition border-l-[3px] ${
          isSelected
            ? "bg-surface-2 border-l-ember"
            : "border-l-transparent hover:bg-surface-1"
        } ${isSettled ? "opacity-60 hover:opacity-90" : ""}`}
        onClick={() => onSelectOrder(order.id)}
        type="button"
      >
        <div className="flex justify-between items-baseline gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-extrabold text-parchment">
              {order.publicOrderNumber}
            </span>
            <span className="text-[11.5px] font-semibold text-clay bg-surface-2 px-2 py-0.5 rounded-md">
              {order.tableLabel}
            </span>
          </div>
          <span className="text-[13.5px] font-bold text-parchment">
            {formatInrFromPaise(order.totalPaise)}
          </span>
        </div>

        {/* Cook dish items preview */}
        <div className="text-[12px] text-parchment/80 font-medium line-clamp-2 leading-relaxed">
          {itemsSummary}
        </div>

        <div className="flex justify-between items-center gap-2 pt-0.5">
          <span className="text-[11px] text-clay-dim">
            {order.customerName ? `${order.customerName} · ` : ""}
            {order.items.reduce((sum, item) => sum + item.quantity, 0)} items
          </span>
          <div className="flex gap-1 shrink-0">
            <PaymentBadge state={order.paymentState} />
            <FulfillmentBadge state={order.fulfillmentState} />
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="w-[340px] max-md:w-full max-md:flex-1 border-r max-md:border-r-0 border-hairline flex flex-col shrink-0 overflow-hidden bg-ink">
      {/* Top Header */}
      <div className="p-3.5 px-4.5 border-b border-hairline flex justify-between items-center shrink-0">
        <h3 className="text-sm font-bold text-parchment m-0">Live Orders</h3>
        <button
          className="text-clay hover:text-parchment text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition disabled:opacity-60"
          disabled={isRefreshing}
          onClick={onRefresh}
          type="button"
        >
          <RefreshCw
            aria-hidden="true"
            className={isRefreshing ? "animate-spin" : ""}
            size={13}
          />
          Refresh
        </button>
      </div>

      {/* Exactly 3 Fit-to-Screen Section Tabs */}
      <div className="grid grid-cols-3 gap-1.5 p-2 px-3 border-b border-hairline bg-surface-1/40 shrink-0">
        {/* 1. To Cook (Kitchen) */}
        <button
          className={`py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
            activeSection === "to-cook"
              ? "bg-ember-muted/80 border-ember text-ember-hover shadow-xs"
              : "border-transparent text-clay hover:text-parchment hover:bg-surface-2"
          }`}
          onClick={() => setActiveSection("to-cook")}
          type="button"
        >
          <Flame size={13} className="text-ember shrink-0" aria-hidden="true" />
          <span>To Cook</span>
          <span
            className={`text-[10.5px] px-1.5 py-0.2 rounded-full font-bold ${
              activeSection === "to-cook"
                ? "bg-ember text-[#1a0d06]"
                : "bg-surface-2 text-clay"
            }`}
          >
            {toCookOrders.length}
          </span>
        </button>

        {/* 2. Unsettled (Prepared & awaiting bill payment) */}
        <button
          className={`py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
            activeSection === "unsettled"
              ? "bg-rust-bg border-rust text-rust shadow-xs"
              : "border-transparent text-clay hover:text-parchment hover:bg-surface-2"
          }`}
          onClick={() => setActiveSection("unsettled")}
          type="button"
        >
          <Wallet size={13} className="text-rust shrink-0" aria-hidden="true" />
          <span>Unsettled</span>
          <span
            className={`text-[10.5px] px-1.5 py-0.2 rounded-full font-bold ${
              activeSection === "unsettled"
                ? "bg-rust text-white"
                : "bg-surface-2 text-clay"
            }`}
          >
            {unsettledOrders.length}
          </span>
        </button>

        {/* 3. Settled (Historical / Completed & Paid) */}
        <button
          className={`py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
            activeSection === "settled"
              ? "bg-surface-2 border-hairline-strong text-parchment shadow-xs"
              : "border-transparent text-clay hover:text-parchment hover:bg-surface-2"
          }`}
          onClick={() => setActiveSection("settled")}
          type="button"
        >
          <CheckCircle2 size={13} className="text-sage shrink-0" aria-hidden="true" />
          <span>Settled</span>
          <span
            className={`text-[10.5px] px-1.5 py-0.2 rounded-full font-bold ${
              activeSection === "settled"
                ? "bg-surface-3 text-parchment"
                : "bg-surface-2 text-clay"
            }`}
          >
            {settledOrders.length}
          </span>
        </button>
      </div>

      {/* Orders List for Active Section */}
      <div className="flex-1 overflow-y-auto">
        {displayedOrders.length > 0 ? (
          displayedOrders.map(renderOrderCard)
        ) : (
          <div className="flex flex-col items-center justify-center p-10 text-center text-clay gap-2.5">
            <div className="w-12 h-12 rounded-2xl bg-surface-1 border border-hairline flex items-center justify-center text-clay-dim">
              {activeSection === "to-cook" ? (
                <Flame size={22} className="text-ember/70" />
              ) : activeSection === "unsettled" ? (
                <Wallet size={22} className="text-rust/70" />
              ) : (
                <CheckCircle2 size={22} className="text-sage/70" />
              )}
            </div>
            <div className="text-xs font-bold text-parchment">
              {activeSection === "to-cook"
                ? "Kitchen is clear!"
                : activeSection === "unsettled"
                ? "No unsettled orders"
                : "No settled orders yet"}
            </div>
            <div className="text-[11px] text-clay-dim max-w-[200px]">
              {activeSection === "to-cook"
                ? "No dishes currently need preparation."
                : activeSection === "unsettled"
                ? "All prepared dishes have been settled."
                : "Completed and paid orders will appear here."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
