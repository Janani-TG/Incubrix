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
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = err.message || 'Internal Server Error';
  const errorName = err.name || 'InternalServerError';

  const response: ErrorResponse = {
    error: errorName,
    message,
    statusCode,
  };

  if (!config.isProduction && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}
