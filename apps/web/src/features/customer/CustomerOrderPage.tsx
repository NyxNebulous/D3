import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  apiGet,
  apiPost,
  apiPut,
  setAuthToken,
  type Cart,
  type CartItem,
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
import { BugReportModal } from "./components/BugReportModal.js";

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
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem("d3_customer_name") || "";
    } catch {
      return "";
    }
  });
  const [mobileNumber, setMobileNumber] = useState(() => {
    try {
      return localStorage.getItem("d3_customer_mobile") || "";
    } catch {
      return "";
    }
  });
  const [busy, setBusy] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [isBugModalOpen, setIsBugModalOpen] = useState(false);

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
    syncedCartRef.current = cartResponse.cart;
    setOrders(ordersResponse.orders);
    setSelectedCategoryId((current) => current ?? menuResponse.categories[0]?.id ?? null);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function boot() {
      try {
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
            if (session?.customer) {
              setName((prev) => prev || session.customer.name);
              setMobileNumber((prev) => prev || session.customer.mobileNumber);
            }
            setSession(null);
            setCart(null);
            syncedCartRef.current = null;
            pendingSyncRef.current.clear();
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
          syncedCartRef.current = null;
          pendingSyncRef.current.clear();
          setOrders([]);
          setTableLabel("");
          setScreen("landing");
        }
      } finally {
        if (mounted) setIsBooting(false);
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
      try {
        localStorage.setItem("d3_customer_name", name);
        localStorage.setItem("d3_customer_mobile", mobileNumber);
      } catch {}
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

  const menuRef = useRef<MenuCategory[]>(menu);
  useEffect(() => {
    menuRef.current = menu;
  }, [menu]);

  // Serialized, coalescing background sync queue to eliminate race conditions
  const pendingSyncRef = useRef<Map<number, number>>(new Map());
  const isSyncingRef = useRef<boolean>(false);
  const syncedCartRef = useRef<Cart | null>(null);
  const syncResolversRef = useRef<Array<() => void>>([]);

  const triggerSync = useCallback(() => {
    if (isSyncingRef.current) {
      return;
    }
    if (pendingSyncRef.current.size === 0) {
      const waiters = syncResolversRef.current;
      syncResolversRef.current = [];
      for (const resolve of waiters) resolve();
      return;
    }

    isSyncingRef.current = true;

    (async () => {
      try {
        while (pendingSyncRef.current.size > 0) {
          // Take all pending entries as a batch to minimize Cloudflare roundtrips
          const batchEntries = Array.from(pendingSyncRef.current.entries());
          const batch = batchEntries.map(([menuItemId, quantity]) => ({
            menuItemId,
            quantity
          }));

          // Remove the entries we are currently sending
          for (const [id] of batchEntries) {
            pendingSyncRef.current.delete(id);
          }

          try {
            const payload = batch.length === 1 ? batch[0] : { items: batch };
            const response = await apiPut<{ cart: Cart }>("/api/cart/items", payload);

            syncedCartRef.current = response.cart;

            // Only overwrite local React items if NO newer mutations were queued while in-flight!
            // If the user tapped other items while this request was traveling,
            // pendingSyncRef will have new entries and response.cart is stale for those items.
            if (pendingSyncRef.current.size === 0) {
              setCart(response.cart);
            } else {
              setCart((current) => {
                if (!current) return response.cart;
                return {
                  ...current,
                  id: response.cart.id || current.id
                };
              });
            }
          } catch (error) {
            // Revert ONLY the items from this failed batch using the last confirmed syncedCartRef
            const fallbackCart = syncedCartRef.current;
            setCart((currentCart) => {
              if (!currentCart) return fallbackCart;
              const fallbackItemsMap = new Map<number, CartItem>();
              for (const item of fallbackCart?.items ?? []) {
                fallbackItemsMap.set(item.menuItemId, item);
              }

              const failedIds = new Set(batch.map((b) => b.menuItemId));
              const currentItems = currentCart.items;
              const reconciledItems: CartItem[] = [];

              for (const item of currentItems) {
                if (failedIds.has(item.menuItemId) && !pendingSyncRef.current.has(item.menuItemId)) {
                  const fallbackItem = fallbackItemsMap.get(item.menuItemId);
                  if (fallbackItem && fallbackItem.quantity > 0) {
                    reconciledItems.push(fallbackItem);
                  }
                } else {
                  reconciledItems.push(item);
                }
              }

              for (const b of batch) {
                if (
                  b.quantity === 0 &&
                  !pendingSyncRef.current.has(b.menuItemId) &&
                  !reconciledItems.some((i) => i.menuItemId === b.menuItemId)
                ) {
                  const fallbackItem = fallbackItemsMap.get(b.menuItemId);
                  if (fallbackItem && fallbackItem.quantity > 0) {
                    reconciledItems.push(fallbackItem);
                  }
                }
              }

              const totalPaise = reconciledItems.reduce((sum, i) => sum + i.lineTotalPaise, 0);
              return {
                id: currentCart.id,
                items: reconciledItems,
                totalPaise,
                currency: "INR"
              };
            });

            setNotice({
              variant: "error",
              title: "Cart update failed",
              subtitle: error instanceof Error ? error.message : "Could not update item quantity."
            });
          }
        }
      } finally {
        isSyncingRef.current = false;
        if (pendingSyncRef.current.size > 0) {
          triggerSync();
        } else {
          const waiters = syncResolversRef.current;
          syncResolversRef.current = [];
          for (const resolve of waiters) resolve();
        }
      }
    })();
  }, []);

  const waitForCartSync = useCallback(async () => {
    if (!isSyncingRef.current && pendingSyncRef.current.size === 0) {
      return;
    }
    return new Promise<void>((resolve) => {
      syncResolversRef.current.push(resolve);
    });
  }, []);

  function setQuantity(menuItemId: number, quantity: number) {
    if (quantity < 0) return;

    // Track the target quantity for the sync queue
    pendingSyncRef.current.set(menuItemId, quantity);

    // Optimistically update React state immediately (0ms visual feedback)
    setCart((currentCart) => {
      const existingItems = currentCart?.items ?? [];
      let updatedItems: CartItem[];

      if (quantity <= 0) {
        updatedItems = existingItems.filter((i) => i.menuItemId !== menuItemId);
      } else {
        const itemIndex = existingItems.findIndex((i) => i.menuItemId === menuItemId);
        if (itemIndex >= 0) {
          const existing = existingItems[itemIndex]!;
          const updated: CartItem = {
            ...existing,
            quantity,
            lineTotalPaise: quantity * existing.unitPricePaise
          };
          updatedItems = [
            ...existingItems.slice(0, itemIndex),
            updated,
            ...existingItems.slice(itemIndex + 1)
          ];
        } else {
          // Find item details from menu categories
          let foundInfo: { name: string; categoryName: string; isVeg: boolean; pricePaise: number } | null = null;
          for (const category of menuRef.current) {
            const match = category.items.find((i) => i.id === menuItemId);
            if (match) {
              foundInfo = {
                name: match.name,
                categoryName: category.name,
                isVeg: match.isVeg,
                pricePaise: match.pricePaise
              };
              break;
            }
          }

          if (foundInfo) {
            const newItem: CartItem = {
              menuItemId,
              name: foundInfo.name,
              categoryName: foundInfo.categoryName,
              isVeg: foundInfo.isVeg,
              quantity,
              unitPricePaise: foundInfo.pricePaise,
              lineTotalPaise: quantity * foundInfo.pricePaise
            };
            updatedItems = [...existingItems, newItem];
          } else {
            updatedItems = existingItems;
          }
        }
      }

      const totalPaise = updatedItems.reduce((sum, item) => sum + item.lineTotalPaise, 0);

      return {
        id: currentCart?.id ?? 0,
        items: updatedItems,
        totalPaise,
        currency: "INR"
      };
    });

    // Start background sync if not already active
    triggerSync();
  }

  async function placeOrder() {
    setBusy(true);
    setNotice(null);

    // Guarantee all pending/in-flight cart updates have settled before creating the order
    await waitForCartSync();

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
    <div className="h-full w-full bg-canvas flex justify-center overflow-hidden">
      <div className="w-full max-w-[480px] h-full flex flex-col bg-ink relative overflow-hidden">
        {isBooting ? (
          <section
            className="flex flex-col flex-1 min-h-dvh justify-center items-center bg-[radial-gradient(circle_at_30%_20%,rgba(255,107,53,0.18),transparent_55%),radial-gradient(circle_at_75%_75%,rgba(255,107,53,0.1),transparent_50%),theme(colors.ink)] p-5"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-lg bg-ember flex items-center justify-center text-[22px] font-extrabold text-[#1a0d06] tracking-tight mb-5">
                D3
              </div>
              <div className="w-6 h-6 rounded-full border-2 border-ember/30 border-t-ember animate-spin mb-4" />
              <p className="text-[13px] text-clay">Checking your table...</p>
            </div>
          </section>
        ) : null}

        {!isBooting && HEADER_SCREENS.includes(screen) ? (
          <CustomerHeader
            customerTableText={customerTableText}
            onReportBug={() => setIsBugModalOpen(true)}
          />
        ) : null}

        {!isBooting && screen === "landing" ? (
          <LandingScreen
            customerTableText={customerTableText}
            onProceed={() => setScreen(session ? "home" : "auth")}
            notice={notice}
            onReportBug={() => setIsBugModalOpen(true)}
          />
        ) : null}

        {!isBooting && screen === "auth" ? (
          <AuthScreen
            customerTableText={customerTableText}
            name={name}
            onNameChange={setName}
            mobileNumber={mobileNumber}
            onMobileNumberChange={setMobileNumber}
            onSubmit={loginCustomer}
            busy={busy}
            notice={notice}
            onReportBug={() => setIsBugModalOpen(true)}
          />
        ) : null}

        {!isBooting && screen === "home" ? (
          <HomeScreen
            session={session}
            customerTableText={customerTableText}
            tableShortLabel={tableShortLabel}
            menu={menu}
            cartCount={cartCount}
            cartTotal={cartTotal}
            orders={orders}
            onNavigate={(nextScreen) => setScreen(nextScreen)}
            onReportBug={() => setIsBugModalOpen(true)}
          />
        ) : null}

        {!isBooting && screen === "menu" ? (
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

        {!isBooting && screen === "cart" ? (
          <CartScreen
            cart={cart}
            cartCount={cartCount}
            cartTotal={cartTotal}
            onSetQuantity={(itemId, qty) => void setQuantity(itemId, qty)}
            onPlaceOrder={() => void placeOrder()}
            busy={busy}
          />
        ) : null}

        {!isBooting && screen === "orders" ? (
          <OrdersScreen
            customerTableText={customerTableText}
            orders={orders}
            notice={notice}
          />
        ) : null}

        {!isBooting && showNav ? (
          <CustomerBottomNav
            activeScreen={screen}
            cartCount={cartCount}
            onSelectScreen={(nextScreen) => setScreen(nextScreen)}
          />
        ) : null}

        <BugReportModal
          isOpen={isBugModalOpen}
          onClose={() => setIsBugModalOpen(false)}
          tableLabel={tableLabel}
          screenName={screen}
          customerName={session?.customer.name || name}
          customerMobile={session?.customer.mobileNumber || mobileNumber}
        />
      </div>
    </div>
  );
}
