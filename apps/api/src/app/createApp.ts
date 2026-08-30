import cors from "cors";
import express from "express";
import helmet from "helmet";
import { healthResponseSchema } from "@d3/shared";
import type { AppConfig } from "../config/env.js";
import type { Database } from "../db/database.js";
import { createOriginGuard } from "../middleware/originGuard.js";
import { asyncHandler, createErrorHandler, notFoundHandler } from "../middleware/errors.js";

export function createApp(database: Database, config: AppConfig) {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true
    })
  );
  app.use(express.json({ limit: config.requestBodyLimit }));
  app.use(createOriginGuard(config));

  app.get(
    "/health",
    asyncHandler((_request, response) => {
      database.prepare("SELECT 1 AS ok").get();
      response.json(healthResponseSchema.parse({ ok: true, service: "D3 API" }));
    })
  );

  app.use(notFoundHandler);
  app.use(createErrorHandler(config));

  return app;
}
