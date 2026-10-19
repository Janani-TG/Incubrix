import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConnectorRegistry } from '../../src/connectors/ConnectorRegistry';
import { MockConnector } from '../../src/connectors/MockConnector';
import { DestinationRulesRegistry } from '../../src/rules/DestinationRulesRegistry';
import { PostingRulesEngine } from '../../src/rules/PostingRulesEngine';
import { InMemoryPublicationHistoryStore } from '../../src/rules/historyStore';
import { ControllableClock } from '../../src/rules/clock';
import { GuardedPublishService } from '../../src/rules/GuardedPublishService';
import { InMemoryIdempotencyStore } from '../../src/reliability/idempotency/store';
import { IdempotencyManager } from '../../src/reliability/idempotency/IdempotencyManager';
import { RetryPolicy } from '../../src/reliability/retry/RetryPolicy';
import { NoOpDelayer } from '../../src/reliability/retry/delayer';
import { ReliablePublishService } from '../../src/reliability/ReliablePublishService';
import { ContentPayload } from '../../src/connectors/types';
import { AmbiguousOutcomeError } from '../../src/reliability/retry/types';

describe('ReliablePublishService Safety Integration', () => {
  let connectorRegistry: ConnectorRegistry;
  let mockConnector: MockConnector;
  let rulesRegistry: DestinationRulesRegistry;
  let historyStore: InMemoryPublicationHistoryStore;
  let clock: ControllableClock;
  let guardedService: GuardedPublishService;
  let idempotencyStore: InMemoryIdempotencyStore;
  let idempotencyManager: IdempotencyManager;
  let delayer: NoOpDelayer;
  let retryPolicy: RetryPolicy;
  let reliableService: ReliablePublishService;

  const validContent: ContentPayload = {
    title: 'Clean Engineering Post',
    body: 'Clean architectural content without policy violations.',
    tags: ['tech'],
  };

  const violatingContent: ContentPayload = {
    title: 'Spammy Promo Post',
    body: 'Click here to buy now and get a discount code! http://insecure.net',
  };

  beforeEach(() => {
    connectorRegistry = new ConnectorRegistry();
    mockConnector = new MockConnector({ destinationKey: 'reliable-dest' });
    connectorRegistry.register(mockConnector);

    rulesRegistry = new DestinationRulesRegistry();
    historyStore = new InMemoryPublicationHistoryStore();
    clock = new ControllableClock(new Date('2026-06-01T12:00:00.000Z'));

    const rulesEngine = new PostingRulesEngine(rulesRegistry, historyStore, clock);
    guardedService = new GuardedPublishService(
      connectorRegistry,
      rulesEngine,
      historyStore
    );

    idempotencyStore = new InMemoryIdempotencyStore();
    idempotencyManager = new IdempotencyManager(idempotencyStore);
    delayer = new NoOpDelayer();
    retryPolicy = new RetryPolicy(delayer, {
      maxAttempts: 3,
      initialBackoffMs: 100,
      maxBackoffMs: 1000,
      backoffMultiplier: 2,
    });

    reliableService = new ReliablePublishService(
      guardedService,
      idempotencyManager,
      retryPolicy
    );

    // Configure destination rules
    rulesRegistry.register({
      destinationKey: 'reliable-dest',
      frequencyLimit: { maxPosts: 5, windowSeconds: 3600 },
      selfPromotion: { disallowedKeywords: ['buy now', 'discount code'] },
      linkRestrictions: { requireHttps: true },
    });
  });

  describe('Rule-Blocked Request Safety Guarantee', () => {
    it('should guarantee that rule-blocked requests are never published and never retried', async () => {
      const publishSpy = vi.spyOn(mockConnector, 'publish');

      const result = await reliableService.publish(
        {
          destinationKey: 'reliable-dest',
          content: violatingContent,
        },
        { idempotencyKey: 'blocked-key-1' }
      );

      expect(result.decision).toBe('blocked');
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RULE_VIOLATION');
      expect(publishSpy).not.toHaveBeenCalled();

      // Repeated request with same idempotency key returns cached blocked result
      const repeatResult = await reliableService.publish(
        {
          destinationKey: 'reliable-dest',
          content: violatingContent,
        },
        { idempotencyKey: 'blocked-key-1' }
      );

      expect(repeatResult.decision).toBe('blocked');
      expect(repeatResult.isCached).toBe(true);
      expect(publishSpy).not.toHaveBeenCalled();
    });
  });

  describe('Transient Failure Retries', () => {
    it('should retry transient connector failures and return success once resolved', async () => {
      let callCount = 0;
      vi.spyOn(mockConnector, 'publish').mockImplementation(async (req) => {
        callCount++;
        if (callCount === 1) {
          // First attempt fails transiently with RATE_LIMITED
          return {
            success: false,
            destinationKey: req.destinationKey,
            status: 'failed',
            isSimulated: false,
            timestamp: new Date().toISOString(),
            error: {
              code: 'RATE_LIMITED',
              message: 'Rate limit exceeded on destination',
            },
          };
        }
        // Second attempt succeeds
        return {
          success: true,
          destinationKey: req.destinationKey,
          externalId: 'reliable-post-1',
          externalUrl: 'https://mock.incubrix.local/posts/reliable-post-1',
          status: 'published',
          isSimulated: false,
          timestamp: new Date().toISOString(),
        };
      });

      const result = await reliableService.publish(
        {
          destinationKey: 'reliable-dest',
          content: validContent,
        },
        { idempotencyKey: 'retry-key-1' }
      );

      expect(result.success).toBe(true);
      expect(result.externalId).toBe('reliable-post-1');
      expect(callCount).toBe(2);
      expect(delayer.recordedDelays).toEqual([100]);
    });
  });

  describe('Ambiguous Outcome Handling', () => {
    it('should halt retries on ambiguous outcomes to prevent duplicate publication', async () => {
      vi.spyOn(mockConnector, 'publish').mockResolvedValue({
        success: false,
        destinationKey: 'reliable-dest',
        status: 'failed',
        isSimulated: false,
        timestamp: new Date().toISOString(),
        error: {
          code: 'AMBIGUOUS_OUTCOME',
          message: 'Timeout waiting for destination response after socket send',
        },
      });

      await expect(
        reliableService.publish({
          destinationKey: 'reliable-dest',
          content: validContent,
        })
      ).rejects.toThrow(AmbiguousOutcomeError);
    });
  });

  describe('Simulation Isolation', () => {
    it('should execute simulation cleanly without recording in publication history', async () => {
      const publishSpy = vi.spyOn(mockConnector, 'publish');

      const result = await reliableService.publish({
        destinationKey: 'reliable-dest',
        content: validContent,
        simulate: true,
      });

      expect(result.success).toBe(true);
      expect(result.isSimulated).toBe(true);
      expect(result.status).toBe('simulated');
      expect(publishSpy).toHaveBeenCalledTimes(1);

      // Simulation MUST NOT be recorded in publication history store
      const recent = historyStore.getPublicationsSince(
        'reliable-dest',
        new Date('2026-06-01T00:00:00.000Z')
      );
      expect(recent).toHaveLength(0);
    });

    it('should block simulated posts that violate rules', async () => {
      const publishSpy = vi.spyOn(mockConnector, 'publish');

      const result = await reliableService.publish({
        destinationKey: 'reliable-dest',
        content: violatingContent,
        simulate: true,
      });

      expect(result.decision).toBe('blocked');
      expect(result.success).toBe(false);
      expect(publishSpy).not.toHaveBeenCalled();
    });
  });
});
