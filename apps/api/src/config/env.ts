import { z } from "zod";

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url().default("postgres://postgres@localhost:5432/d3"),
  D3_CORS_ORIGIN: z.string().url().default("http://localhost:5173"),
  D3_REQUEST_BODY_LIMIT: z.string().min(1).default("32kb"),
  HMAC_SECRET: z.string().min(32),
  SESSION_SECRET: z.string().min(32),
  D3_SECURE_COOKIES: booleanFromEnv.default(false),
  D3_OTP_TTL_MS: z.coerce.number().int().positive().default(10 * 60 * 1000),
  D3_OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  D3_PRE_SESSION_TTL_MS: z.coerce.number().int().positive().default(30 * 60 * 1000),
  D3_CUSTOMER_SESSION_TTL_MS: z.coerce.number().int().positive().default(8 * 60 * 60 * 1000),
  D3_STAFF_SESSION_TTL_MS: z.coerce.number().int().positive().default(8 * 60 * 60 * 1000),
  D3_ENABLE_DEV_SEED: booleanFromEnv.default(false),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional()
});

export type AppConfig = {
  nodeEnv: "development" | "test" | "production";
  port: number;
  databaseUrl: string;
  corsOrigin: string;
  requestBodyLimit: string;
  qrSecret: string;
  sessionSecret: string;
  secureCookies: boolean;
  otpTtlMs: number;
  otpMaxAttempts: number;
  preSessionTtlMs: number;
  customerSessionTtlMs: number;
  staffSessionTtlMs: number;
  enableDevSeed: boolean;
  telegramBotToken?: string;
  telegramChatId?: string;
};

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(source);

  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    databaseUrl: parsed.DATABASE_URL,
    corsOrigin: parsed.D3_CORS_ORIGIN,
    requestBodyLimit: parsed.D3_REQUEST_BODY_LIMIT,
    qrSecret: parsed.HMAC_SECRET,
    sessionSecret: parsed.SESSION_SECRET,
    secureCookies: parsed.D3_SECURE_COOKIES,
    otpTtlMs: parsed.D3_OTP_TTL_MS,
    otpMaxAttempts: parsed.D3_OTP_MAX_ATTEMPTS,
    preSessionTtlMs: parsed.D3_PRE_SESSION_TTL_MS,
    customerSessionTtlMs: parsed.D3_CUSTOMER_SESSION_TTL_MS,
    staffSessionTtlMs: parsed.D3_STAFF_SESSION_TTL_MS,
    enableDevSeed: parsed.D3_ENABLE_DEV_SEED,
    telegramBotToken: parsed.TELEGRAM_BOT_TOKEN,
    telegramChatId: parsed.TELEGRAM_CHAT_ID
  };
}

export function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    nodeEnv: "test",
    port: 0,
    databaseUrl: "postgres://postgres@localhost:5432/d3_test",
    corsOrigin: "http://localhost:5173",
    requestBodyLimit: "32kb",
    // Test-only fake secrets — never use these values outside of automated tests.
    qrSecret: "test-qr-secret-do-not-use-in-production-000000000",
    sessionSecret: "test-session-secret-do-not-use-in-production-00",
    secureCookies: false,
    otpTtlMs: 10 * 60 * 1000,
    otpMaxAttempts: 5,
    preSessionTtlMs: 30 * 60 * 1000,
    customerSessionTtlMs: 8 * 60 * 60 * 1000,
    staffSessionTtlMs: 8 * 60 * 60 * 1000,
    enableDevSeed: false,
    ...overrides
  };
}
