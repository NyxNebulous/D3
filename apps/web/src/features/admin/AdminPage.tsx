import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  clearStaffToken,
  setStaffToken,
  type MenuCategory,
  type MenuItem,
  type Order
} from "../../api/client.js";
import { Notice, type NoticeVariant } from "../../components/Notice.js";
import { AdminLogin } from "./components/AdminLogin.js";
import { AdminTopbar } from "./components/AdminTopbar.js";
import { ConfirmDeleteModal } from "./components/ConfirmDeleteModal.js";
import { MenuItemFormModal } from "./components/MenuItemFormModal.js";
import { MenuItemsTable } from "./components/MenuItemsTable.js";
import { MenuSidebar } from "./components/MenuSidebar.js";
import { OrderDetailPane } from "./components/OrderDetailPane.js";
import { OrdersMasterPane } from "./components/OrdersMasterPane.js";

type StaffSession = {
  staff: {
    id: number;
    username: string;
  };
  token?: string;
};

type NoticeState = {
  variant: NoticeVariant;
  title: string;
  subtitle: string;
};

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

  // Modals state
  const [itemModalItem, setItemModalItem] = useState<MenuItem | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    type: "category" | "item";
    id: number;
    name: string;
  } | null>(null);

  const [busy, setBusy] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const selectedOrder = useMemo(() => {
    if (selectedOrderId) {
      const found = orders.find((o) => o.id === selectedOrderId);
      if (found) return found;
    }
    const toPrepare = orders.find((o) => o.fulfillmentState === "PENDING");
    if (toPrepare) return toPrepare;
    const prepared = orders.find(
      (o) => o.fulfillmentState === "COMPLETED" && o.paymentState === "UNPAID"
    );
    if (prepared) return prepared;
    return orders[0] ?? null;
  }, [orders, selectedOrderId]);

  const selectedCategory =
    menu.find((category) => category.id === selectedCategoryId) ?? menu[0] ?? null;

  async function loadAdminData() {
    const [ordersResponse, menuResponse] = await Promise.all([
      apiGet<{ orders: Order[] }>("/api/admin/orders"),
      apiGet<{ categories: MenuCategory[] }>("/api/admin/menu")
    ]);

    setOrders(ordersResponse.orders);
    setMenu(menuResponse.categories);
    setSelectedOrderId((current) => current ?? ordersResponse.orders[0]?.id ?? null);
  }

  useEffect(() => {
    async function boot() {
      try {
        const response = await apiGet<StaffSession>("/api/admin/session");
        setStaff(response.staff);
        await loadAdminData();
      } catch {
        // unauthenticated staff stays on login
        clearStaffToken();
        setStaff(null);
      }
    }

    void boot();
  }, []);

  // Auto-dismiss notice toast after 3.5 seconds
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => {
      setNotice(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  // Auto-refresh orders every 30 seconds & on tab visibility change
  useEffect(() => {
    if (!staff) return;

    async function silentSyncOrders() {
      try {
        const response = await apiGet<{ orders: Order[] }>("/api/admin/orders");
        setOrders(response.orders);
      } catch (err) {
        if (err instanceof Error && err.message.toLowerCase().includes("unauthenticated")) {
          clearStaffToken();
          setStaff(null);
        }
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
      if (response.token) {
        setStaffToken(response.token);
      }
      setStaff(response.staff);
      await loadAdminData();
    } catch (error) {
      clearStaffToken();
      setStaff(null);
      setNotice({
        variant: "error",
        title: "Login failed",
        subtitle: error instanceof Error ? error.message : "Please try again."
      });
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      await apiPost("/api/admin/logout", {});
    } catch {
      // ignore
    }
    clearStaffToken();
    setStaff(null);
  }

  async function markPaid(orderId: number) {
    setBusy(true);
    setNotice(null);

    try {
      const response = await apiPost<{ order: Order }>(
        `/api/admin/orders/${orderId}/mark-paid-offline`,
        {}
      );
      setOrders((current) =>
        current.map((order) => (order.id === response.order.id ? response.order : order))
      );
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
      const response = await apiPost<{ order: Order }>(
        `/api/admin/orders/${orderId}/mark-completed`,
        {}
      );
      setOrders((current) =>
        current.map((order) => (order.id === response.order.id ? response.order : order))
      );
      setNotice({
        variant: "success",
        title: "Order prepared",
        subtitle: `${response.order.publicOrderNumber} is ready.`
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

  async function handleCreateCategory(name: string) {
    setBusy(true);
    setNotice(null);

    try {
      await apiPost("/api/admin/menu/categories", { name });
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

  async function handleRenameCategory(categoryId: number, name: string) {
    setBusy(true);
    setNotice(null);

    try {
      await apiPatch(`/api/admin/menu/categories/${categoryId}`, { name });
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

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    setBusy(true);
    setNotice(null);

    try {
      if (confirmDelete.type === "category") {
        await apiDelete(`/api/admin/menu/categories/${confirmDelete.id}`);
        if (selectedCategoryId === confirmDelete.id) {
          setSelectedCategoryId(null);
        }
        await loadAdminData();
        setNotice({
          variant: "success",
          title: "Category deleted",
          subtitle: `"${confirmDelete.name}" has been deleted.`
        });
      } else {
        await apiDelete(`/api/admin/menu/items/${confirmDelete.id}`);
        await loadAdminData();
        setNotice({
          variant: "success",
          title: "Item deleted",
          subtitle: `"${confirmDelete.name}" has been deleted.`
        });
      }
    } catch (error) {
      setNotice({
        variant: "error",
        title: "Delete failed",
        subtitle: error instanceof Error ? error.message : "The item could not be deleted."
      });
    } finally {
      setBusy(false);
      setConfirmDelete(null);
    }
  }

  async function handleSaveMenuItem(data: {
    id?: number;
    categoryId: number;
    name: string;
    pricePaise: number;
    isVeg: boolean;
  }) {
    setBusy(true);
    setNotice(null);

    try {
      if (data.id) {
        await apiPatch(`/api/admin/menu/items/${data.id}`, {
          categoryId: data.categoryId,
          name: data.name,
          pricePaise: data.pricePaise,
          isVeg: data.isVeg
        });
        setNotice({
          variant: "success",
          title: "Item updated",
          subtitle: `"${data.name}" has been saved.`
        });
      } else {
        await apiPost("/api/admin/menu/items", {
          categoryId: data.categoryId,
          name: data.name,
          pricePaise: data.pricePaise,
          isVeg: data.isVeg
        });
        setNotice({
          variant: "success",
          title: "Item added",
          subtitle: `"${data.name}" has been added.`
        });
      }
      await loadAdminData();
    } catch (error) {
      setNotice({
        variant: "error",
        title: data.id ? "Save failed" : "Add failed",
        subtitle: error instanceof Error ? error.message : "Failed to save menu item."
      });
      throw error;
    } finally {
      setBusy(false);
    }
  }

  if (!staff) {
    return (
      <AdminLogin
        username={username}
        onUsernameChange={setUsername}
        password={password}
        onPasswordChange={setPassword}
        onSubmit={login}
        busy={busy}
        notice={notice}
      />
    );
  }

  return (
    <div className="min-h-dvh h-dvh bg-canvas flex flex-col overflow-hidden">
      <AdminTopbar
        staff={staff}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setShowMobileDetail(false);
        }}
        onLogout={() => void logout()}
      />

      {activeTab === "orders" ? (
        <div className="flex flex-1 min-h-0 bg-ink overflow-hidden max-md:flex-col">
          <div className={showMobileDetail ? "max-md:hidden" : "contents"}>
            <OrdersMasterPane
              orders={orders}
              selectedOrderId={selectedOrder?.id ?? null}
              onSelectOrder={(id) => {
                setSelectedOrderId(id);
                setShowMobileDetail(true);
              }}
              isRefreshing={isRefreshing}
              onRefresh={() => void handleManualRefresh()}
            />
          </div>

          <div
            className={`flex-1 flex flex-col min-h-0 ${
              !showMobileDetail ? "max-md:hidden" : ""
            }`}
          >
            <OrderDetailPane
              order={selectedOrder}
              onBack={() => setShowMobileDetail(false)}
              onMarkPrepared={(id) => void markPrepared(id)}
              onMarkPaid={(id) => void markPaid(id)}
              busy={busy}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 bg-ink overflow-hidden max-md:flex-col max-md:overflow-y-auto">
          <MenuSidebar
            categories={menu}
            selectedCategoryId={selectedCategory?.id ?? null}
            onSelectCategory={(id) => setSelectedCategoryId(id)}
            onCreateCategory={handleCreateCategory}
            onRenameCategory={handleRenameCategory}
            onDeleteCategory={(id, name) =>
              setConfirmDelete({ type: "category", id, name })
            }
            busy={busy}
          />
          <MenuItemsTable
            selectedCategory={selectedCategory}
            onAddItem={() => setItemModalItem("new")}
            onEditItem={(item) => setItemModalItem(item)}
            onDeleteItem={(id, name) =>
              setConfirmDelete({ type: "item", id, name })
            }
          />
        </div>
      )}

      {itemModalItem ? (
        <MenuItemFormModal
          item={itemModalItem === "new" ? null : itemModalItem}
          categories={menu}
          defaultCategoryId={selectedCategory?.id ?? null}
          onSave={handleSaveMenuItem}
          onClose={() => setItemModalItem(null)}
          busy={busy}
        />
      ) : null}

      {confirmDelete ? (
        <ConfirmDeleteModal
          type={confirmDelete.type}
          name={confirmDelete.name}
          onConfirm={() => void handleConfirmDelete()}
          onCancel={() => setConfirmDelete(null)}
          busy={busy}
        />
      ) : null}

      {notice ? (
        <div className="fixed top-4 right-4 z-50 w-[min(380px,calc(100%-32px))] shadow-2xl">
          <Notice
            variant={notice.variant}
            title={notice.title}
            subtitle={notice.subtitle}
            onDismiss={() => setNotice(null)}
          />
        </div>
      ) : null}
    </div>
  );
}
