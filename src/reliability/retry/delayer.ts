/**
 * Abstraction for backoff delays allowing zero-waiting deterministic test execution.
 */
export interface Delayer {
  delay(ms: number): Promise<void>;
}

/**
 * Real-time delayer for production runtime.
 */
export class RealDelayer implements Delayer {
  public delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Deterministic no-op delayer for automated tests that records requested delay intervals without waiting.
 */
export class NoOpDelayer implements Delayer {
  public recordedDelays: number[] = [];

  public async delay(ms: number): Promise<void> {
    this.recordedDelays.push(ms);
  }

  public reset(): void {
    this.recordedDelays = [];
  }
}
