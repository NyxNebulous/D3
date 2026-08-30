import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Check,
  ChevronLeft,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Wallet
} from "lucide-react";
import { formatInrFromPaise } from "@d3/shared";
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  type MenuCategory,
  type MenuItem,
  type Order
} from "../../api/client.js";
import { Notice, type NoticeVariant } from "../../components/Notice.js";

type StaffSession = {
  staff: {
    id: number;
    username: string;
  };
};

type NoticeState = {
  variant: NoticeVariant;
  title: string;
  subtitle: string;
};

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

function sortOrders(orders: Order[]): Order[] {
  // Sort priority:
  // 1. Unpaid + Pending (New / In Kitchen) - Top Priority
  // 2. Unpaid + Completed (Ready, Awaiting Payment)
  // 3. Paid + Pending (Paid, In Kitchen)
  // 4. Paid + Completed (Fully Settled) - Bottom
  return [...orders].sort((a, b) => {
    const aSettled = a.paymentState === "PAID_OFFLINE" && a.fulfillmentState === "COMPLETED";
    const bSettled = b.paymentState === "PAID_OFFLINE" && b.fulfillmentState === "COMPLETED";
    if (aSettled !== bSettled) return aSettled ? 1 : -1;

    const aPrepared = a.fulfillmentState === "COMPLETED";
    const bPrepared = b.fulfillmentState === "COMPLETED";
    if (aPrepared !== bPrepared) return aPrepared ? 1 : -1;

    const aPaid = a.paymentState === "PAID_OFFLINE";
    const bPaid = b.paymentState === "PAID_OFFLINE";
    if (aPaid !== bPaid) return aPaid ? 1 : -1;

    return b.id - a.id;
  });
}

