import { Router, Request, Response } from 'express';
import { ConnectorRegistry } from '../../connectors/ConnectorRegistry';
import { DestinationRulesRegistry } from '../../rules/DestinationRulesRegistry';

export function createDestinationsRouter(
  connectorRegistry: ConnectorRegistry,
  rulesRegistry: DestinationRulesRegistry
): Router {
  const router = Router();

  // GET /api/v1/destinations
  router.get('/', (_req: Request, res: Response) => {
    const connectors = connectorRegistry.getAll();
    const destinations = connectors.map((c) => ({
      destinationKey: c.destinationKey,
      name: c.name,
      capabilities: c.capabilities,
      rulesConfigured: rulesRegistry.has(c.destinationKey),
    }));

    res.status(200).json({ destinations });
  });

  // GET /api/v1/destinations/:destinationKey
  router.get('/:destinationKey', (req: Request, res: Response) => {
    const destinationKey = Array.isArray(req.params.destinationKey)
      ? req.params.destinationKey[0]
      : req.params.destinationKey;
    if (!destinationKey || !connectorRegistry.has(destinationKey)) {
      res.status(404).json({
        error: 'NotFound',
        message: `Destination '${destinationKey}' is not registered.`,
        statusCode: 404,
      });
      return;
    }

    const connector = connectorRegistry.get(destinationKey);
    const rules = rulesRegistry.get(destinationKey);

    res.status(200).json({
      destination: {
        destinationKey: connector.destinationKey,
        name: connector.name,
        capabilities: connector.capabilities,
        rules: rules || null,
      },
    });
  });

  return router;
}
