import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Bell,
  ChevronRight,
  Grid2x2,
  Home,
  ListChecks,
  Menu,
  Minus,
  Plus,
  ReceiptText,
  Search,
  ShoppingCart
} from "lucide-react";
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
import { Notice, type NoticeVariant } from "../../components/Notice.js";

type CustomerOrderPageProps = {
  qrId: string;
  signature: string;
};

type NoticeState = {
  variant: NoticeVariant;
  title: string;
  subtitle: string;
};

type Screen = "landing" | "auth" | "home" | "menu" | "cart" | "orders";

const NAV_SCREENS: Screen[] = ["home", "menu", "cart", "orders"];

function formatPaymentState(state: string): string {
  switch (state) {
    case "PAID_OFFLINE": return "Paid";
    case "UNPAID": return "Unpaid";
    default: return state;
  }
}

function formatFulfillmentState(state: string): string {
  switch (state) {
    case "PENDING": return "Preparing";
    case "COMPLETED": return "Ready";
    default: return state;
  }
}

function paymentBadgeClass(state: string): string {
  return state === "PAID_OFFLINE" ? "badge badge-paid" : "badge badge-unpaid";
}

function fulfillmentBadgeClass(state: string): string {
  return state === "COMPLETED" ? "badge badge-completed" : "badge badge-preparing";
}

