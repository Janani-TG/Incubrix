import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { config } from '../config';

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  stack?: string;
}

export function errorHandler(
  err: Error | AppError | unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // 1. Explicitly handle malformed JSON from express.json() / body-parser
  const isMalformedJson =
    err instanceof SyntaxError &&
    (('status' in (err as any) && (err as any).status === 400 && 'body' in (err as any)) ||
      (err as any).type === 'entity.parse.failed');

  if (isMalformedJson) {
    res.status(400).json({
      error: 'ValidationError',
      message: 'Malformed JSON payload in request body.',
      statusCode: 400,
    });
    return;
  }

  const isProduction = process.env.NODE_ENV === 'production' || config.isProduction;

  // 2. Preserve known AppError instances and validate their status codes
  if (err instanceof AppError) {
    const statusCode =
      Number.isInteger(err.statusCode) && err.statusCode >= 400 && err.statusCode <= 599
        ? err.statusCode
        : 500;

    const is500 = statusCode === 500;
    const message =
      is500 && isProduction
        ? 'Internal Server Error'
        : err.message || 'An error occurred';
    const errorName =
      is500 && isProduction
        ? 'InternalServerError'
        : err.name || 'Error';

    const response: ErrorResponse = {
      error: errorName,
      message,
      statusCode,
    };

    if (!isProduction && err.stack) {
      response.stack = err.stack;
    }

    res.status(statusCode).json(response);
    return;
  }

  // 3. Map all other unexpected errors to HTTP 500 without leaking internal details in production
  const errorObj = err instanceof Error ? err : new Error(String(err));
  const statusCode = 500;
  const message = isProduction ? 'Internal Server Error' : errorObj.message || 'Internal Server Error';
  const errorName = isProduction ? 'InternalServerError' : errorObj.name || 'InternalServerError';

  const response: ErrorResponse = {
    error: errorName,
    message,
    statusCode,
  };

  if (!isProduction && errorObj.stack) {
    response.stack = errorObj.stack;
  }

  res.status(statusCode).json(response);
}
