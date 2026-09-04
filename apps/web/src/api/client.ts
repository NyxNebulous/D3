const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== "undefined" && window.location.hostname.includes("pages.dev")
    ? "https://d3-api.nyxnebulous7.workers.dev"
    : "");

export type MenuItem = {
  id: number;
  categoryId: number;
  name: string;
  pricePaise: number;
  isVeg: boolean;
  sortOrder: number;
};

export type MenuCategory = {
  id: number;
  name: string;
  sortOrder: number;
  items: MenuItem[];
};

export type CartItem = {
  menuItemId: number;
  name: string;
  categoryName: string;
  isVeg: boolean;
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
};

export type Cart = {
  id: number;
  items: CartItem[];
  totalPaise: number;
  currency: "INR";
};

export type OrderItem = {
  id: number;
  menuItemId: number | null;
  itemName: string;
  isVeg: boolean;
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
};

export type Order = {
  id: number;
  publicOrderNumber: string;
  customerName: string;
  mobileNumber: string;
  tableLabel: string;
  totalPaise: number;
  currency: "INR";
  paymentState: "UNPAID" | "PAID_OFFLINE";
  fulfillmentState: "PENDING" | "COMPLETED";
  paidAt: string | null;
  completedAt: string | null;
  createdAt: string;
  items: OrderItem[];
};

export type SessionContext = {
  customer: {
    name: string;
    mobileNumber: string;
  };
  table: {
    label: string;
  };
};

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

export async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

export async function apiPost<T>(path: string, body?: unknown, headers?: HeadersInit): Promise<T> {
  return apiRequest<T>(path, {
    method: "POST",
    body,
    headers
  });
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: "PATCH",
    body
  });
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: "PUT",
    body
  });
}

export async function apiDelete<T>(path: string): Promise<T> {
  return apiRequest<T>(path, {
    method: "DELETE"
  });
}

let activeAuthToken: string | null = null;

export function setAuthToken(token: string | null | undefined) {
  activeAuthToken = token ?? null;
  if (token) {
    try {
      sessionStorage.setItem("d3_auth_token", token);
    } catch {}
  } else {
    try {
      sessionStorage.removeItem("d3_auth_token");
    } catch {}
  }
}

export function getAuthToken(): string | null {
  if (activeAuthToken) return activeAuthToken;
  try {
    activeAuthToken = sessionStorage.getItem("d3_auth_token");
  } catch {}
  return activeAuthToken;
}

export function clearAuthToken() {
  setAuthToken(null);
}

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {})
  };

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    credentials: "include",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as any;
    const errorMessage =
      typeof payload?.error === "string"
        ? payload.error
        : (payload?.error?.message ?? "Request failed");
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

