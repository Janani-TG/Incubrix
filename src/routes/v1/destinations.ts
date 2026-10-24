import { Router, Request, Response } from 'express';
import { ConnectorRegistry } from '../../connectors/ConnectorRegistry';
import { DestinationRulesRegistry } from '../../rules/DestinationRulesRegistry';
import { PublicationHistoryStore } from '../../rules/historyStore';
import { Clock, SystemClock } from '../../rules/clock';
import { findActiveSlot, getNextAvailableSlot, getSlotWindow } from '../../rules/utils/slotCalculator';

export function createDestinationsRouter(
  connectorRegistry: ConnectorRegistry,
  rulesRegistry: DestinationRulesRegistry,
  historyStore?: PublicationHistoryStore,
  clock: Clock = new SystemClock()
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

  // GET /api/v1/destinations/:destinationKey/slots
  router.get('/:destinationKey/slots', async (req: Request, res: Response) => {
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

    const rules = rulesRegistry.get(destinationKey);
    const slotsConfig = rules?.publishingSlots;

    if (!slotsConfig || !slotsConfig.slots || slotsConfig.slots.length === 0 || slotsConfig.enabled === false) {
      res.status(200).json({
        destinationKey,
        slotsConfigured: false,
        isWithinSlot: true,
        currentSlot: null,
        nextAvailableSlot: null,
        slots: [],
      });
      return;
    }

    const now = clock.now();
    const timeZone = slotsConfig.timezone || 'UTC';
    const activeSlot = findActiveSlot(now, slotsConfig.slots, timeZone);
    const nextSlot = getNextAvailableSlot(now, slotsConfig.slots, timeZone);

    const enrichedSlots = await Promise.all(
      slotsConfig.slots.map(async (slot) => {
        let usedCapacity = 0;
        let remainingCapacity: number | null = null;

        if (historyStore && slot.maxPostsPerSlot !== undefined) {
          const window = getSlotWindow(now, slot, timeZone);
          const records = await historyStore.getPublicationsSince(destinationKey, window.start);
          usedCapacity = records.filter(
            (r) => r.publishedAt.getTime() < window.end.getTime() && r.isSimulated !== true
          ).length;
          remainingCapacity = Math.max(0, slot.maxPostsPerSlot - usedCapacity);
        }

        return {
          ...slot,
          usedCapacity,
          remainingCapacity,
        };
      })
    );

    let currentSlotData = null;
    if (activeSlot) {
      const activeEnriched = enrichedSlots.find((s) => s.start === activeSlot.start && s.end === activeSlot.end);
      currentSlotData = activeEnriched || activeSlot;
    }

    res.status(200).json({
      destinationKey,
      slotsConfigured: true,
      timezone: timeZone,
      currentTime: now.toISOString(),
      isWithinSlot: Boolean(activeSlot),
      currentSlot: currentSlotData,
      nextAvailableSlot: nextSlot
        ? {
            ...nextSlot.slot,
            startsAt: nextSlot.startsAt.toISOString(),
          }
        : null,
      slots: enrichedSlots,
    });
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
