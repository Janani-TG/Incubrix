import { describe, it, expect, vi } from 'vitest';
import http from 'http';
import { createGracefulShutdown } from '../../src/index';

describe('Graceful Shutdown (createGracefulShutdown)', () => {
  it('should close idle connections, close server, and exit with code 0 on clean close', async () => {
    const mockCloseIdleConnections = vi.fn();
    const mockCloseAllConnections = vi.fn();
    const mockClose = vi.fn((cb?: (err?: Error) => void) => {
      if (cb) cb();
      return mockServer as any;
    });

    const mockServer = {
      close: mockClose,
      closeIdleConnections: mockCloseIdleConnections,
      closeAllConnections: mockCloseAllConnections,
    } as unknown as http.Server;

    const mockExit = vi.fn();

    const shutdown = createGracefulShutdown(mockServer, {
      timeoutMs: 1000,
      onExit: mockExit,
    });

    shutdown('SIGTERM');

    // 1. Should close server to stop accepting new requests
    expect(mockClose).toHaveBeenCalledTimes(1);

    // 2. Should immediately close idle connections
    expect(mockCloseIdleConnections).toHaveBeenCalledTimes(1);

    // 3. Should NOT immediately call closeAllConnections (preserving in-flight requests)
    expect(mockCloseAllConnections).not.toHaveBeenCalled();

    // 4. Server close callback executed, so process exit should be called with 0
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  it('should preserve in-flight requests and only force-close on timeout', async () => {
    vi.useFakeTimers();

    const mockCloseIdleConnections = vi.fn();
    const mockCloseAllConnections = vi.fn();
    let closeCallback: ((err?: Error) => void) | undefined;
    const mockClose = vi.fn((cb?: (err?: Error) => void) => {
      closeCallback = cb; // Keep close callback pending to simulate in-flight request
      return mockServer as any;
    });

    const mockServer = {
      close: mockClose,
      closeIdleConnections: mockCloseIdleConnections,
      closeAllConnections: mockCloseAllConnections,
    } as unknown as http.Server;

    const mockExit = vi.fn();

    const shutdown = createGracefulShutdown(mockServer, {
      timeoutMs: 5000,
      onExit: mockExit,
    });

    shutdown('SIGINT');

    // At start: closeIdleConnections called, closeAllConnections not called, onExit not called
    expect(mockCloseIdleConnections).toHaveBeenCalledTimes(1);
    expect(mockCloseAllConnections).not.toHaveBeenCalled();
    expect(mockExit).not.toHaveBeenCalled();

    // Advance time before timeout
    vi.advanceTimersByTime(2500);
    expect(mockCloseAllConnections).not.toHaveBeenCalled();
    expect(mockExit).not.toHaveBeenCalled();

    // Simulate in-flight request completing before timeout
    if (closeCallback) {
      closeCallback();
    }
    expect(mockExit).toHaveBeenCalledWith(0);
    expect(mockCloseAllConnections).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('should trigger closeAllConnections and exit with code 1 if timeout expires', async () => {
    vi.useFakeTimers();

    const mockCloseIdleConnections = vi.fn();
    const mockCloseAllConnections = vi.fn();
    const mockClose = vi.fn(() => {
      // Never call cb to simulate stuck in-flight request
      return mockServer as any;
    });

    const mockServer = {
      close: mockClose,
      closeIdleConnections: mockCloseIdleConnections,
      closeAllConnections: mockCloseAllConnections,
    } as unknown as http.Server;

    const mockExit = vi.fn();

    const shutdown = createGracefulShutdown(mockServer, {
      timeoutMs: 3000,
      onExit: mockExit,
    });

    shutdown('SIGTERM');

    expect(mockCloseIdleConnections).toHaveBeenCalledTimes(1);
    expect(mockCloseAllConnections).not.toHaveBeenCalled();
    expect(mockExit).not.toHaveBeenCalled();

    // Fast-forward past timeout
    vi.advanceTimersByTime(3001);

    // Should forcibly close all connections and exit with 1
    expect(mockCloseAllConnections).toHaveBeenCalledTimes(1);
    expect(mockExit).toHaveBeenCalledWith(1);

    vi.useRealTimers();
  });
});
