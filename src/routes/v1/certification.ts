import { Router, Request, Response, NextFunction } from 'express';
import { ConnectorRegistry } from '../../connectors/ConnectorRegistry';
import { ConnectorCertificationHarness } from '../../certification/ConnectorCertificationHarness';
import { CertificationStore } from '../../certification/CertificationStore';
import { CertificationReport } from '../../certification/types';

export function createCertificationRouter(
  connectorRegistry: ConnectorRegistry,
  harness: ConnectorCertificationHarness,
  store: CertificationStore
): Router {
  const router = Router();

  // POST /api/v1/certification/run
  router.post(
    '/run',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const { destinationKey, mode = 'mock', allowLive = false } = req.body || {};

      try {
        const connectorsToCertify = destinationKey
          ? [connectorRegistry.get(destinationKey)]
          : connectorRegistry.getAll();

        const reports: CertificationReport[] = [];

        for (const connector of connectorsToCertify) {
          const report = await harness.certify(connector, {
            mode,
            allowLive: Boolean(allowLive),
          });
          store.save(report);
          reports.push(report);
        }

        const overallSuccess = reports.every((r) => r.isCertified);

        res.status(200).json({
          overallSuccess,
          count: reports.length,
          reports,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /api/v1/certification
  router.get('/', (_req: Request, res: Response): void => {
    const reports = store.getAll();
    res.status(200).json({ reports });
  });

  // GET /api/v1/certification/:runId
  router.get('/:runId', (req: Request, res: Response): void => {
    const runId = Array.isArray(req.params.runId) ? req.params.runId[0] : req.params.runId;
    if (!runId) {
      res.status(404).json({
        error: 'NotFound',
        message: 'Certification report id not provided.',
        statusCode: 404,
      });
      return;
    }
    const report = store.get(runId);

    if (!report) {
      res.status(404).json({
        error: 'NotFound',
        message: `Certification report '${runId}' not found.`,
        statusCode: 404,
      });
      return;
    }

    res.status(200).json({ report });
  });

  return router;
}
