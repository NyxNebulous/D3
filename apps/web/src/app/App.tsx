import { ThemeProvider } from "../context/ThemeContext.js";
import { AdminPage } from "../features/admin/AdminPage.js";
import { CustomerOrderPage } from "../features/customer/CustomerOrderPage.js";

export function App() {
  const url = new URL(window.location.href);

  return (
    <ThemeProvider>
      {url.pathname.startsWith("/admin") ? (
        <AdminPage />
      ) : (
        <CustomerOrderPage
          qrId={
            url.pathname.startsWith("/t/")
              ? decodeURIComponent(url.pathname.replace("/t/", "").split("/")[0] ?? "")
              : (url.searchParams.get("qrId") ?? "")
          }
          signature={url.searchParams.get("sig") ?? ""}
        />
      )}
    </ThemeProvider>
  );
}

