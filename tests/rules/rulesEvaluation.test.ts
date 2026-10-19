import { describe, it, expect, beforeEach } from 'vitest';
import { DestinationRulesRegistry } from '../../src/rules/DestinationRulesRegistry';
import { PostingRulesEngine } from '../../src/rules/PostingRulesEngine';
import { InMemoryPublicationHistoryStore } from '../../src/rules/historyStore';
import { ControllableClock } from '../../src/rules/clock';
import { RuleId } from '../../src/rules/types';
import { ContentPayload } from '../../src/connectors/types';

describe('PostingRulesEngine Rule Evaluation', () => {
  let registry: DestinationRulesRegistry;
  let historyStore: InMemoryPublicationHistoryStore;
  let clock: ControllableClock;
  let engine: PostingRulesEngine;

  const validCleanContent: ContentPayload = {
    title: 'Clean Engineering Post',
    body: 'This is a clean engineering post discussing architectural patterns. See https://docs.example.com for reference.',
    summary: 'Brief architectural summary.',
    tags: ['engineering', 'typescript'],
  };

  beforeEach(() => {
    registry = new DestinationRulesRegistry();
    historyStore = new InMemoryPublicationHistoryStore();
    clock = new ControllableClock(new Date('2026-06-01T10:00:00.000Z'));
    engine = new PostingRulesEngine(registry, historyStore, clock);
  });

  describe('Allowed Content and Default Behavior', () => {
    it('should allow content when no rules are configured for destination', async () => {
      const result = await engine.evaluate('unconfigured-dest', validCleanContent);

      expect(result.decision).toBe('allowed');
      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.metadata?.configured).toBe(false);
    });

    it('should allow content that complies with all destination rules', async () => {
      registry.register({
        destinationKey: 'strict-dest',
        frequencyLimit: { maxPosts: 5, windowSeconds: 3600 },
        selfPromotion: { maxPromotionalLinks: 1, promotionalDomains: ['promo.com'] },
        linkRestrictions: { maxLinks: 3, requireHttps: true },
        aiDisclosure: { requireIfAiGenerated: true, requiredTag: 'ai' },
      });

      const result = await engine.evaluate('strict-dest', validCleanContent);

      expect(result.decision).toBe('allowed');
      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('Frequency Limit Boundaries and Cooldown', () => {
    it('should block content when maxPosts per window is exceeded, and allow once window passes', async () => {
      registry.register({
        destinationKey: 'freq-dest',
        frequencyLimit: { maxPosts: 2, windowSeconds: 3600 }, // 2 posts per hour
      });

      // Initially no posts in history: 1st evaluation allowed
      const eval1 = await engine.evaluate('freq-dest', validCleanContent);
      expect(eval1.allowed).toBe(true);

      // Record first post at 10:00:00
      historyStore.recordPublication({
        destinationKey: 'freq-dest',
        publishedAt: clock.now(),
        externalId: 'post-1',
      });

      // Advance 10 minutes (10:10:00)
      clock.advanceSeconds(600);
      const eval2 = await engine.evaluate('freq-dest', validCleanContent);
      expect(eval2.allowed).toBe(true);

      // Record second post at 10:10:00
      historyStore.recordPublication({
        destinationKey: 'freq-dest',
        publishedAt: clock.now(),
        externalId: 'post-2',
      });

      // Advance 5 minutes (10:15:00) - now 2 posts within window
      clock.advanceSeconds(300);
      const eval3 = await engine.evaluate('freq-dest', validCleanContent);
      expect(eval3.decision).toBe('blocked');
      expect(eval3.allowed).toBe(false);
      expect(eval3.violations).toHaveLength(1);
      expect(eval3.violations[0]?.ruleId).toBe(RuleId.FREQUENCY_LIMIT);
      expect(eval3.violations[0]?.message).toContain('maximum of 2 publication(s) allowed');

      // Advance clock past the 1-hour window from post-1 (10:00:00 + 3601s = 11:00:01)
      // Now post-1 is outside the 3600s window! Only post-2 remains in window.
      clock.setTime(new Date('2026-06-01T11:00:05.000Z'));
      const eval4 = await engine.evaluate('freq-dest', validCleanContent);
      expect(eval4.decision).toBe('allowed');
      expect(eval4.allowed).toBe(true);
    });

    it('should enforce minimum cooldown gap between consecutive posts', async () => {
      registry.register({
        destinationKey: 'cooldown-dest',
        frequencyLimit: { maxPosts: 10, windowSeconds: 3600, cooldownSeconds: 60 },
      });

      // Record a post at 10:00:00
      historyStore.recordPublication({
        destinationKey: 'cooldown-dest',
        publishedAt: clock.now(),
        externalId: 'post-prev',
      });

      // Advance only 20 seconds (cooldown is 60s)
      clock.advanceSeconds(20);
      const evalBlocked = await engine.evaluate('cooldown-dest', validCleanContent);
      expect(evalBlocked.decision).toBe('blocked');
      expect(evalBlocked.violations[0]?.ruleId).toBe(RuleId.FREQUENCY_LIMIT);
      expect(evalBlocked.violations[0]?.message).toContain('Cooldown period active');

      // Advance remaining 45 seconds (elapsed = 65s > 60s)
      clock.advanceSeconds(45);
      const evalAllowed = await engine.evaluate('cooldown-dest', validCleanContent);
      expect(evalAllowed.decision).toBe('allowed');
    });
  });

  describe('Self-Promotion Restrictions', () => {
    it('should block content exceeding promotional links limit', async () => {
      registry.register({
        destinationKey: 'promo-dest',
        selfPromotion: {
          maxPromotionalLinks: 1,
          promotionalDomains: ['myshop.com', 'affiliate.org'],
        },
      });

      const promoContent: ContentPayload = {
        title: 'Check out our products',
        body: 'Visit [Product A](https://myshop.com/a) and also [Product B](https://myshop.com/b)!',
      };

      const result = await engine.evaluate('promo-dest', promoContent);
      expect(result.decision).toBe('blocked');
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]?.ruleId).toBe(RuleId.SELF_PROMOTION);
      expect(result.violations[0]?.message).toContain('Self-promotion link limit exceeded');
    });

    it('should block content containing prohibited promotional keywords', async () => {
      registry.register({
        destinationKey: 'kw-dest',
        selfPromotion: {
          disallowedKeywords: ['buy now', 'discount code', 'limited time offer'],
          maxKeywordOccurrences: 0,
        },
      });

      const spammyContent: ContentPayload = {
        title: 'Exclusive Announcement',
        body: 'Click here and use DISCOUNT CODE SAVE50 to buy now!',
      };

      const result = await engine.evaluate('kw-dest', spammyContent);
      expect(result.decision).toBe('blocked');
      expect(result.violations[0]?.ruleId).toBe(RuleId.SELF_PROMOTION);
      expect(result.violations[0]?.message).toContain('Self-promotion keyword restriction violated');
    });
  });

  describe('Link Restrictions', () => {
    it('should block content with too many links', async () => {
      registry.register({
        destinationKey: 'links-dest',
        linkRestrictions: { maxLinks: 2 },
      });

      const multiLinkContent: ContentPayload = {
        title: 'Link Heavy Post',
        body: 'Link 1: https://a.com, Link 2: https://b.com, Link 3: https://c.com',
      };

      const result = await engine.evaluate('links-dest', multiLinkContent);
      expect(result.decision).toBe('blocked');
      expect(result.violations[0]?.ruleId).toBe(RuleId.LINK_RESTRICTIONS);
      expect(result.violations[0]?.message).toContain('Link limit exceeded');
    });

    it('should block insecure non-HTTPS links when requireHttps is enabled', async () => {
      registry.register({
        destinationKey: 'https-dest',
        linkRestrictions: { requireHttps: true },
      });

      const insecureContent: ContentPayload = {
        title: 'Insecure Link Post',
        body: 'Check out http://insecure-domain.org/resource for details.',
      };

      const result = await engine.evaluate('https-dest', insecureContent);
      expect(result.decision).toBe('blocked');
      expect(result.violations[0]?.ruleId).toBe(RuleId.LINK_RESTRICTIONS);
      expect(result.violations[0]?.message).toContain('Non-HTTPS links detected');
    });

    it('should block disallowed domain links (e.g. link shorteners)', async () => {
      registry.register({
        destinationKey: 'domain-dest',
        linkRestrictions: { disallowedDomains: ['bit.ly', 'tinyurl.com'] },
      });

      const shortenerContent: ContentPayload = {
        title: 'Short Link Post',
        body: 'Find the download here: https://bit.ly/xyz123',
      };

      const result = await engine.evaluate('domain-dest', shortenerContent);
      expect(result.decision).toBe('blocked');
      expect(result.violations[0]?.ruleId).toBe(RuleId.LINK_RESTRICTIONS);
      expect(result.violations[0]?.message).toContain('Disallowed link domain(s) detected');
    });
  });

  describe('AI Disclosure Requirements', () => {
    it('should block AI-generated content lacking mandatory disclosure', async () => {
      registry.register({
        destinationKey: 'ai-dest',
        aiDisclosure: {
          requireIfAiGenerated: true,
          disclaimerPhrases: ['generated with ai', 'ai disclosure'],
          requiredTag: 'ai-generated',
        },
      });

      const aiContentWithoutDisclosure: ContentPayload = {
        title: 'Modern Architecture Summary',
        body: 'Here is an article about clean code and architecture.',
        metadata: { aiGenerated: true },
      };

      const result = await engine.evaluate('ai-dest', aiContentWithoutDisclosure);
      expect(result.decision).toBe('blocked');
      expect(result.violations[0]?.ruleId).toBe(RuleId.AI_DISCLOSURE);
      expect(result.violations[0]?.message).toContain('AI disclosure missing');
    });

    it('should allow AI-generated content when disclosure disclaimer is present in body', async () => {
      registry.register({
        destinationKey: 'ai-dest',
        aiDisclosure: {
          requireIfAiGenerated: true,
          disclaimerPhrases: ['generated with ai'],
        },
      });

      const aiContentWithDisclaimer: ContentPayload = {
        title: 'Modern Architecture Summary',
        body: 'This article was generated with AI assistance. Here is the architectural guide.',
        metadata: { aiGenerated: true },
      };

      const result = await engine.evaluate('ai-dest', aiContentWithDisclaimer);
      expect(result.decision).toBe('allowed');
      expect(result.violations).toHaveLength(0);
    });

    it('should allow AI-generated content when required disclosure tag is present', async () => {
      registry.register({
        destinationKey: 'ai-dest',
        aiDisclosure: {
          requireIfAiGenerated: true,
          requiredTag: 'ai-assisted',
        },
      });

      const aiContentWithTag: ContentPayload = {
        title: 'Modern Architecture Summary',
        body: 'Here is an article about clean code.',
        tags: ['technology', 'ai-assisted'],
        metadata: { isAiGenerated: true },
      };

      const result = await engine.evaluate('ai-dest', aiContentWithTag);
      expect(result.decision).toBe('allowed');
      expect(result.violations).toHaveLength(0);
    });

    it('should allow non-AI content when requireIfAiGenerated is true', async () => {
      registry.register({
        destinationKey: 'ai-dest',
        aiDisclosure: { requireIfAiGenerated: true },
      });

      const humanContent: ContentPayload = {
        title: 'Handcrafted Post',
        body: 'Written entirely by hand without AI.',
      };

      const result = await engine.evaluate('ai-dest', humanContent);
      expect(result.decision).toBe('allowed');
    });
  });

  describe('Multiple Simultaneous Violations', () => {
    it('should gather all violations simultaneously when content violates multiple rules', async () => {
      registry.register({
        destinationKey: 'multi-rule-dest',
        frequencyLimit: { maxPosts: 1, windowSeconds: 3600 },
        selfPromotion: { disallowedKeywords: ['buy now'] },
        linkRestrictions: { maxLinks: 1, requireHttps: true },
        aiDisclosure: { requireIfAiGenerated: true, requiredTag: 'ai' },
      });

      // Record an existing post to trigger frequency limit
      historyStore.recordPublication({
        destinationKey: 'multi-rule-dest',
        publishedAt: clock.now(),
      });

      // Craft content that simultaneously violates:
      // 1. Frequency limit (already 1 post in window)
      // 2. Self-promotion keyword ("buy now")
      // 3. Link restrictions (2 links, one of which is http://)
      // 4. AI disclosure (aiGenerated: true without tag or phrase)
      const multiViolatingContent: ContentPayload = {
        title: 'Violates All Rules',
        body: 'Click here to buy now! http://insecure.org and https://extra.com',
        metadata: { aiGenerated: true },
      };

      const result = await engine.evaluate('multi-rule-dest', multiViolatingContent);

      expect(result.decision).toBe('blocked');
      expect(result.allowed).toBe(false);

      // Verify that all four rule categories are represented in the violations
      const ruleIds = result.violations.map((v) => v.ruleId);
      expect(ruleIds).toContain(RuleId.FREQUENCY_LIMIT);
      expect(ruleIds).toContain(RuleId.SELF_PROMOTION);
      expect(ruleIds).toContain(RuleId.LINK_RESTRICTIONS);
      expect(ruleIds).toContain(RuleId.AI_DISCLOSURE);
      expect(result.violations.length).toBeGreaterThanOrEqual(4);
    });
  });
});
