import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

class StorageMock implements Storage {
  private store: Record<string, string> = {};

  get length(): number {
    return Object.keys(this.store).length;
  }

  clear(): void {
    this.store = {};
  }

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  key(index: number): string | null {
    return Object.keys(this.store)[index] ?? null;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
}

if (typeof window !== "undefined") {
  const localMock = new StorageMock();
  const sessionMock = new StorageMock();

  Object.defineProperty(window, "localStorage", {
    value: localMock,
    writable: true
  });
  Object.defineProperty(globalThis, "localStorage", {
    value: localMock,
    writable: true
  });

  Object.defineProperty(window, "sessionStorage", {
    value: sessionMock,
    writable: true
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    value: sessionMock,
    writable: true
  });
}


