import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConnectorRegistry } from '../../src/connectors/ConnectorRegistry';
import { MockConnector } from '../../src/connectors/MockConnector';
import { DestinationRulesRegistry } from '../../src/rules/DestinationRulesRegistry';
import { PostingRulesEngine } from '../../src/rules/PostingRulesEngine';
import { InMemoryPublicationHistoryStore } from '../../src/rules/historyStore';
import { ControllableClock } from '../../src/rules/clock';
import { GuardedPublishService } from '../../src/rules/GuardedPublishService';
import { ContentPayload } from '../../src/connectors/types';
import { ConnectorError } from '../../src/connectors/errors';
import { RuleId } from '../../src/rules/types';

describe('GuardedPublishService (Rules Pipeline Integration)', () => {
  let connectorRegistry: ConnectorRegistry;
  let mockConnector: MockConnector;
  let rulesRegistry: DestinationRulesRegistry;
  let historyStore: InMemoryPublicationHistoryStore;
  let clock: ControllableClock;
  let rulesEngine: PostingRulesEngine;
  let guardedService: GuardedPublishService;

  const validContent: ContentPayload = {
    title: 'Valid Educational Article',
    body: 'Clean article content with no violations.',
    tags: ['education'],
  };

  const violatingContent: ContentPayload = {
    title: 'Violating Article',
    body: 'Click here to buy now and use discount code SAVE50! http://insecure.net',
  };

  beforeEach(() => {
    connectorRegistry = new ConnectorRegistry();
    mockConnector = new MockConnector({ destinationKey: 'guarded-mock' });
    connectorRegistry.register(mockConnector);

    rulesRegistry = new DestinationRulesRegistry();
    historyStore = new InMemoryPublicationHistoryStore();
    clock = new ControllableClock(new Date('2026-06-01T12:00:00.000Z'));
    rulesEngine = new PostingRulesEngine(rulesRegistry, historyStore, clock);

    guardedService = new GuardedPublishService(
      connectorRegistry,
      rulesEngine,
      historyStore
    );

    // Register strict rules for guarded-mock destination
    rulesRegistry.register({
      destinationKey: 'guarded-mock',
      frequencyLimit: { maxPosts: 2, windowSeconds: 3600 },
      selfPromotion: { disallowedKeywords: ['buy now', 'discount code'] },
      linkRestrictions: { requireHttps: true, maxLinks: 2 },
    });
  });

  describe('Allowed Publishing Pipeline', () => {
    it('should successfully evaluate and invoke connector.publish when content is compliant', async () => {
      const publishSpy = vi.spyOn(mockConnector, 'publish');

      const result = await guardedService.publish({
        destinationKey: 'guarded-mock',
        content: validContent,
      });

      expect(result.decision).toBe('allowed');
      expect(result.success).toBe(true);
      expect(result.status).toBe('published');
      expect(result.externalId).toBe('guarded-mock-1');
      expect(publishSpy).toHaveBeenCalledTimes(1);

      // Verify publication was recorded in history
      const recent = historyStore.getPublicationsSince(
        'guarded-mock',
        new Date('2026-06-01T00:00:00.000Z')
      );
      expect(recent).toHaveLength(1);
      expect(recent[0]?.externalId).toBe('guarded-mock-1');
    });
  });

  describe('Blocked Publishing Guarantee', () => {
    it('should guarantee that blocked requests NEVER invoke connector.publish', async () => {
      const publishSpy = vi.spyOn(mockConnector, 'publish');

      const result = await guardedService.publish({
        destinationKey: 'guarded-mock',
        content: violatingContent,
      });

      expect(result.decision).toBe('blocked');
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RULE_VIOLATION');
      expect(result.evaluation.allowed).toBe(false);
      expect(result.evaluation.violations.length).toBeGreaterThan(0);

      // CRITICAL GUARANTEE: connector.publish must NEVER be called
      expect(publishSpy).not.toHaveBeenCalled();
      expect(mockConnector.getAllItems()).toHaveLength(0);

      // Publication history must NOT be updated
      const recent = historyStore.getPublicationsSince(
        'guarded-mock',
        new Date('2026-06-01T00:00:00.000Z')
      );
      expect(recent).toHaveLength(0);
    });

    it('should guarantee that frequency limit exhaustion blocks further connector calls', async () => {
      const publishSpy = vi.spyOn(mockConnector, 'publish');

      // Post 1: allowed
      const res1 = await guardedService.publish({
        destinationKey: 'guarded-mock',
        content: validContent,
      });
      expect(res1.success).toBe(true);

      // Post 2: allowed
      const res2 = await guardedService.publish({
        destinationKey: 'guarded-mock',
        content: validContent,
      });
      expect(res2.success).toBe(true);

      expect(publishSpy).toHaveBeenCalledTimes(2);

      // Post 3 (frequency limit is 2 per hour): must be blocked
      const res3 = await guardedService.publish({
        destinationKey: 'guarded-mock',
        content: validContent,
      });

      expect(res3.decision).toBe('blocked');
      expect(res3.success).toBe(false);
      expect(res3.evaluation.violations[0]?.ruleId).toBe(RuleId.FREQUENCY_LIMIT);

      // Verify publishSpy was NOT called for the 3rd attempt
      expect(publishSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Simulation and Safety Rules', () => {
    it('should NOT allow simulation to bypass mandatory safety rules', async () => {
      const publishSpy = vi.spyOn(mockConnector, 'publish');

      // Attempt simulation with content that violates rules
      const result = await guardedService.publish({
        destinationKey: 'guarded-mock',
        content: violatingContent,
        simulate: true,
      });

      expect(result.decision).toBe('blocked');
      expect(result.success).toBe(false);
      expect(result.isSimulated).toBe(true);
      expect(publishSpy).not.toHaveBeenCalled();
    });

    it('should allow clean simulated requests but NOT record them in publication history', async () => {
      const publishSpy = vi.spyOn(mockConnector, 'publish');

      const result = await guardedService.publish({
        destinationKey: 'guarded-mock',
        content: validContent,
        simulate: true,
      });

      expect(result.decision).toBe('allowed');
      expect(result.success).toBe(true);
      expect(result.isSimulated).toBe(true);
      expect(result.status).toBe('simulated');
      expect(publishSpy).toHaveBeenCalledTimes(1);

      // Simulation must NOT consume frequency quota in historyStore
      const recent = historyStore.getPublicationsSince(
        'guarded-mock',
        new Date('2026-06-01T00:00:00.000Z')
      );
      expect(recent).toHaveLength(0);
    });
  });

  describe('Connector Lookup Error Handling', () => {
    it('should fail with CONNECTOR_NOT_FOUND when destination connector is not registered', async () => {
      await expect(
        guardedService.publish({
          destinationKey: 'non-existent-connector',
          content: validContent,
        })
      ).rejects.toThrow(ConnectorError);
    });
  });
});
