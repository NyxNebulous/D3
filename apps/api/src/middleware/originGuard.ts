import type { NextFunction, Request, Response } from "express";
import type { AppConfig } from "../config/env.js";
import { AppError } from "./errors.js";

export function createOriginGuard(config: AppConfig) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      next();
      return;
    }

    const origin = request.get("origin");

    if (origin && origin !== config.corsOrigin) {
      next(new AppError(403, "ORIGIN_FORBIDDEN", "Request origin is not allowed"));
      return;
    }

    next();
  };
}

