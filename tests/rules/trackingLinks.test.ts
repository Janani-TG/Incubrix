import { describe, it, expect } from 'vitest';
import {
  evaluateTrackingLinks,
  isTrackingUrl,
  buildTrackingUrl,
  signTrackingUrl,
  verifyTrackingSignature,
  verifyTrackingUrl,
  RuleId,
} from '../../src/rules';
import { ContentPayload } from '../../src/connectors/types';

describe('Verified Tracking Links Rule & Utilities', () => {
  const sampleContent: ContentPayload = {
    title: 'Modern Software Engineering',
    summary: 'A deep dive into distributed systems',
    body: 'Check out our project at [IncuBrix](https://incubrix.io?utm_source=devto&utm_medium=syndication&utm_campaign=launch).',
  };

  describe('Utility Functions', () => {
    it('should correctly identify tracking URLs', () => {
      expect(isTrackingUrl('https://example.com?utm_source=devto')).toBe(true);
      expect(isTrackingUrl('https://example.com?ref=newsletter')).toBe(true);
      expect(isTrackingUrl('https://example.com/blog/article-1')).toBe(false);
    });

    it('should build tracking URLs with UTM parameters', () => {
      const built = buildTrackingUrl('https://incubrix.io/docs', {
        utm_source: 'devto',
        utm_medium: 'syndication',
        utm_campaign: 'spring_2026',
      });

      const parsed = new URL(built);
      expect(parsed.searchParams.get('utm_source')).toBe('devto');
      expect(parsed.searchParams.get('utm_medium')).toBe('syndication');
      expect(parsed.searchParams.get('utm_campaign')).toBe('spring_2026');
    });

    it('should sign and verify tracking URLs using HMAC-SHA256', () => {
      const secret = 'test-tracking-secret-key-12345';
      const unsignedUrl = 'https://incubrix.io/docs?utm_source=devto&utm_medium=syndication';
      const signedUrl = signTrackingUrl(unsignedUrl, secret);

      expect(signedUrl).toContain('sig=');
      expect(verifyTrackingSignature(signedUrl, secret)).toBe(true);

      // Tampering test: alter query param
      const tamperedUrl = signedUrl.replace('utm_source=devto', 'utm_source=ghost');
      expect(verifyTrackingSignature(tamperedUrl, secret)).toBe(false);

      // Invalid signature test
      expect(verifyTrackingSignature(unsignedUrl, secret)).toBe(false);
    });
  });

  describe('Rule Evaluation: evaluateTrackingLinks', () => {
    it('should pass content when tracking links comply with all destination policies', () => {
      const violations = evaluateTrackingLinks('devto', sampleContent, {
        enabled: true,
        requireHttps: true,
        allowedTrackingDomains: ['incubrix.io'],
        requiredTrackingParams: ['utm_source', 'utm_medium'],
        enforceDestinationUtmSource: true,
      });

      expect(violations).toHaveLength(0);
    });

    it('should block non-HTTPS tracking links when requireHttps is enabled', () => {
      const contentWithHttp: ContentPayload = {
        title: 'Title',
        body: 'Link: http://incubrix.io?utm_source=devto&utm_medium=syndication',
      };

      const violations = evaluateTrackingLinks('devto', contentWithHttp, {
        enabled: true,
        requireHttps: true,
      });

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].ruleId).toBe(RuleId.TRACKING_LINKS);
      expect(violations[0].message).toContain('HTTPS');
    });

    it('should block tracking links from unapproved domains when allowedTrackingDomains is set', () => {
      const contentWithUnapprovedDomain: ContentPayload = {
        title: 'Title',
        body: 'Visit [External Tracker](https://suspicious-analytics.com?utm_source=devto&utm_medium=syndication)',
      };

      const violations = evaluateTrackingLinks('devto', contentWithUnapprovedDomain, {
        enabled: true,
        allowedTrackingDomains: ['incubrix.io'],
      });

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].ruleId).toBe(RuleId.TRACKING_LINKS);
      expect(violations[0].message).toContain('not in allowed tracking domains list');
    });

    it('should block prohibited tracking domains (e.g. link shorteners)', () => {
      const contentWithShortener: ContentPayload = {
        title: 'Title',
        body: 'Click here: https://bit.ly/3xyz123?utm_source=devto',
      };

      const violations = evaluateTrackingLinks('devto', contentWithShortener, {
        enabled: true,
        disallowedTrackingDomains: ['bit.ly', 'tinyurl.com'],
      });

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].ruleId).toBe(RuleId.TRACKING_LINKS);
      expect(violations[0].message).toContain('prohibited domain');
    });

    it('should block tracking links missing required parameters', () => {
      const contentMissingParams: ContentPayload = {
        title: 'Title',
        body: 'Click here: https://incubrix.io?utm_source=devto',
      };

      const violations = evaluateTrackingLinks('devto', contentMissingParams, {
        enabled: true,
        requiredTrackingParams: ['utm_source', 'utm_medium', 'utm_campaign'],
      });

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].ruleId).toBe(RuleId.TRACKING_LINKS);
      expect(violations[0].message).toContain('missing required parameter');
    });

    it('should block tracking links containing prohibited parameters', () => {
      const contentWithProhibitedParams: ContentPayload = {
        title: 'Title',
        body: 'Click here: https://incubrix.io?utm_source=devto&affiliate_id=9999',
      };

      const violations = evaluateTrackingLinks('devto', contentWithProhibitedParams, {
        enabled: true,
        disallowedTrackingParams: ['affiliate_id', 'payout_token'],
      });

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].ruleId).toBe(RuleId.TRACKING_LINKS);
      expect(violations[0].message).toContain('prohibited parameter');
    });

    it('should enforce utm_source matching the destinationKey when configured', () => {
      const contentWrongSource: ContentPayload = {
        title: 'Title',
        body: 'Click here: https://incubrix.io?utm_source=ghost&utm_medium=syndication',
      };

      const violations = evaluateTrackingLinks('devto', contentWrongSource, {
        enabled: true,
        enforceDestinationUtmSource: true,
      });

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].ruleId).toBe(RuleId.TRACKING_LINKS);
      expect(violations[0].message).toContain("utm_source must match destination 'devto'");
    });

    it('should block plain external links if requireTrackingLinks is mandatory', () => {
      const contentPlainLink: ContentPayload = {
        title: 'Title',
        body: 'Visit our site at https://incubrix.io/docs without tracking.',
      };

      const violations = evaluateTrackingLinks('devto', contentPlainLink, {
        enabled: true,
        requireTrackingLinks: true,
      });

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].ruleId).toBe(RuleId.TRACKING_LINKS);
      expect(violations[0].message).toContain('required tracking or attribution parameters');
    });

    it('should verify cryptographic signature when signatureSecret is configured', () => {
      const secret = 'my-secret-key';
      const validSignedUrl = buildTrackingUrl(
        'https://incubrix.io/download',
        { utm_source: 'devto', utm_medium: 'syndication' },
        secret
      );

      const contentValidSigned: ContentPayload = {
        title: 'Title',
        body: `Get it here: ${validSignedUrl}`,
      };

      const passViolations = evaluateTrackingLinks('devto', contentValidSigned, {
        enabled: true,
        signatureSecret: secret,
      });
      expect(passViolations).toHaveLength(0);

      // Unsigned URL should fail signature verification
      const contentUnsigned: ContentPayload = {
        title: 'Title',
        body: 'Get it here: https://incubrix.io/download?utm_source=devto&utm_medium=syndication',
      };

      const failViolations = evaluateTrackingLinks('devto', contentUnsigned, {
        enabled: true,
        signatureSecret: secret,
      });
      expect(failViolations.length).toBeGreaterThan(0);
      expect(failViolations[0].ruleId).toBe(RuleId.TRACKING_LINKS);
      expect(failViolations[0].message).toContain('signature verification failed');
    });
  });
});
