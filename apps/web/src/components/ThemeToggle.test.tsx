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

  it("defaults to dark theme and toggles to light theme on click", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const toggleBtn = screen.getByRole("button", { name: /switch to light theme/i });
    expect(toggleBtn).toBeInTheDocument();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("light")).toBe(false);

    fireEvent.click(toggleBtn);

    expect(screen.getByRole("button", { name: /switch to dark theme/i })).toBeInTheDocument();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(localStorage.getItem("d3-theme")).toBe("light");

    // Click again to switch back to dark
    fireEvent.click(screen.getByRole("button", { name: /switch to dark theme/i }));
    expect(screen.getByRole("button", { name: /switch to light theme/i })).toBeInTheDocument();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("light")).toBe(false);
    expect(localStorage.getItem("d3-theme")).toBe("dark");
  });

  it("restores light theme from localStorage if previously stored", () => {
    localStorage.setItem("d3-theme", "light");

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    expect(screen.getByRole("button", { name: /switch to dark theme/i })).toBeInTheDocument();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
  });
});
