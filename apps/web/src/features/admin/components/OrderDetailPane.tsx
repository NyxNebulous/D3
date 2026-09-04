import { Check, ChevronLeft, Wallet } from "lucide-react";
import { formatInrFromPaise } from "@d3/shared";
import type { Order } from "../../../api/client.js";
import { FulfillmentBadge, PaymentBadge } from "./StatusBadges.js";

type OrderDetailPaneProps = {
  order: Order | null;
  onBack: () => void;
  onMarkPrepared: (orderId: number) => void;
  onMarkPaid: (orderId: number) => void;
  busy: boolean;
};

export function OrderDetailPane({
  order,
  onBack,
  onMarkPrepared,
  onMarkPaid,
  busy
}: OrderDetailPaneProps) {
  if (!order) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-clay">
        Select an order to view details
      </div>
    );
  }

  const isPrepared = order.fulfillmentState === "COMPLETED";
  const isPaid = order.paymentState === "PAID_OFFLINE";

  return (
    <div className="flex-1 p-6 px-7 overflow-y-auto bg-ink max-md:p-4.5">
      <button
        className="hidden max-md:flex items-center gap-1.5 text-clay hover:text-parchment text-[13px] font-semibold mb-3.5 cursor-pointer transition"
        onClick={onBack}
        type="button"
      >
        <ChevronLeft aria-hidden="true" size={16} />
        Back to orders
      </button>

      <div className="flex justify-between items-start mb-5">
        <div>
          <h2 className="text-[19px] font-bold text-parchment mb-2 break-words">
            {order.publicOrderNumber}
          </h2>
          <div className="flex gap-2">
            <PaymentBadge state={order.paymentState} />
            <FulfillmentBadge state={order.fulfillmentState} />
          </div>
        </div>
        <div className="text-[22px] font-bold text-parchment">
          {formatInrFromPaise(order.totalPaise)}
        </div>
      </div>

      <div className="grid grid-cols-2 max-md:grid-cols-1 gap-3.5 mb-5">
        <div className="bg-surface-1 border border-hairline rounded-lg p-3 px-3.5">
          <div className="text-[11px] text-clay uppercase tracking-wider mb-1 font-semibold">
            Table
          </div>
          <div className="text-[14.5px] font-semibold text-parchment break-words">
            {order.tableLabel}
          </div>
        </div>

        <div className="bg-surface-1 border border-hairline rounded-lg p-3 px-3.5">
          <div className="text-[11px] text-clay uppercase tracking-wider mb-1 font-semibold">
            Customer
          </div>
          <div className="text-[14.5px] font-semibold text-parchment break-words">
            {order.customerName} · {order.mobileNumber}
          </div>
        </div>

        <div className="bg-surface-1 border border-hairline rounded-lg p-3 px-3.5">
          <div className="text-[11px] text-clay uppercase tracking-wider mb-1 font-semibold">
            Placed At
          </div>
          <div className="text-[14.5px] font-semibold text-parchment break-words">
            {order.createdAt ? new Date(order.createdAt).toLocaleTimeString() : "Just now"}
          </div>
        </div>

        <div className="bg-surface-1 border border-hairline rounded-lg p-3 px-3.5">
          <div className="text-[11px] text-clay uppercase tracking-wider mb-1 font-semibold">
            Items Count
          </div>
          <div className="text-[14.5px] font-semibold text-parchment break-words">
            {order.items.reduce((sum, item) => sum + item.quantity, 0)} total
          </div>
        </div>
      </div>

      <div className="border border-hairline rounded-lg overflow-hidden mb-1">
        {order.items.map((item) => (
          <div
            className="flex justify-between items-center gap-3 p-3 px-4 text-[13.5px] text-parchment border-b border-hairline last:border-b-0"
            key={`${order.id}-${item.itemName}`}
          >
            <div className="min-w-0 break-words">
              {item.quantity} × {item.itemName}
            </div>
            <div className="font-semibold whitespace-nowrap">
              {formatInrFromPaise(item.lineTotalPaise)}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between p-3.5 px-4 bg-surface-1 rounded-lg text-[15px] font-bold text-parchment mb-5.5">
        <span>Total</span>
        <span>{formatInrFromPaise(order.totalPaise)}</span>
      </div>

      <div className="flex gap-2.5 flex-wrap">
        {isPrepared ? (
          <div className="bg-sage text-sage-ink rounded-lg py-2.5 px-4.5 text-[13.5px] font-bold inline-flex items-center gap-1.5 cursor-default opacity-80 select-none">
            <Check aria-hidden="true" size={16} />
            Food Prepared
          </div>
        ) : (
          <button
            className="bg-sage hover:opacity-90 text-sage-ink rounded-lg py-2.5 px-4.5 text-[13.5px] font-bold inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-55"
            disabled={busy}
            onClick={() => onMarkPrepared(order.id)}
            type="button"
          >
            <Check aria-hidden="true" size={16} />
            Mark Prepared
          </button>
        )}

        {isPaid ? (
          <div className="border-[1.5px] border-sage text-sage bg-sage-bg rounded-lg py-2.5 px-4.5 text-[13.5px] font-bold inline-flex items-center gap-1.5 cursor-default select-none">
            <Wallet aria-hidden="true" size={16} />
            Paid Offline
          </div>
        ) : (
          <button
            className="bg-transparent border-[1.5px] border-hairline-strong hover:border-clay text-parchment rounded-lg py-2.5 px-4.5 text-[13.5px] font-bold inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-55"
            disabled={busy}
            onClick={() => onMarkPaid(order.id)}
            type="button"
          >
            <Wallet aria-hidden="true" size={16} />
            Mark Paid Offline
          </button>
        )}
      </div>
    </div>
  );
}
