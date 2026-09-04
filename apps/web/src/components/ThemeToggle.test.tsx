import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeProvider } from "../context/ThemeContext.js";
import { ThemeToggle } from "./ThemeToggle.js";

describe("ThemeToggle and ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-theme");
  });

  it("defaults to light theme and toggles to dark theme on click", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const toggleBtn = screen.getByRole("button", { name: /switch to dark theme/i });
    expect(toggleBtn).toBeInTheDocument();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);

    fireEvent.click(toggleBtn);

    expect(screen.getByRole("button", { name: /switch to light theme/i })).toBeInTheDocument();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("d3-theme")).toBe("dark");

    // Click again to switch back to light
    fireEvent.click(screen.getByRole("button", { name: /switch to light theme/i }));
    expect(screen.getByRole("button", { name: /switch to dark theme/i })).toBeInTheDocument();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(localStorage.getItem("d3-theme")).toBe("light");
  });

  it("restores dark theme from localStorage if previously stored", () => {
    localStorage.setItem("d3-theme", "dark");

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    expect(screen.getByRole("button", { name: /switch to light theme/i })).toBeInTheDocument();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
