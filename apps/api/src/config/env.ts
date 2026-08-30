import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  D3_DATABASE_PATH: z.string().min(1).default("data/d3.sqlite"),
  D3_CORS_ORIGIN: z.string().url().default("http://localhost:5173"),
  D3_REQUEST_BODY_LIMIT: z.string().min(1).default("32kb")
});

export type AppConfig = {
  nodeEnv: "development" | "test" | "production";
  port: number;
  databasePath: string;
  corsOrigin: string;
  requestBodyLimit: string;
};

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(source);

  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    databasePath: parsed.D3_DATABASE_PATH,
    corsOrigin: parsed.D3_CORS_ORIGIN,
    requestBodyLimit: parsed.D3_REQUEST_BODY_LIMIT
  };
}

export function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    nodeEnv: "test",
    port: 0,
    databasePath: ":memory:",
    corsOrigin: "http://localhost:5173",
    requestBodyLimit: "32kb",
    ...overrides
  };
}
