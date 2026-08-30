import { healthResponseSchema, type HealthResponse } from "@d3/shared";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export async function getApiHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(`${apiBaseUrl}/health`, {
    signal
  });

  if (!response.ok) {
    throw new Error("API health check failed");
  }

  return healthResponseSchema.parse(await response.json());
}
