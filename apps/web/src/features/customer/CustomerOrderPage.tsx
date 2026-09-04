import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  apiGet,
  apiPost,
  apiPut,
  setAuthToken,
  type Cart,
  type MenuCategory,
  type Order,
  type SessionContext
} from "../../api/client.js";
import type { NoticeVariant } from "../../components/Notice.js";
import { AuthScreen } from "./components/AuthScreen.js";
import { CartScreen } from "./components/CartScreen.js";
import { CustomerBottomNav, type CustomerScreen } from "./components/CustomerBottomNav.js";
import { CustomerHeader } from "./components/CustomerHeader.js";
import { HomeScreen } from "./components/HomeScreen.js";
import { LandingScreen } from "./components/LandingScreen.js";
import { MenuScreen } from "./components/MenuScreen.js";
import { OrdersScreen } from "./components/OrdersScreen.js";

type CustomerOrderPageProps = {
  qrId: string;
  signature: string;
};

type NoticeState = {
  variant: NoticeVariant;
  title: string;
  subtitle: string;
};

const NAV_SCREENS: CustomerScreen[] = ["home", "menu", "cart", "orders"];
const HEADER_SCREENS: CustomerScreen[] = ["menu", "cart", "orders"];

export function CustomerOrderPage({ qrId, signature }: CustomerOrderPageProps) {
  const [screen, setScreen] = useState<CustomerScreen>("landing");
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

  const cartQuantities = useMemo(() => {
    const map = new Map<number, number>();
    for (const item of cart?.items ?? []) {
      map.set(item.menuItemId, item.quantity);
    }
    return map;
  }, [cart]);

  const cartCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const cartTotal = cart?.totalPaise ?? 0;

  // Auto-dismiss notice after 4 seconds
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => {
      setNotice(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [notice]);

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
      // 1. If QR parameters are provided in URL, prioritize validating the scanned table QR!
      if (qrId && signature) {
        try {
          const validated = await apiPost<{
            token?: string;
            table: { label: string };
            sameTableSession?: boolean;
          }>("/api/qr/validate", {
            qrId,
            signature
          });

          if (!mounted) return;

          // Check if the customer already has an active session for THIS SAME table
          let isSameTable = validated.sameTableSession;
          if (isSameTable === undefined) {
            try {
              const existing = await apiGet<SessionContext>("/api/auth/customer/session");
              isSameTable = existing.table.label === validated.table.label;
              if (isSameTable && mounted) {
                setSession(existing);
                setTableLabel(existing.table.label);
                setScreen("home");
                await loadCustomerData();
                return;
              }
            } catch {
              isSameTable = false;
            }
          } else if (isSameTable) {
            try {
              const existing = await apiGet<SessionContext>("/api/auth/customer/session");
              if (mounted) {
                setSession(existing);
                setTableLabel(existing.table.label);
                setScreen("home");
                await loadCustomerData();
                return;
              }
            } catch {
              isSameTable = false;
            }
          }

          // New table or no active session for this table:
          // Replace auth token with new pre-session token, clear old session state, and land on new table
          if (validated.token) {
            setAuthToken(validated.token);
          }
          setSession(null);
          setCart(null);
          setOrders([]);
          setTableLabel(validated.table.label);
          setScreen("landing");
          return;
        } catch (error) {
          if (!mounted) return;
          setNotice({
            variant: "error",
            title: "Invalid QR",
            subtitle: error instanceof Error ? error.message : "The table QR could not be validated."
          });
          setScreen("landing");
          return;
        }
      }

      // 2. If NO QR parameters in URL (e.g. reload on root / without params)
      try {
        const existing = await apiGet<SessionContext>("/api/auth/customer/session");
        if (!mounted) return;

        setSession(existing);
        setTableLabel(existing.table.label);
        setScreen("home");
        await loadCustomerData();
      } catch {
        if (!mounted) return;
        setSession(null);
        setCart(null);
        setOrders([]);
        setTableLabel("");
        setScreen("landing");
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
      const response = await apiPost<SessionContext & { token?: string }>("/api/auth/customer/login", {
        name,
        mobileNumber
      });
      if (response.token) {
        setAuthToken(response.token);
      }
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
        subtitle: error instanceof Error ? error.message : "Could not update item quantity."
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
    : "";
  const customerTableText = tableLabel
    ? `Table ${tableLabel.replace(/^Table\s*/i, "")}`
    : "";

  const showNav = NAV_SCREENS.includes(screen);

  return (
    <div className="h-dvh min-h-dvh w-full bg-canvas flex justify-center overflow-hidden">
      <div className="w-full max-w-[480px] h-dvh max-h-dvh flex flex-col bg-ink relative overflow-hidden">
        {HEADER_SCREENS.includes(screen) ? (
          <CustomerHeader customerTableText={customerTableText} />
        ) : null}

        {screen === "landing" ? (
          <LandingScreen
            customerTableText={customerTableText}
            onProceed={() => setScreen(session ? "home" : "auth")}
          />
        ) : null}

        {screen === "auth" ? (
          <AuthScreen
            customerTableText={customerTableText}
            name={name}
            onNameChange={setName}
            mobileNumber={mobileNumber}
            onMobileNumberChange={setMobileNumber}
            onSubmit={loginCustomer}
            busy={busy}
            notice={notice}
          />
        ) : null}

        {screen === "home" ? (
          <HomeScreen
            session={session}
            customerTableText={customerTableText}
            tableShortLabel={tableShortLabel}
            menu={menu}
            cartCount={cartCount}
            cartTotal={cartTotal}
            orders={orders}
            onNavigate={(nextScreen) => setScreen(nextScreen)}
          />
        ) : null}

        {screen === "menu" ? (
          <MenuScreen
            customerTableText={customerTableText}
            menu={menu}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={setSelectedCategoryId}
            cartQuantities={cartQuantities}
            onSetQuantity={(itemId, qty) => void setQuantity(itemId, qty)}
            cartCount={cartCount}
            cartTotal={cartTotal}
            onGoToCart={() => setScreen("cart")}
            busy={busy}
          />
        ) : null}

        {screen === "cart" ? (
          <CartScreen
            cart={cart}
            cartCount={cartCount}
            cartTotal={cartTotal}
            onSetQuantity={(itemId, qty) => void setQuantity(itemId, qty)}
            onPlaceOrder={() => void placeOrder()}
            busy={busy}
          />
        ) : null}

        {screen === "orders" ? (
          <OrdersScreen
            customerTableText={customerTableText}
            orders={orders}
            notice={notice}
          />
        ) : null}

        {showNav ? (
          <CustomerBottomNav
            activeScreen={screen}
            cartCount={cartCount}
            onSelectScreen={(nextScreen) => setScreen(nextScreen)}
          />
        ) : null}
      </div>
    </div>
  );
}
