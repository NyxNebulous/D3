import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { AppConfig } from "../config/env.js";
import type { Database } from "../db/database.js";
import { createOriginGuard } from "../middleware/originGuard.js";
import { createErrorHandler, notFoundHandler } from "../middleware/errors.js";
import { createAdminRouter } from "../modules/admin/admin.routes.js";
import { createAuthRouter } from "../modules/auth/auth.routes.js";
import { createCartRouter } from "../modules/cart/cart.routes.js";
import { createMenuRouter } from "../modules/menu/menu.routes.js";
import { createOrdersRouter } from "../modules/orders/orders.routes.js";
import { createQrRouter } from "../modules/qr/qr.routes.js";

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
  app.use(express.json({ limit: "32kb" }));
  app.use(cookieParser());
  app.use(createOriginGuard(config));

  app.get("/health", (_request, response) => {
    response.json({ ok: true, service: "D3 API" });
  });

  app.use("/api/qr", createQrRouter(database, config));
  app.use("/api/auth", createAuthRouter(database, config));
  app.use("/api", createAdminRouter(database, config));
  app.use("/api", createMenuRouter(database));
  app.use("/api", createCartRouter(database));
  app.use("/api", createOrdersRouter(database));

  app.use(notFoundHandler);
  app.use(createErrorHandler(config));

  return app;
}

