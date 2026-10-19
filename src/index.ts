import { app } from './app';
import { config } from './config';

const server = app.listen(config.port, config.host, () => {
  console.log(`IncuBrix service listening on http://${config.host}:${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Health check available at http://${config.host}:${config.port}/health`);
});

const gracefulShutdown = (signal: string) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Forcefully terminating process after timeout.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
