import type { NextFunction, Request, Response } from "express";
import type { AppConfig } from "../config/env.js";
import { AppError } from "./errors.js";

export function isAllowedOrigin(origin: string, configuredOrigin: string): boolean {
  if (origin === configuredOrigin) {
    return true;
  }

  try {
    const url = new URL(origin);
    // Allow localhost & 127.0.0.1 on any port for local development
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return true;
    }
    // Allow Cloudflare quick tunnels (*.trycloudflare.com)
    if (url.hostname.endsWith(".trycloudflare.com")) {
      return true;
    }
    // Allow Cloudflare Pages (*.pages.dev)
    if (url.hostname.endsWith(".pages.dev")) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

export function createOriginGuard(config: AppConfig) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      next();
      return;
    }

    const origin = request.get("origin");

    if (origin && !isAllowedOrigin(origin, config.corsOrigin)) {
      next(new AppError(403, "ORIGIN_FORBIDDEN", "Request origin is not allowed"));
      return;
    }

    next();
  };
}
