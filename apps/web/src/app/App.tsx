import { AdminPage } from "../features/admin/AdminPage.js";
import { CustomerOrderPage } from "../features/customer/CustomerOrderPage.js";

export function App() {
  const url = new URL(window.location.href);

  if (url.pathname.startsWith("/admin")) {
    return <AdminPage />;
  }

  const pathQrId = url.pathname.startsWith("/t/")
    ? decodeURIComponent(url.pathname.replace("/t/", "").split("/")[0] ?? "")
    : "";
  const queryQrId = url.searchParams.get("qrId") ?? "";
  const signature = url.searchParams.get("sig") ?? "";

  return <CustomerOrderPage qrId={pathQrId || queryQrId} signature={signature} />;
}

