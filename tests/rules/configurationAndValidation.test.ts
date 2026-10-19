import { describe, it, expect, beforeEach } from 'vitest';
import { DestinationRulesRegistry } from '../../src/rules/DestinationRulesRegistry';
import { RuleConfigurationError } from '../../src/rules/validation';

describe('DestinationRulesRegistry and Rule Configuration Validation', () => {
  let registry: DestinationRulesRegistry;

  beforeEach(() => {
    registry = new DestinationRulesRegistry();
  });

  it('should register and retrieve valid destination rules', () => {
    registry.register({
      destinationKey: 'test-dest',
      frequencyLimit: { maxPosts: 5, windowSeconds: 3600, cooldownSeconds: 30 },
      selfPromotion: { maxPromotionalLinks: 1, maxKeywordOccurrences: 0 },
      linkRestrictions: { maxLinks: 3, requireHttps: true },
      aiDisclosure: { required: false, requireIfAiGenerated: true },
    });

    expect(registry.has('test-dest')).toBe(true);
    const retrieved = registry.get('test-dest');
    expect(retrieved).toBeDefined();
    expect(retrieved?.frequencyLimit?.maxPosts).toBe(5);
  });

  it('should reject missing or empty destinationKey', () => {
    expect(() =>
      registry.register({
        destinationKey: '',
      })
    ).toThrow(RuleConfigurationError);

    expect(() =>
      registry.register({
        destinationKey: '   ',
      })
    ).toThrow(RuleConfigurationError);
  });

  describe('Frequency Limit Validation', () => {
    it('should reject non-positive or non-integer maxPosts', () => {
      expect(() =>
        registry.register({
          destinationKey: 'dest',
          frequencyLimit: { maxPosts: 0, windowSeconds: 60 },
        })
      ).toThrow(RuleConfigurationError);

      expect(() =>
        registry.register({
          destinationKey: 'dest',
          frequencyLimit: { maxPosts: -2, windowSeconds: 60 },
        })
      ).toThrow(RuleConfigurationError);

      expect(() =>
        registry.register({
          destinationKey: 'dest',
          frequencyLimit: { maxPosts: 2.5, windowSeconds: 60 },
        })
      ).toThrow(RuleConfigurationError);
    });

    it('should reject non-positive windowSeconds', () => {
      expect(() =>
        registry.register({
          destinationKey: 'dest',
          frequencyLimit: { maxPosts: 2, windowSeconds: 0 },
        })
      ).toThrow(RuleConfigurationError);

      expect(() =>
        registry.register({
          destinationKey: 'dest',
          frequencyLimit: { maxPosts: 2, windowSeconds: -10 },
        })
      ).toThrow(RuleConfigurationError);
    });

    it('should reject negative cooldownSeconds', () => {
      expect(() =>
        registry.register({
          destinationKey: 'dest',
          frequencyLimit: { maxPosts: 2, windowSeconds: 60, cooldownSeconds: -5 },
        })
      ).toThrow(RuleConfigurationError);
    });
  });

  describe('Self-Promotion Validation', () => {
    it('should reject negative maxPromotionalLinks', () => {
      expect(() =>
        registry.register({
          destinationKey: 'dest',
          selfPromotion: { maxPromotionalLinks: -1 },
        })
      ).toThrow(RuleConfigurationError);
    });

    it('should reject negative maxKeywordOccurrences', () => {
      expect(() =>
        registry.register({
          destinationKey: 'dest',
          selfPromotion: { maxKeywordOccurrences: -1 },
        })
      ).toThrow(RuleConfigurationError);
    });
  });

  describe('Link Restrictions Validation', () => {
    it('should reject negative maxLinks', () => {
      expect(() =>
        registry.register({
          destinationKey: 'dest',
          linkRestrictions: { maxLinks: -1 },
        })
      ).toThrow(RuleConfigurationError);
    });
  });

  describe('Registry Operations', () => {
    it('should return undefined for unregistered destination lookup', () => {
      expect(registry.get('unknown-dest')).toBeUndefined();
      expect(registry.has('unknown-dest')).toBe(false);
    });

    it('should list all registered rule configs', () => {
      registry.register({ destinationKey: 'dest-1' });
      registry.register({ destinationKey: 'dest-2' });
      expect(registry.getAll()).toHaveLength(2);
    });

    it('should unregister and clear configs', () => {
      registry.register({ destinationKey: 'dest-1' });
      expect(registry.unregister('dest-1')).toBe(true);
      expect(registry.has('dest-1')).toBe(false);

      registry.register({ destinationKey: 'dest-2' });
      registry.clear();
      expect(registry.getAll()).toHaveLength(0);
    });
  });
});
