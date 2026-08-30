import { useEffect, useState } from "react";
import { getApiHealth } from "../api/client.js";

type ApiStatus = "checking" | "ready" | "unavailable";

export function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");

  useEffect(() => {
    const controller = new AbortController();

    getApiHealth(controller.signal)
      .then(() => setApiStatus("ready"))
      .catch(() => {
        if (!controller.signal.aborted) {
          setApiStatus("unavailable");
        }
      });

    return () => controller.abort();
  }, []);

  return (
    <main className="app-shell">
      <section className="status-panel" aria-labelledby="app-title">
        <p className="eyebrow">Phase 1 foundation</p>
        <h1 id="app-title">D3</h1>
        <p className="lede">React, TypeScript, and Vite are running.</p>
        <dl className="status-grid">
          <div>
            <dt>Frontend</dt>
            <dd>Ready</dd>
          </div>
          <div>
            <dt>API</dt>
            <dd>{formatApiStatus(apiStatus)}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}

function formatApiStatus(status: ApiStatus): string {
  if (status === "ready") {
    return "API ready";
  }

  if (status === "unavailable") {
    return "API unavailable";
  }

  return "Checking API";
}
