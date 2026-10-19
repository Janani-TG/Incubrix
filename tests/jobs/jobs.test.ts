import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryJobStore } from '../../src/jobs/JobStore';
import { JobWorker } from '../../src/jobs/JobWorker';
import { JobService } from '../../src/jobs/JobService';

describe('Background Jobs System', () => {
  let store: InMemoryJobStore;
  let worker: JobWorker;
  let service: JobService;

  beforeEach(() => {
    store = new InMemoryJobStore();
    worker = new JobWorker(store);
    service = new JobService(store);
  });

  describe('Job Enqueue and Successful Lifecycle', () => {
    it('should create a job and transition through queued -> running -> succeeded', async () => {
      worker.registerHandler('publish', async (job) => {
        return { published: true, destination: job.destinationKey };
      });

      const job = await service.enqueue({
        type: 'publish',
        destinationKey: 'mock-dest',
        data: { title: 'Async Post' },
      });

      expect(job.status).toBe('queued');
      expect(job.queuedAt).toBeDefined();

      const processed = await worker.processJob(job.id);

      expect(processed.status).toBe('succeeded');
      expect(processed.startedAt).toBeDefined();
      expect(processed.completedAt).toBeDefined();
      expect(processed.executionDurationMs).toBeGreaterThanOrEqual(0);
      expect(processed.result).toEqual({ published: true, destination: 'mock-dest' });
      expect(processed.attempts).toBe(1);
    });
  });

  describe('Job Failure Handling', () => {
    it('should record failed status and error details when handler throws', async () => {
      worker.registerHandler('failing-job', async () => {
        const err = new Error('Destination API down');
        (err as any).code = 'REMOTE_ERROR';
        throw err;
      });

      const job = await service.enqueue({
        type: 'failing-job',
        destinationKey: 'dest-down',
        data: {},
      });

      const failedJob = await worker.processJob(job.id);

      expect(failedJob.status).toBe('failed');
      expect(failedJob.failedAt).toBeDefined();
      expect(failedJob.error?.code).toBe('REMOTE_ERROR');
      expect(failedJob.error?.message).toContain('Destination API down');
    });

    it('should fail with NO_HANDLER when processing a job with unregistered type', async () => {
      const job = await service.enqueue({
        type: 'unregistered-type',
        destinationKey: 'dest-x',
        data: {},
      });

      const result = await worker.processJob(job.id);

      expect(result.status).toBe('failed');
      expect(result.error?.code).toBe('NO_HANDLER');
    });
  });

  describe('Sequential Job Processing', () => {
    it('should process all queued jobs sequentially', async () => {
      worker.registerHandler('item', async (job) => {
        return { id: job.id };
      });

      await service.enqueue({ type: 'item', destinationKey: 'd1', data: {} });
      await service.enqueue({ type: 'item', destinationKey: 'd2', data: {} });

      const processed = await worker.processAll();

      expect(processed).toHaveLength(2);
      expect(processed.every((j) => j.status === 'succeeded')).toBe(true);

      // No more queued jobs
      const remaining = await store.getNextQueued();
      expect(remaining).toBeNull();
    });
  });

  describe('Execution Deadline / Threshold Offload', () => {
    it('should return sync mode when execution finishes within threshold', async () => {
      const fastOperation = async () => ({ status: 'fast-success' });

      const outcome = await service.executeWithThreshold(
        fastOperation,
        500, // 500ms threshold
        async () => {
          return service.enqueue({ type: 'publish', destinationKey: 'd', data: {} });
        }
      );

      expect(outcome.mode).toBe('sync');
      if (outcome.mode === 'sync') {
        expect(outcome.result).toEqual({ status: 'fast-success' });
      }
    });

    it('should offload to background job when operation exceeds threshold (e.g. >2s)', async () => {
      // Simulate slow operation (80ms vs 20ms threshold for fast test execution)
      const slowOperation = async () => {
        await new Promise((res) => setTimeout(res, 80));
        return { status: 'slow-success' };
      };

      const outcome = await service.executeWithThreshold(
        slowOperation,
        20, // 20ms threshold
        async () => {
          return service.enqueue({
            type: 'publish',
            destinationKey: 'slow-dest',
            data: { reason: 'timed-out' },
          });
        }
      );

      expect(outcome.mode).toBe('async');
      if (outcome.mode === 'async') {
        expect(outcome.job.status).toBe('queued');
        expect(outcome.job.destinationKey).toBe('slow-dest');
      }
    });
  });
});
