import { Job, JobStore } from './types';

/**
 * In-memory job store for background jobs.
 *
 * NOTE / LIMITATION:
 * This in-memory implementation does not persist across process restarts.
 * In a multi-worker production cluster, a durable persistent queue (e.g. BullMQ/Redis or PostgreSQL)
 * is required.
 */
export class InMemoryJobStore implements JobStore {
  private jobs = new Map<string, Job>();

  public create(job: Job): void {
    this.jobs.set(job.id, {
      ...job,
      queuedAt: new Date(job.queuedAt),
      ...(job.startedAt ? { startedAt: new Date(job.startedAt) } : {}),
      ...(job.completedAt ? { completedAt: new Date(job.completedAt) } : {}),
      ...(job.failedAt ? { failedAt: new Date(job.failedAt) } : {}),
    });
  }

  public get(id: string): Job | null {
    const job = this.jobs.get(id);
    if (!job) return null;
    return { ...job };
  }

  public update(id: string, updates: Partial<Job>): void {
    const existing = this.jobs.get(id);
    if (!existing) return;

    this.jobs.set(id, {
      ...existing,
      ...updates,
    });
  }

  public getNextQueued(): Job | null {
    const queuedJobs = Array.from(this.jobs.values())
      .filter((j) => j.status === 'queued')
      .sort((a, b) => a.queuedAt.getTime() - b.queuedAt.getTime());

    return queuedJobs[0] ? { ...queuedJobs[0] } : null;
  }

  public getAll(): Job[] {
    return Array.from(this.jobs.values()).map((j) => ({ ...j }));
  }

  public clear(): void {
    this.jobs.clear();
  }
}
