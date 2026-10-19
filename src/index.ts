import { app } from './app';
import { config } from './config';

export const createGracefulShutdown = (
  serverInstance: import('http').Server,
  options: {
    timeoutMs?: number;
    onExit?: (code: number) => void;
  } = {}
) => {
  const timeoutMs = options.timeoutMs ?? 10000;
  const onExit = options.onExit ?? process.exit;

  return (signal: string) => {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    let forceTimer: NodeJS.Timeout | undefined;

    // 1. Stop accepting new connections
    serverInstance.close(() => {
      console.log('HTTP server closed.');
      if (forceTimer) {
        clearTimeout(forceTimer);
      }
      onExit(0);
    });

    // 2. Close idle keep-alive connections so they do not keep the server hanging.
    // In-flight requests are preserved and allowed to finish cleanly.
    if (typeof (serverInstance as any).closeIdleConnections === 'function') {
      (serverInstance as any).closeIdleConnections();
    }

    // 3. Fallback: if in-flight requests fail to finish before timeout, forcibly terminate remaining connections.
    forceTimer = setTimeout(() => {
      console.error('Forcefully terminating process after timeout.');
      if (typeof (serverInstance as any).closeAllConnections === 'function') {
        (serverInstance as any).closeAllConnections();
      }
      onExit(1);
    }, timeoutMs);
    forceTimer.unref();

    return forceTimer;
  };
};

if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(config.port, config.host, () => {
    console.log(`IncuBrix service listening on http://${config.host}:${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
    console.log(`Health check available at http://${config.host}:${config.port}/health`);
  });

  const shutdownHandler = createGracefulShutdown(server);

  process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
  process.on('SIGINT', () => shutdownHandler('SIGINT'));
}
