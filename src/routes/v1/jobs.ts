import { Router, Request, Response } from 'express';
import { JobService } from '../../jobs/JobService';

export function createJobsRouter(jobService: JobService): Router {
  const router = Router();

  // GET /api/v1/jobs/:jobId
  router.get('/:jobId', async (req: Request, res: Response): Promise<void> => {
    const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
    if (!jobId) {
      res.status(404).json({
        error: 'NotFound',
        message: 'Job id not provided.',
        statusCode: 404,
      });
      return;
    }
    const job = await jobService.getJob(jobId);

    if (!job) {
      res.status(404).json({
        error: 'NotFound',
        message: `Job '${jobId}' was not found.`,
        statusCode: 404,
      });
      return;
    }

    res.status(200).json({ job });
  });

  return router;
}
