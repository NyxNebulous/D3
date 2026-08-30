import type { NextFunction, Request, Response } from "express";
import { AppError } from "./errors.js";

type RateLimitOptions = {
  limit: number;
  windowMs: number;
  keyPrefix: string;
  key?: (request: Request) => string;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function createRateLimiter(options: RateLimitOptions) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = `${options.keyPrefix}:${options.key?.(request) ?? request.ip ?? "unknown"}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    if (bucket.count >= options.limit) {
      next(new AppError(429, "RATE_LIMITED", "Too many requests"));
      return;
    }

    bucket.count += 1;
    next();
  };
}

export function resetRateLimitsForTests(): void {
  buckets.clear();
}

