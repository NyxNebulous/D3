import { z } from "zod";

export const healthResponseSchema = z
  .object({
    ok: z.literal(true),
    service: z.literal("D3 API")
  })
  .strict();

export type HealthResponse = z.infer<typeof healthResponseSchema>;
