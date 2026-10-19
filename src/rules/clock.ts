/**
 * Clock abstraction for deterministic time handling and testability.
 */
export interface Clock {
  now(): Date;
}

/**
 * Standard real-time system clock.
 */
export class SystemClock implements Clock {
  public now(): Date {
    return new Date();
  }
}

/**
 * Controllable clock for deterministic tests, allowing explicit advancement without timers.
 */
export class ControllableClock implements Clock {
  private currentTime: Date;

  constructor(initialTime: Date = new Date('2026-01-01T12:00:00.000Z')) {
    this.currentTime = new Date(initialTime);
  }

  public now(): Date {
    return new Date(this.currentTime);
  }

  public setTime(date: Date): void {
    this.currentTime = new Date(date);
  }

  public advanceSeconds(seconds: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + seconds * 1000);
  }

  public advanceMilliseconds(ms: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + ms);
  }
}
