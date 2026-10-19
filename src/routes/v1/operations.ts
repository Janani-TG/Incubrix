import { Router, Request, Response, NextFunction } from 'express';
import { ConnectorRegistry } from '../../connectors/ConnectorRegistry';

export function createOperationsRouter(connectorRegistry: ConnectorRegistry): Router {
  const router = Router();

  // POST /api/v1/destinations/:destinationKey/verify/:externalId
  router.post(
    '/:destinationKey/verify/:externalId',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const destinationKey = Array.isArray(req.params.destinationKey)
        ? req.params.destinationKey[0]
        : req.params.destinationKey;
      const externalId = Array.isArray(req.params.externalId)
        ? req.params.externalId[0]
        : req.params.externalId;

      if (!destinationKey || !connectorRegistry.has(destinationKey)) {
        res.status(404).json({
          error: 'NotFound',
          message: `Destination '${destinationKey}' is not registered.`,
          statusCode: 404,
        });
        return;
      }

      if (!externalId) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'externalId parameter is required.',
          statusCode: 400,
        });
        return;
      }

      const connector = connectorRegistry.get(destinationKey);

      try {
        const result = await connector.verify({
          destinationKey,
          externalId,
        });

        if (result.unsupported === true) {
          res.status(501).json({
            error: 'UnsupportedCapability',
            message: result.unsupportedReason || `Verification is not supported by connector '${destinationKey}'.`,
            statusCode: 501,
            unsupported: true,
          });
          return;
        }

        res.status(result.verified ? 200 : 404).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /api/v1/destinations/:destinationKey/status/:externalId
  router.get(
    '/:destinationKey/status/:externalId',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const destinationKey = Array.isArray(req.params.destinationKey)
        ? req.params.destinationKey[0]
        : req.params.destinationKey;
      const externalId = Array.isArray(req.params.externalId)
        ? req.params.externalId[0]
        : req.params.externalId;

      if (!destinationKey || !connectorRegistry.has(destinationKey)) {
        res.status(404).json({
          error: 'NotFound',
          message: `Destination '${destinationKey}' is not registered.`,
          statusCode: 404,
        });
        return;
      }

      if (!externalId) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'externalId parameter is required.',
          statusCode: 400,
        });
        return;
      }

      const connector = connectorRegistry.get(destinationKey);

      try {
        const result = await connector.getStatus({
          destinationKey,
          externalId,
        });

        if (result.unsupported === true) {
          res.status(501).json({
            error: 'UnsupportedCapability',
            message: result.unsupportedReason || `Status check is not supported by connector '${destinationKey}'.`,
            statusCode: 501,
            unsupported: true,
          });
          return;
        }

        res.status(result.success ? 200 : 404).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // DELETE /api/v1/destinations/:destinationKey/:externalId
  router.delete(
    '/:destinationKey/:externalId',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const destinationKey = Array.isArray(req.params.destinationKey)
        ? req.params.destinationKey[0]
        : req.params.destinationKey;
      const externalId = Array.isArray(req.params.externalId)
        ? req.params.externalId[0]
        : req.params.externalId;
      const simulate = req.query.simulate === 'true';

      if (!destinationKey || !connectorRegistry.has(destinationKey)) {
        res.status(404).json({
          error: 'NotFound',
          message: `Destination '${destinationKey}' is not registered.`,
          statusCode: 404,
        });
        return;
      }

      if (!externalId) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'externalId parameter is required.',
          statusCode: 400,
        });
        return;
      }

      const connector = connectorRegistry.get(destinationKey);

      try {
        const result = await connector.delete({
          destinationKey,
          externalId,
          simulate,
        });

        if (result.unsupported === true) {
          res.status(501).json({
            error: 'UnsupportedCapability',
            message: result.unsupportedReason || `Deletion is not supported by connector '${destinationKey}'.`,
            statusCode: 501,
            unsupported: true,
          });
          return;
        }

        res.status(result.success ? 200 : 404).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
