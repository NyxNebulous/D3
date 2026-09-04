import "@testing-library/jest-dom/vitest";

class LocalStorageMock implements Storage {
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
  const mock = new LocalStorageMock();
  Object.defineProperty(window, "localStorage", {
    value: mock,
    writable: true
  });
  Object.defineProperty(globalThis, "localStorage", {
    value: mock,
    writable: true
  });
}


