import express, { Application } from 'express';
import { config } from './config';
import { healthRouter } from './routes/health';
import { v1Router } from './routes/v1';
import { notFoundHandler } from './middleware/notFoundHandler';
import { errorHandler } from './middleware/errorHandler';

export function createApp(): Application {
  const app = express();

  // Parse incoming JSON and urlencoded requests
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check endpoint
  app.use('/health', healthRouter);

  // Future REST API routes under /api/v1
  app.use(config.apiPrefix, v1Router);

  // 404 Not Found handler for unknown routes
  app.use(notFoundHandler);

  // Centralized error handling middleware
  app.use(errorHandler);

  return app;
}

export const app = createApp();
export default app;