export function AdminPage() {
  const [staff, setStaff] = useState<StaffSession["staff"] | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [menu, setMenu] = useState<MenuCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"orders" | "menu">("orders");
  const [showMobileDetail, setShowMobileDetail] = useState(false);

  // Category state
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showAddCatForm, setShowAddCatForm] = useState(false);
  const [renamingCategory, setRenamingCategory] = useState<MenuCategory | null>(null);
  const [renameCategoryValue, setRenameCategoryValue] = useState("");

  // Item state
  const [newItem, setNewItem] = useState({ categoryId: "", name: "", price: "", isVeg: true });
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  // Confirm delete modal state (replaces browser confirm dialog)
  const [confirmDelete, setConfirmDelete] = useState<{
    type: "category" | "item";
    id: number;
    name: string;
  } | null>(null);

  const [busy, setBusy] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const toPrepareOrders = useMemo(
    () => orders.filter((o) => o.fulfillmentState === "PENDING"),
    [orders]
  );

  const preparedOrders = useMemo(
    () => orders.filter((o) => o.fulfillmentState === "COMPLETED" && o.paymentState === "UNPAID"),
    [orders]
  );

  const completedOrders = useMemo(
    () => orders.filter((o) => o.fulfillmentState === "COMPLETED" && o.paymentState === "PAID_OFFLINE"),
    [orders]
  );

  const selectedOrder = useMemo(() => {
    if (selectedOrderId) {
      const found = orders.find((o) => o.id === selectedOrderId);
      if (found) return found;
    }
    return toPrepareOrders[0] ?? preparedOrders[0] ?? completedOrders[0] ?? null;
  }, [orders, selectedOrderId, toPrepareOrders, preparedOrders, completedOrders]);

  const selectedCategory =
    menu.find((category) => category.id === selectedCategoryId) ?? menu[0] ?? null;

  useEffect(() => {
    async function boot() {
      try {
        const response = await apiGet<StaffSession>("/api/admin/session");
        setStaff(response.staff);
        await loadAdminData();
      } catch {
        // unauthenticated staff stays on the login form
      }
    }

    void boot();
  }, []);

  // Auto-refresh orders every 30 seconds & on tab visibility change
  useEffect(() => {
    if (!staff) return;

    async function silentSyncOrders() {
      try {
        const response = await apiGet<{ orders: Order[] }>("/api/admin/orders");
        setOrders(response.orders);
      } catch {
        // Silent catch for background poll
      }
    }

    const interval = setInterval(silentSyncOrders, 30000);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void silentSyncOrders();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [staff]);

  useEffect(() => {
    if (!menu.length) return;
    setSelectedCategoryId((current) => current ?? menu[0]?.id ?? null);
  }, [menu]);

  async function loadAdminData() {
    const [ordersResponse, menuResponse] = await Promise.all([
      apiGet<{ orders: Order[] }>("/api/admin/orders"),
      apiGet<{ categories: MenuCategory[] }>("/api/admin/menu")
    ]);

    setOrders(ordersResponse.orders);
    setMenu(menuResponse.categories);
    setSelectedOrderId((current) => current ?? ordersResponse.orders[0]?.id ?? null);
  }

  async function handleManualRefresh() {
    setIsRefreshing(true);
    try {
      await loadAdminData();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);

    try {
      const response = await apiPost<StaffSession>("/api/admin/login", {
        username,
        password
      });
      setStaff(response.staff);
      await loadAdminData();
    } catch (error) {
      setNotice({
        variant: "error",
        title: "Login failed",
        subtitle: error instanceof Error ? error.message : "Please try again."
      });
    } finally {
      setBusy(false);
    }
  }

  async function markPaid(orderId: number) {
    setBusy(true);
    setNotice(null);

    try {
      const response = await apiPost<{ order: Order }>(`/api/admin/orders/${orderId}/mark-paid-offline`, {});
      setOrders((current) => current.map((order) => (order.id === response.order.id ? response.order : order)));
      setNotice({
        variant: "success",
        title: "Payment recorded",
        subtitle: `${response.order.publicOrderNumber} marked as Paid.`
      });
    } catch (error) {
      setNotice({
        variant: "error",
        title: "Payment update failed",
        subtitle: error instanceof Error ? error.message : "The payment state could not be updated."
      });
    } finally {
      setBusy(false);
    }
  }

  async function markPrepared(orderId: number) {
    setBusy(true);
    setNotice(null);

    try {
      const response = await apiPost<{ order: Order }>(`/api/admin/orders/${orderId}/mark-completed`, {});
      setOrders((current) => current.map((order) => (order.id === response.order.id ? response.order : order)));
      setNotice({
        variant: "success",
        title: "Order prepared",
        subtitle: `${response.order.publicOrderNumber} is ready to serve.`
      });
    } catch (error) {
      setNotice({
        variant: "error",
        title: "Status update failed",
        subtitle: error instanceof Error ? error.message : "The order could not be marked prepared."
      });
    } finally {
      setBusy(false);
    }
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);

    try {
      await apiPost("/api/admin/menu/categories", { name: newCategoryName });
      setNewCategoryName("");
      setShowAddCatForm(false);
      await loadAdminData();
    } catch (error) {
      setNotice({
        variant: "error",
        title: "Category add failed",
        subtitle: error instanceof Error ? error.message : "The category could not be created."
      });
    } finally {
      setBusy(false);
    }
  }

  async function saveRenameCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!renamingCategory) return;
    setBusy(true);
    setNotice(null);

    try {
      await apiPatch(`/api/admin/menu/categories/${renamingCategory.id}`, {
        name: renameCategoryValue
      });
      setRenamingCategory(null);
      await loadAdminData();
    } catch (error) {
      setNotice({
        variant: "error",
        title: "Rename failed",
        subtitle: error instanceof Error ? error.message : "The category could not be renamed."
      });
    } finally {
      setBusy(false);
    }
  }

  async function deleteCategory(categoryId: number, categoryName: string) {
    setBusy(true);
    setNotice(null);

    try {
      await apiDelete(`/api/admin/menu/categories/${categoryId}`);
      if (selectedCategoryId === categoryId) {
        setSelectedCategoryId(null);
      }
      await loadAdminData();
      setNotice({
        variant: "success",
        title: "Category deleted",
        subtitle: `"${categoryName}" has been deleted.`
      });
    } catch (error) {
      setNotice({
        variant: "error",
        title: "Delete failed",
        subtitle: error instanceof Error ? error.message : "The category could not be deleted."
      });
    } finally {
      setBusy(false);
    }
  }

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);

    try {
      await apiPost("/api/admin/menu/items", {
        categoryId: Number(newItem.categoryId) || selectedCategory?.id,
        name: newItem.name,
        pricePaise: Math.round(Number(newItem.price) * 100),
        isVeg: newItem.isVeg
      });
      setNewItem({ categoryId: "", name: "", price: "", isVeg: true });
      setShowAddItemForm(false);
      await loadAdminData();
    } catch (error) {
      setNotice({
        variant: "error",
        title: "Item add failed",
        subtitle: error instanceof Error ? error.message : "The item could not be created."
      });
    } finally {
      setBusy(false);
    }
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingItem) return;

    setBusy(true);
    setNotice(null);

    try {
      await apiPatch(`/api/admin/menu/items/${editingItem.id}`, {
        categoryId: editingItem.categoryId,
        name: editingItem.name,
        pricePaise: editingItem.pricePaise,
        isVeg: editingItem.isVeg,
        sortOrder: editingItem.sortOrder
      });
      setEditingItem(null);
      await loadAdminData();
    } catch (error) {
      setNotice({
        variant: "error",
        title: "Save failed",
        subtitle: error instanceof Error ? error.message : "The menu item could not be updated."
      });
    } finally {
      setBusy(false);
    }
  }

  async function deleteItem(itemId: number, itemName: string) {
    setBusy(true);
    setNotice(null);

    try {
      await apiDelete(`/api/admin/menu/items/${itemId}`);
      await loadAdminData();
      setNotice({
        variant: "success",
        title: "Item deleted",
        subtitle: `"${itemName}" has been deleted.`
      });
    } catch (error) {
      setNotice({
        variant: "error",
        title: "Delete failed",
        subtitle: error instanceof Error ? error.message : "The item could not be deleted."
      });
    } finally {
      setBusy(false);
    }
  }

  /* ---- Login ---- */
  if (!staff) {
    return (
      <div className="admin-login-shell">
        <div className="admin-login-card">
          <div className="brand-mark sm" style={{ margin: "0 auto 20px" }}>D3</div>
          <h1>D3 staff</h1>
          <p className="sub">Sign in to continue</p>
          <form className="admin-login-form" onSubmit={login}>
            <div className="field">
              <label className="field-label" htmlFor="admin-username">Username</label>
              <input
                id="admin-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Username"
                required
                autoComplete="username"
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="admin-password">Password</label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                required
                autoComplete="current-password"
              />
            </div>
            <button className="btn-primary" disabled={busy} type="submit">
              Log in
            </button>
          </form>
          {notice ? (
            <div className="admin-login-notice">
              <Notice variant={notice.variant} title={notice.title} subtitle={notice.subtitle} />
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  /* ---- Authenticated Admin ---- */
  return (
    <div className="admin-shell">
      {/* Topbar: Balanced Brand on Left, Centered Tabs */}
      <header className="admin-topbar">
        <div className="brand-row">
          <div className="brand-mark sm">D3</div>
          <div>
            <div className="admin-topbar__title">D3 staff</div>
            <div className="admin-topbar__sub">{staff.username}</div>
          </div>
        </div>

        <div className="admin-tabs" role="tablist" aria-label="Admin tabs">
          <button
            className={`admin-tab${activeTab === "orders" ? " active" : ""}`}
            onClick={() => setActiveTab("orders")}
            role="tab"
            aria-selected={activeTab === "orders"}
            type="button"
          >
            Orders
          </button>
          <button
            className={`admin-tab${activeTab === "menu" ? " active" : ""}`}
            onClick={() => setActiveTab("menu")}
            role="tab"
            aria-selected={activeTab === "menu"}
            type="button"
          >
            Menu
          </button>
        </div>

        <div className="admin-topbar__spacer" aria-hidden="true" />
      </header>

      {/* Orders Tab */}
      {activeTab === "orders" ? (
        <div className={`admin-orders-layout${showMobileDetail ? " show-detail" : ""}`}>
          {/* List pane */}
          <aside className="orders-list-pane">
            <div className="orders-list-pane__head">
              <h3>Orders ({orders.length})</h3>
              <button
                className="refresh-btn"
                disabled={isRefreshing}
                onClick={() => void handleManualRefresh()}
                title="Refresh orders list"
                type="button"
              >
                <RefreshCw aria-hidden="true" className={isRefreshing ? "spin" : ""} size={13} />
                Refresh
              </button>
            </div>

            <div className="order-list-scroll">
              {orders.length === 0 ? (
                <div style={{ padding: "20px 18px", color: "var(--clay)", fontSize: "13px" }}>
                  No orders yet.
                </div>
              ) : (
                <>
                  {/* 1. To Prepare / In Kitchen */}
                  <div className="order-section-header">
                    <span>To Prepare</span>
                    <span className="order-section-count order-section-count--ember">
                      {toPrepareOrders.length}
                    </span>
                  </div>
                  {toPrepareOrders.length > 0 ? (
                    toPrepareOrders.map((order) => (
                      <button
                        key={order.id}
                        className={`order-list-item${selectedOrder?.id === order.id ? " selected" : ""}`}
                        onClick={() => {
                          setSelectedOrderId(order.id);
                          setShowMobileDetail(true);
                        }}
                        type="button"
                      >
                        <div className="order-list-item__top">
                          <span className="order-list-item__id">{order.publicOrderNumber}</span>
                          <span className="order-list-item__total">{formatInrFromPaise(order.totalPaise)}</span>
                        </div>
                        <div className="order-list-item__bottom">
                          <span className="order-list-item__meta">
                            {order.tableLabel} · {order.customerName}
                          </span>
                          <div className="order-list-item__badges">
                            <span className={paymentBadgeClass(order.paymentState)}>
                              {formatPaymentState(order.paymentState)}
                            </span>
                            <span className={fulfillmentBadgeClass(order.fulfillmentState)}>
                              {formatFulfillmentState(order.fulfillmentState)}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="order-section-empty">All orders prepared</div>
                  )}

                  {/* 2. Prepared / Awaiting Payment */}
                  <div className="order-section-header">
                    <span>Prepared · Unpaid</span>
                    <span className="order-section-count order-section-count--sage">
                      {preparedOrders.length}
                    </span>
                  </div>
                  {preparedOrders.length > 0 ? (
                    preparedOrders.map((order) => (
                      <button
                        key={order.id}
                        className={`order-list-item${selectedOrder?.id === order.id ? " selected" : ""}`}
                        onClick={() => {
                          setSelectedOrderId(order.id);
                          setShowMobileDetail(true);
                        }}
                        type="button"
                      >
                        <div className="order-list-item__top">
                          <span className="order-list-item__id">{order.publicOrderNumber}</span>
                          <span className="order-list-item__total">{formatInrFromPaise(order.totalPaise)}</span>
                        </div>
                        <div className="order-list-item__bottom">
                          <span className="order-list-item__meta">
                            {order.tableLabel} · {order.customerName}
                          </span>
                          <div className="order-list-item__badges">
                            <span className={paymentBadgeClass(order.paymentState)}>
                              {formatPaymentState(order.paymentState)}
                            </span>
                            <span className={fulfillmentBadgeClass(order.fulfillmentState)}>
                              {formatFulfillmentState(order.fulfillmentState)}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="order-section-empty">No orders awaiting payment</div>
                  )}

                  {/* 3. Completed / Paid */}
                  <div className="order-section-header">
                    <span>Completed</span>
                    <span className="order-section-count order-section-count--clay">
                      {completedOrders.length}
                    </span>
                  </div>
                  {completedOrders.length > 0 ? (
                    completedOrders.map((order) => (
                      <button
                        key={order.id}
                        className={`order-list-item settled${selectedOrder?.id === order.id ? " selected" : ""}`}
                        onClick={() => {
                          setSelectedOrderId(order.id);
                          setShowMobileDetail(true);
                        }}
                        type="button"
                      >
                        <div className="order-list-item__top">
                          <span className="order-list-item__id">{order.publicOrderNumber}</span>
                          <span className="order-list-item__total">{formatInrFromPaise(order.totalPaise)}</span>
                        </div>
                        <div className="order-list-item__bottom">
                          <span className="order-list-item__meta">
                            {order.tableLabel} · {order.customerName}
                          </span>
                          <div className="order-list-item__badges">
                            <span className={paymentBadgeClass(order.paymentState)}>
                              {formatPaymentState(order.paymentState)}
                            </span>
                            <span className={fulfillmentBadgeClass(order.fulfillmentState)}>
                              {formatFulfillmentState(order.fulfillmentState)}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="order-section-empty">No completed orders yet</div>
                  )}
                </>
              )}
            </div>
          </aside>

          {/* Detail pane */}
          <section className="order-detail-pane">
            {selectedOrder ? (
              <>
                <button
                  className="detail-back"
                  onClick={() => setShowMobileDetail(false)}
                  type="button"
                >
                  <ChevronLeft aria-hidden="true" size={15} />
                  Back to orders
                </button>

                <div className="detail-head">
                  <div>
                    <h2>{selectedOrder.publicOrderNumber}</h2>
                    <div className="badge-row">
                      <span className={paymentBadgeClass(selectedOrder.paymentState)}>
                        {formatPaymentState(selectedOrder.paymentState)}
                      </span>
                      <span className={fulfillmentBadgeClass(selectedOrder.fulfillmentState)}>
                        {formatFulfillmentState(selectedOrder.fulfillmentState)}
                      </span>
                    </div>
                  </div>
                  <div className="detail-total">{formatInrFromPaise(selectedOrder.totalPaise)}</div>
                </div>

                <div className="detail-grid">
                  <div className="detail-box">
                    <div className="detail-box__label">Table</div>
                    <div className="detail-box__value">{selectedOrder.tableLabel}</div>
                  </div>
                  <div className="detail-box">
                    <div className="detail-box__label">Customer</div>
                    <div className="detail-box__value">
                      {selectedOrder.customerName} · {selectedOrder.mobileNumber}
                    </div>
                  </div>
                </div>

                <div className="detail-items-table">
                  {selectedOrder.items.map((item) => (
                    <div className="detail-item-row" key={item.id}>
                      <span className="detail-item-name">
                        {item.quantity} × {item.itemName}
                      </span>
                      <strong>{formatInrFromPaise(item.lineTotalPaise)}</strong>
                    </div>
                  ))}
                </div>

                <div className="detail-total-row">
                  <span>Total</span>
                  <span>{formatInrFromPaise(selectedOrder.totalPaise)}</span>
                </div>

                {/* Independent Workflow Actions: Mark Prepared & Mark Paid */}
                <div className="detail-actions">
                  {selectedOrder.fulfillmentState === "PENDING" ? (
                    <button
                      className="btn-outline"
                      disabled={busy}
                      onClick={() => void markPrepared(selectedOrder.id)}
                      type="button"
                    >
                      <Check aria-hidden="true" size={14} />
                      Mark prepared
                    </button>
                  ) : (
                    <button className="btn-outline btn-outline--done" disabled type="button">
                      <Check aria-hidden="true" size={14} />
                      Prepared ✓
                    </button>
                  )}

                  {selectedOrder.paymentState === "UNPAID" ? (
                    <button
                      className="btn-sage"
                      disabled={busy}
                      onClick={() => void markPaid(selectedOrder.id)}
                      type="button"
                    >
                      <Wallet aria-hidden="true" size={14} />
                      Mark paid
                    </button>
                  ) : (
                    <button className="btn-sage btn-sage--done" disabled type="button">
                      <Wallet aria-hidden="true" size={14} />
                      Paid ✓
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-state__icon">
                  <RefreshCw aria-hidden="true" size={20} />
                </div>
                <h3>Select an order</h3>
                <p>Choose from the list to inspect the order details.</p>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {/* Menu Tab */}
      {activeTab === "menu" ? (
        <div className="admin-menu-layout">
          {/* Sidebar */}
          <aside className="menu-sidebar">
            <div className="menu-sidebar__title">Categories</div>

            <div className="cat-list">
              {menu.map((category) => (
                <div
                  key={category.id}
                  className={`cat-list-wrapper${selectedCategory?.id === category.id ? " active" : ""}`}
                >
                  <button
                    className="cat-list-btn"
                    onClick={() => setSelectedCategoryId(category.id)}
                    type="button"
                  >
                    <span className="cat-list-name">{category.name}</span>
                    <span className="cat-list-item__count">{category.items.length}</span>
                  </button>
                  <div className="cat-list-actions">
                    <button
                      aria-label={`Rename ${category.name}`}
                      className="cat-action-btn"
                      onClick={() => {
                        setRenamingCategory(category);
                        setRenameCategoryValue(category.name);
                      }}
                      title="Rename category"
                      type="button"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      aria-label={`Delete ${category.name}`}
                      className="cat-action-btn cat-action-btn--delete"
                      onClick={() => setConfirmDelete({ type: "category", id: category.id, name: category.name })}
                      title="Delete category"
                      type="button"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="add-cat-area">
              {showAddCatForm ? (
                <form className="add-cat-form" onSubmit={createCategory}>
                  <input
                    value={newCategoryName}
                    onChange={(event) => setNewCategoryName(event.target.value)}
                    placeholder="Category name"
                    required
                    autoFocus
                  />
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      className="btn-primary"
                      disabled={busy}
                      type="submit"
                      style={{ padding: "8px 12px", fontSize: "12.5px", borderRadius: "var(--radius-sm)", flex: 1 }}
                    >
                      Add
                    </button>
                    <button
                      className="btn-outline-sm"
                      onClick={() => setShowAddCatForm(false)}
                      type="button"
                      style={{ padding: "8px 10px", fontSize: "12px" }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  className="add-cat-btn"
                  onClick={() => setShowAddCatForm(true)}
                  type="button"
                >
                  <Plus aria-hidden="true" size={13} />
                  Add category
                </button>
              )}
            </div>
          </aside>

          {/* Main Menu Management */}
          <section className="menu-main">
            <div className="menu-main__head">
              <h2>{selectedCategory?.name ?? "Menu"}</h2>
              <button
                className="btn-outline-sm"
                onClick={() => {
                  setShowAddItemForm((v) => !v);
                  setNewItem({ categoryId: String(selectedCategory?.id ?? ""), name: "", price: "", isVeg: true });
                }}
                type="button"
              >
                <Plus aria-hidden="true" size={14} />
                Add item
              </button>
            </div>

            {/* Add item form (toggleable) */}
            {showAddItemForm ? (
              <div className="add-item-panel">
                <h3>New item</h3>
                <form onSubmit={createItem} style={{ display: "grid", gap: "12px" }}>
                  <div className="field">
                    <label className="field-label" htmlFor="new-item-name">Item name</label>
                    <input
                      id="new-item-name"
                      value={newItem.name}
                      onChange={(event) => setNewItem((c) => ({ ...c, name: event.target.value }))}
                      placeholder="Item name"
                      required
                      autoFocus
                    />
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="new-item-price">Price (₹)</label>
                    <input
                      id="new-item-price"
                      inputMode="decimal"
                      min="0.01"
                      step="0.01"
                      type="number"
                      value={newItem.price}
                      onChange={(event) => setNewItem((c) => ({ ...c, price: event.target.value }))}
                      placeholder="e.g. 179"
                      required
                    />
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="new-item-type">Type</label>
                    <select
                      id="new-item-type"
                      value={newItem.isVeg ? "veg" : "non-veg"}
                      onChange={(event) => setNewItem((c) => ({ ...c, isVeg: event.target.value === "veg" }))}
                    >
                      <option value="veg">Veg</option>
                      <option value="non-veg">Non-veg</option>
                    </select>
                  </div>
                  <div className="add-item-panel-actions">
                    <button className="btn-primary" disabled={busy} type="submit" style={{ width: "auto", padding: "10px 20px", fontSize: "13.5px", borderRadius: "var(--radius-sm)" }}>
                      Add item
                    </button>
                    <button
                      className="btn-outline"
                      onClick={() => setShowAddItemForm(false)}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            ) : null}

            {/* Table */}
            {selectedCategory ? (
              <>
                <div className="menu-table-head">
                  <div>Item</div>
                  <div>Price</div>
                  <div>Available</div>
                  <div>Actions</div>
                </div>

                {selectedCategory.items.map((item) => (
                  <div className="menu-table-row" key={item.id}>
                    <div className="menu-item-cell-name">{item.name}</div>
                    <div className="menu-item-cell-price">{formatInrFromPaise(item.pricePaise)}</div>
                    <div>
                      <div
                        className="avail-toggle on"
                        role="switch"
                        aria-checked="true"
                        aria-disabled="true"
                        aria-label={`${item.name} availability`}
                        title="Availability toggle coming soon"
                      />
                    </div>
                    <div className="menu-item-cell-actions">
                      <button
                        aria-label={`Edit ${item.name}`}
                        className="row-edit-btn"
                        onClick={() => setEditingItem(item)}
                        title="Edit item"
                        type="button"
                      >
                        <Pencil aria-hidden="true" size={14} />
                      </button>
                      <button
                        aria-label={`Delete ${item.name}`}
                        className="row-edit-btn row-edit-btn--delete"
                        onClick={() => setConfirmDelete({ type: "item", id: item.id, name: item.name })}
                        title="Delete item"
                        type="button"
                      >
                        <Trash2 aria-hidden="true" size={14} />
                      </button>
                    </div>
                  </div>
                ))}

                {selectedCategory.items.length === 0 ? (
                  <div style={{ padding: "24px 14px", color: "var(--clay)", fontSize: "13px" }}>
                    No items in this category yet. Use "+ Add item" above to add one.
                  </div>
                ) : null}
              </>
            ) : null}
          </section>
        </div>
      ) : null}

      {/* Rename category modal */}
      {renamingCategory ? (
        <div className="modal-backdrop" role="presentation">
          <form className="modal" onSubmit={saveRenameCategory}>
            <h2>Rename category</h2>
            <div className="modal-field">
              <label htmlFor="rename-cat-name">Category name</label>
              <input
                id="rename-cat-name"
                value={renameCategoryValue}
                onChange={(event) => setRenameCategoryValue(event.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button
                className="btn-primary"
                disabled={busy}
                type="submit"
                style={{ width: "auto", padding: "10px 18px", fontSize: "13.5px", borderRadius: "var(--radius-sm)" }}
              >
                Save
              </button>
              <button
                className="btn-outline"
                onClick={() => setRenamingCategory(null)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Edit item modal */}
      {editingItem ? (
        <div className="modal-backdrop" role="presentation">
          <form className="modal" onSubmit={saveItem}>
            <h2>Edit item</h2>

            <div className="modal-field">
              <label htmlFor="edit-category">Category</label>
              <select
                id="edit-category"
                value={editingItem.categoryId}
                onChange={(event) =>
                  setEditingItem((current) =>
                    current ? { ...current, categoryId: Number(event.target.value) } : current
                  )
                }
              >
                {menu.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="modal-field">
              <label htmlFor="edit-name">Name</label>
              <input
                id="edit-name"
                value={editingItem.name}
                onChange={(event) =>
                  setEditingItem((current) =>
                    current ? { ...current, name: event.target.value } : current
                  )
                }
                required
              />
            </div>

            <div className="modal-field">
              <label htmlFor="edit-price">Price (₹)</label>
              <input
                id="edit-price"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                type="number"
                value={(editingItem.pricePaise / 100).toFixed(2)}
                onChange={(event) =>
                  setEditingItem((current) =>
                    current
                      ? { ...current, pricePaise: Math.round(Number(event.target.value) * 100) }
                      : current
                  )
                }
                required
              />
            </div>

            <div className="modal-field">
              <label htmlFor="edit-type">Type</label>
              <select
                id="edit-type"
                value={editingItem.isVeg ? "veg" : "non-veg"}
                onChange={(event) =>
                  setEditingItem((current) =>
                    current ? { ...current, isVeg: event.target.value === "veg" } : current
                  )
                }
              >
                <option value="veg">Veg</option>
                <option value="non-veg">Non-veg</option>
              </select>
            </div>

            <div className="modal-actions">
              <button className="btn-primary" disabled={busy} type="submit" style={{ width: "auto", padding: "11px 20px", fontSize: "13.5px", borderRadius: "var(--radius-sm)" }}>
                <Check aria-hidden="true" size={14} />
                Save changes
              </button>
              <button
                className="btn-outline"
                onClick={() => setEditingItem(null)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Themed Confirmation Modal for Deletion */}
      {confirmDelete ? (
        <div
          className="modal-backdrop"
          onClick={() => setConfirmDelete(null)}
          role="presentation"
        >
          <div className="modal" onClick={(event) => event.stopPropagation()} role="dialog">
            <h2>Delete {confirmDelete.type === "category" ? "category" : "menu item"}?</h2>
            <p
              style={{
                color: "var(--clay)",
                fontSize: "13.5px",
                lineHeight: "1.45",
                margin: "4px 0 16px"
              }}
            >
              Are you sure you want to delete{" "}
              <strong style={{ color: "var(--parchment)" }}>"{confirmDelete.name}"</strong>
              {confirmDelete.type === "category" ? " and all items inside it" : ""}? This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button
                className="btn-primary"
                disabled={busy}
                onClick={async () => {
                  const target = confirmDelete;
                  setConfirmDelete(null);
                  if (target.type === "category") {
                    await deleteCategory(target.id, target.name);
                  } else {
                    await deleteItem(target.id, target.name);
                  }
                }}
                style={{
                  background: "var(--rust)",
                  color: "#fff",
                  width: "auto",
                  padding: "11px 20px",
                  fontSize: "13.5px",
                  borderRadius: "var(--radius-sm)"
                }}
                type="button"
              >
                <Trash2 size={14} />
                Delete
              </button>
              <button
                className="btn-outline"
                onClick={() => setConfirmDelete(null)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Global admin notice */}
      {notice && !editingItem && !renamingCategory && !confirmDelete ? (
        <div className="admin-notice">
          <Notice variant={notice.variant} title={notice.title} subtitle={notice.subtitle} />
        </div>
      ) : null}
    </div>
  );
}
