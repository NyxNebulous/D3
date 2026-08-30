import { useEffect, useMemo, useState } from "react";
import { Check, LogIn, Plus, RefreshCw, Save, Wallet } from "lucide-react";
import { formatInrFromPaise } from "@d3/shared";
import {
  apiGet,
  apiPatch,
  apiPost,
  type MenuCategory,
  type MenuItem,
  type Order
} from "../../api/client.js";
import { StatusPill } from "../../components/StatusPill.js";
import { ToolbarButton } from "../../components/ToolbarButton.js";

type StaffSession = {
  staff: {
    id: number;
    username: string;
  };
};

export function AdminPage() {
  const [staff, setStaff] = useState<StaffSession["staff"] | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [menu, setMenu] = useState<MenuCategory[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newItem, setNewItem] = useState({ categoryId: "", name: "", price: "" });
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) ?? orders[0] ?? null,
    [orders, selectedOrderId]
  );

  useEffect(() => {
    async function boot() {
      try {
        const response = await apiGet<StaffSession>("/api/admin/session");
        setStaff(response.staff);
        await loadAdminData();
      } catch {
        // Unauthenticated staff lands on the login form.
      }
    }

    void boot();
  }, []);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const response = await apiPost<StaffSession>("/api/admin/login", {
        username,
        password
      });
      setStaff(response.staff);
      await loadAdminData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not log in");
    } finally {
      setBusy(false);
    }
  }

  async function loadAdminData() {
    const [ordersResponse, menuResponse] = await Promise.all([
      apiGet<{ orders: Order[] }>("/api/admin/orders"),
      apiGet<{ categories: MenuCategory[] }>("/api/admin/menu")
    ]);

    setOrders(ordersResponse.orders);
    setMenu(menuResponse.categories);
    setSelectedOrderId((current) => current ?? ordersResponse.orders[0]?.id ?? null);
  }

  async function markPaid(orderId: number) {
    setBusy(true);
    setMessage("");

    try {
      const response = await apiPost<{ order: Order }>(
        `/api/admin/orders/${orderId}/mark-paid-offline`,
        {}
      );
      replaceOrder(response.order);
      setMessage("Offline payment recorded");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not record payment");
    } finally {
      setBusy(false);
    }
  }

  async function markCompleted(orderId: number) {
    setBusy(true);
    setMessage("");

    try {
      const response = await apiPost<{ order: Order }>(
        `/api/admin/orders/${orderId}/mark-completed`,
        {}
      );
      replaceOrder(response.order);
      setMessage("Order completed");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not complete order");
    } finally {
      setBusy(false);
    }
  }

  async function createCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      await apiPost("/api/admin/menu/categories", { name: newCategoryName });
      setNewCategoryName("");
      await loadAdminData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add category");
    } finally {
      setBusy(false);
    }
  }

  async function createItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      await apiPost("/api/admin/menu/items", {
        categoryId: Number(newItem.categoryId),
        name: newItem.name,
        pricePaise: Math.round(Number(newItem.price) * 100)
      });
      setNewItem({ categoryId: "", name: "", price: "" });
      await loadAdminData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add item");
    } finally {
      setBusy(false);
    }
  }

  async function saveItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingItem) {
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      await apiPatch(`/api/admin/menu/items/${editingItem.id}`, {
        categoryId: editingItem.categoryId,
        name: editingItem.name,
        pricePaise: editingItem.pricePaise,
        sortOrder: editingItem.sortOrder
      });
      setEditingItem(null);
      await loadAdminData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save item");
    } finally {
      setBusy(false);
    }
  }

  function replaceOrder(order: Order) {
    setOrders((current) => current.map((candidate) => (candidate.id === order.id ? order : candidate)));
  }

  if (!staff) {
    return (
      <main className="app-shell admin-shell">
        <header className="topbar">
          <div>
            <h1>D3</h1>
            <p>Staff</p>
          </div>
        </header>
        {message ? <div className="notice">{message}</div> : null}
        <section className="panel auth-panel">
          <h2>Staff login</h2>
          <form className="form-grid" onSubmit={login}>
            <label>
              Username
              <input value={username} onChange={(event) => setUsername(event.target.value)} required />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <ToolbarButton disabled={busy} icon={LogIn} label="Log In" type="submit" variant="primary" />
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell admin-shell">
      <header className="topbar">
        <div>
          <h1>D3</h1>
          <p>{staff.username}</p>
        </div>
        <ToolbarButton
          disabled={busy}
          icon={RefreshCw}
          label="Refresh"
          onClick={() => void loadAdminData()}
          variant="quiet"
        />
      </header>

      {message ? <div className="notice">{message}</div> : null}

      <section className="admin-grid">
        <div className="panel orders-panel">
          <div className="section-heading">
            <h2>Orders</h2>
            <span className="counter">{orders.length}</span>
          </div>

          {orders.length ? (
            <ul className="admin-order-list">
              {orders.map((order) => (
                <li key={order.id}>
                  <button
                    className={order.id === selectedOrder?.id ? "selected-row" : ""}
                    onClick={() => setSelectedOrderId(order.id)}
                    type="button"
                  >
                    <span>
                      <strong>{order.publicOrderNumber}</strong>
                      <small>{order.tableLabel}</small>
                    </span>
                    <span>{formatInrFromPaise(order.totalPaise)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No orders yet.</p>
          )}
        </div>

        <div className="panel detail-panel">
          {selectedOrder ? (
            <>
              <div className="section-heading">
                <h2>{selectedOrder.publicOrderNumber}</h2>
                <div className="pill-row">
                  <StatusPill tone={selectedOrder.paymentState === "PAID" ? "success" : "warning"}>
                    {selectedOrder.paymentState}
                  </StatusPill>
                  <StatusPill tone={selectedOrder.fulfillmentState === "COMPLETED" ? "success" : "neutral"}>
                    {selectedOrder.fulfillmentState}
                  </StatusPill>
                </div>
              </div>
              <dl className="detail-list">
                <div>
                  <dt>Table</dt>
                  <dd>{selectedOrder.tableLabel}</dd>
                </div>
                <div>
                  <dt>Customer</dt>
                  <dd>{selectedOrder.customerName}</dd>
                </div>
                <div>
                  <dt>Mobile</dt>
                  <dd>{selectedOrder.mobileNumber}</dd>
                </div>
              </dl>
              <ul className="line-list">
                {selectedOrder.items.map((item) => (
                  <li key={item.id}>
                    <span>
                      {item.quantity} x {item.itemName}
                    </span>
                    <strong>{formatInrFromPaise(item.lineTotalPaise)}</strong>
                  </li>
                ))}
              </ul>
              <div className="total-row">
                <span>Total</span>
                <strong>{formatInrFromPaise(selectedOrder.totalPaise)}</strong>
              </div>
              <div className="button-row">
                <ToolbarButton
                  disabled={busy || selectedOrder.paymentState === "PAID_OFFLINE"}
                  icon={Wallet}
                  label="Mark Paid"
                  onClick={() => void markPaid(selectedOrder.id)}
                  variant="primary"
                />
                <ToolbarButton
                  disabled={busy || selectedOrder.fulfillmentState === "COMPLETED"}
                  icon={Check}
                  label="Complete"
                  onClick={() => void markCompleted(selectedOrder.id)}
                />
              </div>
            </>
          ) : (
            <p className="muted">Select an order.</p>
          )}
        </div>

        <div className="panel menu-manager">
          <h2>Menu</h2>
          <form className="inline-form" onSubmit={createCategory}>
            <label>
              Category
              <input
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                required
              />
            </label>
            <ToolbarButton disabled={busy} icon={Plus} label="Add" type="submit" />
          </form>
          <form className="inline-form" onSubmit={createItem}>
            <label>
              Category
              <select
                value={newItem.categoryId}
                onChange={(event) => setNewItem((current) => ({ ...current, categoryId: event.target.value }))}
                required
              >
                <option value="" disabled>
                  Select
                </option>
                {menu.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Item
              <input
                value={newItem.name}
                onChange={(event) => setNewItem((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </label>
            <label>
              Price
              <input
                inputMode="decimal"
                min="0.01"
                step="0.01"
                type="number"
                value={newItem.price}
                onChange={(event) => setNewItem((current) => ({ ...current, price: event.target.value }))}
                required
              />
            </label>
            <ToolbarButton disabled={busy || menu.length === 0} icon={Plus} label="Add Item" type="submit" />
          </form>

          <div className="menu-edit-list">
            {menu.map((category) => (
              <section className="menu-section" key={category.id}>
                <h3>{category.name}</h3>
                {category.items.map((item) => (
                  <button
                    className="menu-edit-row"
                    key={item.id}
                    onClick={() => setEditingItem(item)}
                    type="button"
                  >
                    <span>{item.name}</span>
                    <strong>{formatInrFromPaise(item.pricePaise)}</strong>
                  </button>
                ))}
              </section>
            ))}
          </div>
        </div>
      </section>

      {editingItem ? (
        <div className="modal-backdrop" role="presentation">
          <form className="modal panel" onSubmit={saveItem}>
            <h2>Edit item</h2>
            <label>
              Category
              <select
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
            </label>
            <label>
              Name
              <input
                value={editingItem.name}
                onChange={(event) =>
                  setEditingItem((current) => (current ? { ...current, name: event.target.value } : current))
                }
                required
              />
            </label>
            <label>
              Price
              <input
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
            </label>
            <div className="button-row">
              <ToolbarButton disabled={busy} icon={Save} label="Save" type="submit" variant="primary" />
              <button className="text-button" onClick={() => setEditingItem(null)} type="button">
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}

