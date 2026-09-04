import { useEffect, useState } from "react";
import { ThemeProvider } from "../context/ThemeContext.js";
import { AdminPage } from "../features/admin/AdminPage.js";
import { CustomerOrderPage } from "../features/customer/CustomerOrderPage.js";

export function App() {
  const [currentUrl, setCurrentUrl] = useState(() => new URL(window.location.href));

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentUrl(new URL(window.location.href));
    };

    window.addEventListener("popstate", handleLocationChange);
    return () => {
      window.removeEventListener("popstate", handleLocationChange);
    };
  }, []);

  const tableParam = currentUrl.searchParams.get("table");
  const qrId =
    (currentUrl.pathname.startsWith("/t/")
      ? decodeURIComponent(currentUrl.pathname.replace("/t/", "").split("/")[0] ?? "")
      : (currentUrl.searchParams.get("qr") ??
         currentUrl.searchParams.get("qrId") ??
         (tableParam ? (tableParam.startsWith("qr-") ? tableParam : `qr-table-${tableParam}`) : ""))) || "";

  const signature =
    currentUrl.searchParams.get("sig") ?? currentUrl.searchParams.get("signature") ?? "";

  return (
    <ThemeProvider>
      {currentUrl.pathname.startsWith("/admin") ? (
        <AdminPage />
      ) : (
        <CustomerOrderPage key={qrId || "no-qr"} qrId={qrId} signature={signature} />
      )}
    </ThemeProvider>
  );
}

