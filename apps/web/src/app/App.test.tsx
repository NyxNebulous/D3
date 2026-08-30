import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";

describe("App", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the Phase 1 startup shell", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true, service: "D3 API" })))
    );

    render(<App />);

    expect(screen.getByRole("heading", { name: "D3" })).toBeInTheDocument();
    expect(screen.getByText("Frontend")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("API ready")).toBeInTheDocument());
  });
});
