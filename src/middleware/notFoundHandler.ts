import { Request, Response, NextFunction } from 'express';

export function notFoundHandler(req: Request, res: Response, _next: NextFunction): void {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    statusCode: 404,
  });
}
