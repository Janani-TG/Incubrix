import { Request, Response, NextFunction } from 'express';

/**
 * Middleware requiring an Idempotency-Key header on publication requests.
 */
export function requireIdempotencyKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const idempotencyKey = req.header('Idempotency-Key') || req.header('idempotency-key');

  if (!idempotencyKey || !idempotencyKey.trim()) {
    res.status(400).json({
      error: 'ValidationError',
      message: "Header 'Idempotency-Key' is required for publication requests.",
      statusCode: 400,
    });
    return;
  }

  // Attach trimmed key to request object
  (req as any).idempotencyKey = idempotencyKey.trim();
  next();
}

/**
 * Middleware validating that content payload contains required fields (title, body).
 */
export function validatePublishPayload(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { content } = req.body || {};

  if (!content || typeof content !== 'object') {
    res.status(400).json({
      error: 'ValidationError',
      message: "Request body must include a 'content' object.",
      statusCode: 400,
    });
    return;
  }

  if (!content.title || typeof content.title !== 'string' || !content.title.trim()) {
    res.status(400).json({
      error: 'ValidationError',
      message: "Field 'content.title' must be a non-empty string.",
      statusCode: 400,
    });
    return;
  }

  if (!content.body || typeof content.body !== 'string' || !content.body.trim()) {
    res.status(400).json({
      error: 'ValidationError',
      message: "Field 'content.body' must be a non-empty string.",
      statusCode: 400,
    });
    return;
  }

  next();
}
