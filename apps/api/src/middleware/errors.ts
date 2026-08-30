import type { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import type { AppConfig } from "../config/env.js";

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly expose: boolean;

  constructor(status: number, code: string, message: string, expose = true) {
    super(message);
    this.status = status;
    this.code = code;
    this.expose = expose;
  }
}

export function asyncHandler(
  handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown> | unknown
) {
  return (request: Request, response: Response, next: NextFunction) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

export function notFoundHandler(_request: Request, _response: Response, next: NextFunction): void {
  next(new AppError(404, "NOT_FOUND", "Route not found"));
}

export function createErrorHandler(config: AppConfig): ErrorRequestHandler {
  return (error, _request, response, _next) => {
    if (error instanceof ZodError) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request"
        }
      });
      return;
    }

    if (error instanceof AppError) {
      response.status(error.status).json({
        error: {
          code: error.code,
          message: error.expose ? error.message : "Request failed"
        }
      });
      return;
    }

    if (config.nodeEnv !== "test") {
      console.error(error);
    }

    response.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Request failed"
      }
    });
  };
}

