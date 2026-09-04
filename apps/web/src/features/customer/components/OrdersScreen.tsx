import { ListChecks } from "lucide-react";
import { formatInrFromPaise } from "@d3/shared";
import type { Order } from "../../../api/client.js";
import { Notice, type NoticeVariant } from "../../../components/Notice.js";

type NoticeState = {
  variant: NoticeVariant;
  title: string;
  subtitle: string;
};

type OrdersScreenProps = {
  customerTableText: string;
  orders: Order[];
  notice: NoticeState | null;
};

export function OrdersScreen({ customerTableText, orders, notice }: OrdersScreenProps) {
  return (
    <section className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="p-3.5 px-5 border-b border-hairline flex items-baseline justify-between shrink-0 bg-surface-1/40">
        <h2 className="text-xs text-clay uppercase tracking-wider font-bold">Your Orders</h2>
        <span className="text-xs text-clay font-medium">
          {orders.length} {orders.length === 1 ? "active order" : "active orders"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 px-5 pb-24">
        {notice ? (
          <Notice variant={notice.variant} title={notice.title} subtitle={notice.subtitle} />
        ) : null}

        {orders.length > 0 ? (
          orders.map((order) => {
            const isPaid = order.paymentState === "PAID_OFFLINE";
            const isReady = order.fulfillmentState === "COMPLETED";

            return (
              <article
                className="bg-surface-1 border border-hairline rounded-[14px] p-4 mb-3 last:mb-0"
                key={order.id}
              >
                <div className="flex justify-between items-start mb-2.5">
                  <div>
                    <div className="text-[13px] font-bold text-parchment">
                      {order.publicOrderNumber}
                    </div>
                    <div className="text-[11.5px] text-clay mt-0.5">
                      Placed {order.createdAt ? "recently" : "just now"}
                    </div>
                  </div>
                  <div className="text-[15px] font-bold text-parchment">
                    {formatInrFromPaise(order.totalPaise)}
                  </div>
                </div>

                <div className="flex gap-1.5 mb-2.5">
                  <span
                    className={`inline-flex items-center text-[10.5px] font-bold py-1 px-2.5 rounded-full uppercase tracking-wider ${
                      isPaid ? "bg-sage-bg text-sage" : "bg-rust-bg text-rust"
                    }`}
                  >
                    {isPaid ? "Paid" : "Unpaid"}
                  </span>
                  <span
                    className={`inline-flex items-center text-[10.5px] font-bold py-1 px-2.5 rounded-full uppercase tracking-wider ${
                      isReady ? "bg-sage-bg text-sage" : "bg-ember-muted text-ember"
                    }`}
                  >
                    {isReady ? "Ready" : "Preparing"}
                  </span>
                </div>

                <div className="grid gap-1.5 text-[11.5px] text-clay border-t border-hairline pt-2.5">
                  {order.items.map((item) => (
                    <div
                      className="flex items-center justify-between gap-3 leading-snug"
                      key={`${order.id}-${item.itemName}`}
                    >
                      <span>
                        {item.quantity} × {item.itemName}
                      </span>
                      <span className="text-parchment font-semibold">
                        {formatInrFromPaise(item.lineTotalPaise)}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center gap-2.5 py-10 px-6 text-center flex-1">
            <div className="w-[52px] h-[52px] flex items-center justify-center rounded-2xl bg-surface-1 border border-hairline text-clay-dim">
              <ListChecks aria-hidden="true" size={20} />
            </div>
            <h3 className="text-[15px] font-bold text-parchment m-0">No orders yet</h3>
            <p className="text-[13px] text-clay max-w-[240px] m-0">
              Your table orders will appear here.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
