const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

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

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(payload?.error?.message ?? "Request failed");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

