import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Minus, Plus, RefreshCw, Send, ShoppingCart } from "lucide-react";
import { formatInrFromPaise } from "@d3/shared";
import {
  apiGet,
  apiPost,
  apiPut,
  type Cart,
  type MenuCategory,
  type Order,
  type SessionContext
} from "../../api/client.js";
import { StatusPill } from "../../components/StatusPill.js";
import { ToolbarButton } from "../../components/ToolbarButton.js";

type CustomerOrderPageProps = {
  qrId: string;
  signature: string;
};

type OtpChallenge = {
  challengeId: string;
  expiresAt: string;
  devOtp?: string;
};

export function CustomerOrderPage({ qrId, signature }: CustomerOrderPageProps) {
  const [session, setSession] = useState<SessionContext | null>(null);
  const [tableLabel, setTableLabel] = useState("");
  const [menu, setMenu] = useState<MenuCategory[]>([]);
  const [cart, setCart] = useState<Cart | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [name, setName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const cartQuantities = useMemo(() => {
    const map = new Map<number, number>();

    for (const item of cart?.items ?? []) {
      map.set(item.menuItemId, item.quantity);
    }

    return map;
  }, [cart]);

  const loadCustomerData = useCallback(async () => {
    const [menuResponse, cartResponse, ordersResponse] = await Promise.all([
      apiGet<{ categories: MenuCategory[] }>("/api/menu"),
      apiGet<{ cart: Cart }>("/api/cart"),
      apiGet<{ orders: Order[] }>("/api/orders/current")
    ]);

    setMenu(menuResponse.categories);
    setCart(cartResponse.cart);
    setOrders(ordersResponse.orders);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function boot() {
      try {
        const existing = await apiGet<SessionContext>("/api/auth/customer/session");

        if (!mounted) {
          return;
        }

        setSession(existing);
        setTableLabel(existing.table.label);
        await loadCustomerData();
        return;
      } catch {
        // No existing customer session is fine.
      }

      if (!qrId || !signature) {
        return;
      }

      try {
        const validated = await apiPost<{ table: { label: string } }>("/api/qr/validate", {
          qrId,
          signature
        });

        if (mounted) {
          setTableLabel(validated.table.label);
        }
      } catch (error) {
        if (mounted) {
          setMessage(error instanceof Error ? error.message : "Invalid QR code");
        }
      }
    }

    void boot();

    return () => {
      mounted = false;
    };
  }, [loadCustomerData, qrId, signature]);

  async function requestOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const response = await apiPost<OtpChallenge>("/api/auth/customer/request-otp", {
        name,
        mobileNumber
      });
      setChallenge(response);
      setMessage("OTP sent");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send OTP");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const response = await apiPost<SessionContext>("/api/auth/customer/verify-otp", {
        challengeId: challenge?.challengeId,
        otp
      });
      setSession(response);
      setTableLabel(response.table.label);
      setChallenge(null);
      setOtp("");
      await loadCustomerData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not verify OTP");
    } finally {
      setBusy(false);
    }
  }

  async function setQuantity(menuItemId: number, quantity: number) {
    if (quantity < 0) {
      return;
    }

    setBusy(true);

    try {
      const response = await apiPut<{ cart: Cart }>("/api/cart/items", {
        menuItemId,
        quantity
      });
      setCart(response.cart);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update cart");
    } finally {
      setBusy(false);
    }
  }

  async function placeOrder() {
    setBusy(true);
    setMessage("");

    try {
      const response = await apiPost<{ order: Order }>(
        "/api/orders",
        {},
        { "Idempotency-Key": crypto.randomUUID() }
      );
      setMessage(`Order ${response.order.publicOrderNumber} created. Pay staff offline.`);
      await loadCustomerData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not place order");
    } finally {
      setBusy(false);
    }
  }

  if (!qrId && !session) {
    return (
      <main className="app-shell customer-shell">
        <Header tableLabel="" />
        <section className="empty-state">
          <h2>Scan a D3 table QR</h2>
          <p>The table QR opens this ordering screen with server-verified table context.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell customer-shell">
      <Header tableLabel={tableLabel} />

      {message ? <div className="notice">{message}</div> : null}

      {!session ? (
        <section className="panel auth-panel">
          <h2>Start order</h2>
          <form className="form-grid" onSubmit={requestOtp}>
            <label>
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label>
              Mobile number
              <input
                inputMode="tel"
                value={mobileNumber}
                onChange={(event) => setMobileNumber(event.target.value)}
                required
              />
            </label>
            <ToolbarButton disabled={busy} icon={Send} label="Send OTP" type="submit" variant="primary" />
          </form>

          {challenge ? (
            <form className="form-grid otp-row" onSubmit={verifyOtp}>
              <label>
                OTP
                <input
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  required
                />
              </label>
              <ToolbarButton disabled={busy} icon={Check} label="Verify" type="submit" variant="primary" />
              {challenge.devOtp ? <p className="dev-otp">Development OTP: {challenge.devOtp}</p> : null}
            </form>
          ) : null}
        </section>
      ) : (
        <section className="order-grid">
          <div className="menu-column">
            <div className="section-heading">
              <h2>Menu</h2>
              <ToolbarButton
                disabled={busy}
                icon={RefreshCw}
                label="Refresh"
                onClick={() => void loadCustomerData()}
                variant="quiet"
              />
            </div>

            {menu.length === 0 ? (
              <div className="empty-state">
                <h3>No menu items yet</h3>
                <p>Staff can add categories and items from the admin screen.</p>
              </div>
            ) : (
              menu.map((category) => (
                <section className="menu-section" key={category.id}>
                  <h3>{category.name}</h3>
                  <div className="item-list">
                    {category.items.map((item) => {
                      const quantity = cartQuantities.get(item.id) ?? 0;

                      return (
                        <article className="item-card" key={item.id}>
                          <div>
                            <div className="item-header">
                              <h4>{item.name}</h4>
                              <span className={item.isVeg ? "food-tag veg" : "food-tag non-veg"}>
                                {item.isVeg ? "Veg" : "Non-veg"}
                              </span>
                            </div>
                            <p>{formatInrFromPaise(item.pricePaise)}</p>
                          </div>
                          <div className="stepper" aria-label={`${item.name} quantity`}>
                            <button
                              disabled={busy || quantity === 0}
                              onClick={() => void setQuantity(item.id, quantity - 1)}
                              title="Decrease"
                              type="button"
                            >
                              <Minus aria-hidden="true" size={16} />
                            </button>
                            <span>{quantity}</span>
                            <button
                              disabled={busy}
                              onClick={() => void setQuantity(item.id, quantity + 1)}
                              title="Increase"
                              type="button"
                            >
                              <Plus aria-hidden="true" size={16} />
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))
            )}
          </div>

          <aside className="cart-column">
            <div className="panel">
              <div className="section-heading">
                <h2>Cart</h2>
                <ShoppingCart aria-hidden="true" size={20} />
              </div>
              {cart?.items.length ? (
                <>
                  <ul className="line-list">
                    {cart.items.map((item) => (
                      <li key={item.menuItemId}>
                        <span>
                          <span className={item.isVeg ? "food-tag tiny veg" : "food-tag tiny non-veg"}>
                            {item.isVeg ? "V" : "N"}
                          </span>
                          {item.quantity} x {item.name}
                        </span>
                        <strong>{formatInrFromPaise(item.lineTotalPaise)}</strong>
                      </li>
                    ))}
                  </ul>
                  <div className="total-row">
                    <span>Total</span>
                    <strong>{formatInrFromPaise(cart.totalPaise)}</strong>
                  </div>
                  <ToolbarButton
                    disabled={busy}
                    icon={Check}
                    label="Place Order"
                    onClick={() => void placeOrder()}
                    variant="primary"
                  />
                </>
              ) : (
                <p className="muted">Add items to start an order.</p>
              )}
            </div>

            <div className="panel">
              <h2>Current Orders</h2>
              {orders.length ? (
                <ul className="order-list">
                  {orders.map((order) => (
                    <li key={order.id}>
                      <div>
                        <strong>{order.publicOrderNumber}</strong>
                        <span>{formatInrFromPaise(order.totalPaise)}</span>
                      </div>
                      <div className="pill-row">
                        <StatusPill tone={order.paymentState === "PAID_OFFLINE" ? "success" : "warning"}>
                          {order.paymentState}
                        </StatusPill>
                        <StatusPill tone={order.fulfillmentState === "COMPLETED" ? "success" : "neutral"}>
                          {order.fulfillmentState}
                        </StatusPill>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Orders from this table session will appear here.</p>
              )}
            </div>
          </aside>
        </section>
      )}
    </main>
  );
}

function Header({ tableLabel }: { tableLabel: string }) {
  return (
    <header className="topbar">
      <div>
        <h1>D3</h1>
        <p>{tableLabel ? tableLabel : "QR ordering"}</p>
      </div>
    </header>
  );
}

