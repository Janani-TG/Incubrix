import { Router, Request, Response, NextFunction } from 'express';
import { ReliablePublishService } from '../../reliability/ReliablePublishService';
import { JobService } from '../../jobs/JobService';
import { ConnectorRegistry } from '../../connectors/ConnectorRegistry';
import { requireIdempotencyKey, validatePublishPayload } from './middleware/validation';
import { IdempotencyConflictError } from '../../reliability/idempotency/errors';

export function createPublishRouter(
  reliablePublishService: ReliablePublishService,
  jobService: JobService,
  connectorRegistry: ConnectorRegistry
): Router {
  const router = Router();

  // POST /api/v1/destinations/:destinationKey/publish
  router.post(
    '/:destinationKey/publish',
    requireIdempotencyKey,
    validatePublishPayload,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const destinationKey = Array.isArray(req.params.destinationKey)
        ? req.params.destinationKey[0]
        : req.params.destinationKey;
      const idempotencyKey = (req as any).idempotencyKey as string;

      if (!destinationKey || !connectorRegistry.has(destinationKey)) {
        res.status(404).json({
          error: 'NotFound',
          message: `Destination '${destinationKey}' is not registered.`,
          statusCode: 404,
        });
        return;
      }

      const { content, simulate, async: isAsync, metadata } = req.body;
      const publishRequest = {
        destinationKey,
        content,
        simulate: Boolean(simulate),
        metadata,
      };

      try {
        // Explicit async background job requested
        if (isAsync === true) {
          const job = await jobService.enqueue({
            type: 'publish',
            destinationKey,
            data: publishRequest,
            idempotencyKey,
          });

          res.status(202).json({
            status: 'queued',
            jobId: job.id,
            destinationKey,
            message: 'Publishing request queued for background execution.',
            checkStatusUrl: `/api/v1/jobs/${job.id}`,
          });
          return;
        }

        // Synchronous execution with 2-second threshold enforcement
        const outcome = await jobService.executeWithThreshold(
          async () => {
            return reliablePublishService.publish(publishRequest, {
              idempotencyKey,
            });
          },
          2000, // 2000ms threshold
          async () => {
            return jobService.enqueue({
              type: 'publish',
              destinationKey,
              data: publishRequest,
              idempotencyKey,
            });
          }
        );

        if (outcome.mode === 'async') {
          res.status(202).json({
            status: 'queued',
            jobId: outcome.job.id,
            destinationKey,
            message: 'Operation exceeded processing deadline; running as background job.',
            checkStatusUrl: `/api/v1/jobs/${outcome.job.id}`,
          });
          return;
        }

        const result = outcome.result;

        // If posting rules blocked the content, return HTTP 422 Unprocessable Content
        if (result.decision === 'blocked') {
          res.status(422).json({
            error: 'RuleViolation',
            decision: 'blocked',
            message: result.error?.message || 'Publishing was blocked by destination posting rules.',
            violations: result.evaluation.violations,
            statusCode: 422,
          });
          return;
        }

        // Return HTTP 200 / 201 with result
        res.status(result.isCached ? 200 : 201).json(result);
      } catch (err: unknown) {
        if (err instanceof IdempotencyConflictError) {
          res.status(409).json({
            error: 'IdempotencyConflict',
            message: err.message,
            statusCode: 409,
          });
          return;
        }
        next(err);
      }
    }
  );

  return router;
}