export function CustomerOrderPage({ qrId, signature }: CustomerOrderPageProps) {
  const [screen, setScreen] = useState<Screen>("landing");
  const [session, setSession] = useState<SessionContext | null>(null);
  const [tableLabel, setTableLabel] = useState("");
  const [menu, setMenu] = useState<MenuCategory[]>([]);
  const [cart, setCart] = useState<Cart | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const selectedCategory =
    menu.find((category) => category.id === selectedCategoryId) ?? menu[0] ?? null;

  const cartQuantities = useMemo(() => {
    const map = new Map<number, number>();
    for (const item of cart?.items ?? []) {
      map.set(item.menuItemId, item.quantity);
    }
    return map;
  }, [cart]);

  const cartCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const cartTotal = cart?.totalPaise ?? 0;

  const loadCustomerData = useCallback(async () => {
    const [menuResponse, cartResponse, ordersResponse] = await Promise.all([
      apiGet<{ categories: MenuCategory[] }>("/api/menu"),
      apiGet<{ cart: Cart }>("/api/cart"),
      apiGet<{ orders: Order[] }>("/api/orders/current")
    ]);

    setMenu(menuResponse.categories);
    setCart(cartResponse.cart);
    setOrders(ordersResponse.orders);
    setSelectedCategoryId((current) => current ?? menuResponse.categories[0]?.id ?? null);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function boot() {
      try {
        const existing = await apiGet<SessionContext>("/api/auth/customer/session");
        if (!mounted) return;

        setSession(existing);
        setTableLabel(existing.table.label);
        setScreen("home");
        await loadCustomerData();
        return;
      } catch {
        // no active session
      }

      if (!qrId || !signature) {
        setScreen("landing");
        return;
      }

      try {
        const validated = await apiPost<{ table: { label: string } }>("/api/qr/validate", {
          qrId,
          signature
        });
        if (mounted) {
          setTableLabel(validated.table.label);
          setScreen("landing");
        }
      } catch (error) {
        if (mounted) {
          setNotice({
            variant: "error",
            title: "Invalid QR",
            subtitle: error instanceof Error ? error.message : "The table QR could not be validated."
          });
          setScreen("landing");
        }
      }
    }

    void boot();
    return () => {
      mounted = false;
    };
  }, [loadCustomerData, qrId, signature]);

  // Auto-sync customer orders (e.g. food preparation progress) in background
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => {
      apiGet<{ orders: Order[] }>("/api/customer/orders")
        .then((response) => setOrders(response.orders))
        .catch(() => {});
    }, 15000);

    return () => clearInterval(interval);
  }, [session]);

  useEffect(() => {
    if (!menu.length) return;
    setSelectedCategoryId((current) => current ?? menu[0]?.id ?? null);
  }, [menu]);

  async function loginCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);

    try {
      const response = await apiPost<SessionContext>("/api/auth/customer/login", {
        name,
        mobileNumber
      });
      setSession(response);
      setTableLabel(response.table.label);
      setScreen("home");
      await loadCustomerData();
    } catch (error) {
      setNotice({
        variant: "error",
        title: "Could not start order",
        subtitle: error instanceof Error ? error.message : "Please check your details and try again."
      });
    } finally {
      setBusy(false);
    }
  }

  async function setQuantity(menuItemId: number, quantity: number) {
    if (quantity < 0) return;
    setBusy(true);

    try {
      const response = await apiPut<{ cart: Cart }>("/api/cart/items", {
        menuItemId,
        quantity
      });
      setCart(response.cart);
    } catch (error) {
      setNotice({
        variant: "error",
        title: "Cart update failed",
        subtitle: error instanceof Error ? error.message : "Could not update the cart."
      });
    } finally {
      setBusy(false);
    }
  }

  async function placeOrder() {
    setBusy(true);
    setNotice(null);

    try {
      const response = await apiPost<{ order: Order }>(
        "/api/orders",
        {},
        { "Idempotency-Key": crypto.randomUUID() }
      );
      await loadCustomerData();
      setNotice({
        variant: "success",
        title: "Order placed",
        subtitle: `${response.order.publicOrderNumber} • pay staff offline when ready.`
      });
      setScreen("orders");
    } catch (error) {
      setNotice({
        variant: "error",
        title: "Order failed",
        subtitle: error instanceof Error ? error.message : "The order could not be placed."
      });
    } finally {
      setBusy(false);
    }
  }

  const tableShortLabel = tableLabel
    ? `T${String(tableLabel).match(/\d+/)?.[0] ?? tableLabel}`
    : "T1";
  const customerTableText = tableLabel
    ? `Table ${tableLabel.replace(/^Table\s*/i, "")}`
    : "Table 1";

  const showNav = NAV_SCREENS.includes(screen);

  return (
    <div className="customer-shell">
      <div className="customer-app">
        {/* ---- Landing ---- */}
        {screen === "landing" ? (
          <section className={`c-screen c-screen--landing active`}>
            <div className="landing-card">
              <div className="brand-mark">D3</div>
              <h1>D3</h1>
              <p>{customerTableText} · Scan confirmed</p>
              <button
                className="btn-primary"
                onClick={() => setScreen(session ? "home" : "auth")}
                type="button"
              >
                Order food
                <ArrowRight aria-hidden="true" size={16} />
              </button>
            </div>
          </section>
        ) : null}

        {/* ---- Auth ---- */}
        {screen === "auth" ? (
          <section className="c-screen c-screen--auth active">
            <div className="auth-card">
              <h1>Start your order</h1>
              <div className="auth-subtitle">{customerTableText} · D3</div>

              {notice ? (
                <Notice variant={notice.variant} title={notice.title} subtitle={notice.subtitle} />
              ) : null}

              <form onSubmit={loginCustomer}>
                <div className="field">
                  <label className="field-label" htmlFor="customer-name">
                    Name
                  </label>
                  <input
                    id="customer-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Your name"
                    required
                  />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="customer-mobile">
                    Mobile number
                  </label>
                  <input
                    id="customer-mobile"
                    inputMode="tel"
                    value={mobileNumber}
                    onChange={(event) => setMobileNumber(event.target.value)}
                    placeholder="10-digit mobile number"
                    required
                  />
                </div>

                <button className="btn-primary" disabled={busy} type="submit">
                  Start ordering
                  <ArrowRight aria-hidden="true" size={16} />
                </button>
              </form>
            </div>
          </section>
        ) : null}

        {/* ---- Home ---- */}
        {screen === "home" ? (
          <section className="c-screen c-screen--home active">
            <div className="home-header">
              <div>
                <div className="greeting">Hi {session?.customer.name ?? "there"}</div>
                <div className="c-topbar__sub">{customerTableText} · D3</div>
              </div>
              <div className="table-badge">{tableShortLabel}</div>
            </div>

            <div className="home-grid">
              <button className="home-tile" onClick={() => setScreen("menu")} type="button">
                <span className="tile-icon">
                  <Grid2x2 aria-hidden="true" size={18} />
                </span>
                <span className="tile-label">Menu</span>
                <span className="tile-meta">
                  {menu.length > 0
                    ? `${menu.reduce((n, c) => n + c.items.length, 0)} items across ${menu.length} ${menu.length === 1 ? "category" : "categories"}`
                    : "Browse our menu"}
                </span>
              </button>

              <button className="home-tile" onClick={() => setScreen("cart")} type="button">
                <span className="tile-icon">
                  <ShoppingCart aria-hidden="true" size={18} />
                </span>
                <span className="tile-label">Cart</span>
                <span className="tile-meta">
                  {cartCount > 0
                    ? `${cartCount} item${cartCount > 1 ? "s" : ""} · ${formatInrFromPaise(cartTotal)}`
                    : "Empty"}
                </span>
              </button>

              <button className="home-tile" onClick={() => setScreen("orders")} type="button">
                <span className="tile-icon">
                  <ReceiptText aria-hidden="true" size={18} />
                </span>
                <span className="tile-label">Orders</span>
                <span className="tile-meta">
                  {orders.length > 0
                    ? `${orders.length} active order${orders.length > 1 ? "s" : ""}`
                    : "No orders yet"}
                </span>
              </button>

              <button className="home-tile" type="button" disabled>
                <span className="tile-icon">
                  <Bell aria-hidden="true" size={18} />
                </span>
                <span className="tile-label">Call staff</span>
                <span className="tile-meta">Request assistance</span>
              </button>
            </div>
          </section>
        ) : null}

        {/* ---- Menu ---- */}
        {screen === "menu" ? (
          <section className="c-screen c-screen--menu active">
            <header className="c-topbar">
              <div>
                <div className="c-topbar__title">Menu</div>
                <div className="c-topbar__sub">{customerTableText}</div>
              </div>
              <button className="icon-btn" aria-label="Search menu" type="button">
                <Search aria-hidden="true" size={18} />
              </button>
            </header>

            <div className="category-rail" aria-label="Menu categories">
              {menu.map((category) => (
                <button
                  key={category.id}
                  className={`category-chip${selectedCategory?.id === category.id ? " active" : ""}`}
                  onClick={() => setSelectedCategoryId(category.id)}
                  type="button"
                >
                  {category.name}
                </button>
              ))}
            </div>

            <div className="menu-scroll">
              {selectedCategory ? (
                <>
                  <div className="section-label">{selectedCategory.name}</div>
                  {selectedCategory.items.map((item) => {
                    const quantity = cartQuantities.get(item.id) ?? 0;
                    return (
                      <div className="menu-item-row" key={item.id}>
                        <div className="menu-item__info">
                          <div className="menu-item__name-row">
                            <span
                              className={`veg-dot ${item.isVeg ? "veg" : "nonveg"}`}
                              aria-hidden="true"
                            />
                            <span className="menu-item__name">{item.name}</span>
                          </div>
                          <div className="menu-item__meta">{formatInrFromPaise(item.pricePaise)}</div>
                        </div>

                        <div className="menu-item__action">
                          {quantity > 0 ? (
                            <div className="stepper" aria-label={`${item.name} quantity`}>
                              <button
                                className="stepper__dec"
                                aria-label={`Decrease ${item.name}`}
                                onClick={() => void setQuantity(item.id, quantity - 1)}
                                type="button"
                              >
                                −
                              </button>
                              <span className="stepper__qty">{quantity}</span>
                              <button
                                className="stepper__inc"
                                aria-label={`Increase ${item.name}`}
                                onClick={() => void setQuantity(item.id, quantity + 1)}
                                type="button"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              className="add-btn"
                              aria-label={`Add ${item.name}`}
                              onClick={() => void setQuantity(item.id, 1)}
                              type="button"
                            >
                              Add
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="empty-state">
                  <div className="empty-state__icon">
                    <Menu aria-hidden="true" size={22} />
                  </div>
                  <h3>No menu items yet</h3>
                  <p>Staff can add items from the admin dashboard.</p>
                </div>
              )}
            </div>

            {cartCount > 0 ? (
              <button className="cart-fab" onClick={() => setScreen("cart")} type="button">
                <span className="cart-fab__left">
                  <span className="cart-fab__count">{cartCount}</span>
                  <span className="cart-fab__amount">{formatInrFromPaise(cartTotal)}</span>
                </span>
                <span className="cart-fab__view">
                  View cart
                  <ChevronRight aria-hidden="true" size={14} />
                </span>
              </button>
            ) : null}
          </section>
        ) : null}

        {/* ---- Cart ---- */}
        {screen === "cart" ? (
          <section className="c-screen c-screen--cart active">
            <header className="c-topbar c-topbar--plain">
              <span className="c-topbar__sub">Your cart</span>
              <span className="c-topbar__sub">
                {cartCount} item{cartCount !== 1 ? "s" : ""}
              </span>
            </header>

            {cart && cart.items.length > 0 ? (
              <>
                <div className="cart-scroll">
                  {cart.items.map((item) => (
                    <div className="cart-item-row" key={item.menuItemId}>
                      <div className="cart-item__details">
                        <div className="cart-item__name">{item.name}</div>
                        <div className="cart-item__meta">
                          {item.quantity} × {formatInrFromPaise(item.unitPricePaise)}
                        </div>
                      </div>

                      <div className="cart-item__right">
                        <div className="stepper" aria-label={`${item.name} quantity`}>
                          <button
                            className="stepper__dec"
                            aria-label={`Decrease ${item.name}`}
                            onClick={() => void setQuantity(item.menuItemId, item.quantity - 1)}
                            type="button"
                          >
                            −
                          </button>
                          <span className="stepper__qty">{item.quantity}</span>
                          <button
                            className="stepper__inc"
                            aria-label={`Increase ${item.name}`}
                            onClick={() => void setQuantity(item.menuItemId, item.quantity + 1)}
                            type="button"
                          >
                            +
                          </button>
                        </div>
                        <div className="cart-item__total">{formatInrFromPaise(item.lineTotalPaise)}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="cart-summary">
                  <div className="summary-line">
                    <span>Subtotal</span>
                    <span>{formatInrFromPaise(cartTotal)}</span>
                  </div>
                  <div className="summary-line summary-line--total">
                    <span>Total</span>
                    <span>{formatInrFromPaise(cartTotal)}</span>
                  </div>
                  <button
                    className="btn-primary"
                    disabled={busy}
                    onClick={() => void placeOrder()}
                    type="button"
                  >
                    Place order · pay at table
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-state__icon">
                  <ShoppingCart aria-hidden="true" size={22} />
                </div>
                <h3>Your cart is empty</h3>
                <p>Add items from the menu to start an order.</p>
              </div>
            )}
          </section>
        ) : null}

        {/* ---- Orders ---- */}
        {screen === "orders" ? (
          <section className="c-screen c-screen--orders active">
            <header className="c-topbar c-topbar--plain">
              <span className="c-topbar__sub">Your orders</span>
              <span className="c-topbar__sub">{customerTableText}</span>
            </header>

            <div className="order-screen-body">
              {notice ? (
                <Notice variant={notice.variant} title={notice.title} subtitle={notice.subtitle} />
              ) : null}

              {orders.length > 0 ? (
                orders.map((order) => (
                  <article className="customer-order-card" key={order.id}>
                    <div className="customer-order-card__top">
                      <div>
                        <div className="customer-order-card__id">{order.publicOrderNumber}</div>
                        <div className="customer-order-card__time">
                          Placed {order.createdAt ? "recently" : "just now"}
                        </div>
                      </div>
                      <div className="customer-order-card__total">
                        {formatInrFromPaise(order.totalPaise)}
                      </div>
                    </div>

                    <div className="badge-row">
                      <span className={paymentBadgeClass(order.paymentState)}>
                        {formatPaymentState(order.paymentState)}
                      </span>
                      <span className={fulfillmentBadgeClass(order.fulfillmentState)}>
                        {formatFulfillmentState(order.fulfillmentState)}
                      </span>
                    </div>

                    <div className="customer-order-card__items">
                      {order.items.map((item) => (
                        <div className="customer-order-card__line" key={`${order.id}-${item.itemName}`}>
                          <span>
                            {item.quantity} × {item.itemName}
                          </span>
                          <span>{formatInrFromPaise(item.lineTotalPaise)}</span>
                        </div>
                      ))}
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state">
                  <div className="empty-state__icon">
                    <ListChecks aria-hidden="true" size={20} />
                  </div>
                  <h3>No orders yet</h3>
                  <p>Your table orders will appear here.</p>
                </div>
              )}
            </div>
          </section>
        ) : null}

        {/* ---- Bottom Nav (shown on all post-auth screens) ---- */}
        {showNav ? (
          <nav className="bottom-nav" aria-label="Primary">
            <button
              className={`nav-item${screen === "home" ? " active" : ""}`}
              onClick={() => setScreen("home")}
              type="button"
            >
              <Home aria-hidden="true" size={21} />
              <span>Home</span>
            </button>
            <button
              className={`nav-item${screen === "menu" ? " active" : ""}`}
              onClick={() => setScreen("menu")}
              type="button"
            >
              <Grid2x2 aria-hidden="true" size={21} />
              <span>Menu</span>
            </button>
            <button
              className={`nav-item${screen === "cart" ? " active" : ""}`}
              onClick={() => setScreen("cart")}
              type="button"
            >
              <span className="nav-badge-wrap">
                <ShoppingCart aria-hidden="true" size={21} />
                {cartCount > 0 ? <span className="nav-badge">{cartCount}</span> : null}
              </span>
              <span>Cart</span>
            </button>
            <button
              className={`nav-item${screen === "orders" ? " active" : ""}`}
              onClick={() => setScreen("orders")}
              type="button"
            >
              <ReceiptText aria-hidden="true" size={21} />
              <span>Orders</span>
            </button>
          </nav>
        ) : null}
      </div>
    </div>
  );
}
