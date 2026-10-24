import { ContentPayload } from '../connectors/types';

/**
 * Stable rule identifiers.
 */
export const RuleId = {
  FREQUENCY_LIMIT: 'RULE_FREQUENCY_LIMIT',
  SELF_PROMOTION: 'RULE_SELF_PROMOTION',
  LINK_RESTRICTIONS: 'RULE_LINK_RESTRICTIONS',
  AI_DISCLOSURE: 'RULE_AI_DISCLOSURE',
  TRACKING_LINKS: 'RULE_TRACKING_LINKS',
  PUBLISHING_SLOTS: 'RULE_PUBLISHING_SLOTS',
} as const;

export type RuleIdType = typeof RuleId[keyof typeof RuleId];

/**
 * Structured detail of a single rule violation.
 */
export interface RuleViolation {
  ruleId: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Evaluation decision outcome.
 */
export type RuleDecision = 'allowed' | 'blocked';

/**
 * Complete structured result of evaluating content against destination rules.
 */
export interface RuleEvaluationResult {
  decision: RuleDecision;
  allowed: boolean;
  destinationKey: string;
  violations: RuleViolation[];
  evaluatedAt: string;
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for publishing frequency and cooldown limits.
 */
export interface FrequencyLimitRuleConfig {
  enabled?: boolean;
  maxPosts: number;
  windowSeconds: number;
  cooldownSeconds?: number;
}

/**
 * Configuration for self-promotion link and keyword restrictions.
 */
export interface SelfPromotionRuleConfig {
  enabled?: boolean;
  maxPromotionalLinks?: number;
  promotionalDomains?: string[];
  disallowedKeywords?: string[];
  maxKeywordOccurrences?: number;
}

/**
 * Configuration for link quantity, protocol, and domain restrictions.
 */
export interface LinkRestrictionsRuleConfig {
  enabled?: boolean;
  maxLinks?: number;
  requireHttps?: boolean;
  disallowedDomains?: string[];
  allowedDomains?: string[];
}

/**
 * Configuration for AI-generated content disclosure requirements.
 */
export interface AiDisclosureRuleConfig {
  enabled?: boolean;
  required?: boolean;
  requireIfAiGenerated?: boolean;
  disclaimerPhrases?: string[];
  requiredTag?: string;
}

/**
 * Configuration for verified tracking links.
 */
export interface TrackingLinksRuleConfig {
  enabled?: boolean;
  /**
   * If true, all external links in the content must be verified tracking links.
   */
  requireTrackingLinks?: boolean;
  /**
   * Allowed domains for tracking/attribution links.
   */
  allowedTrackingDomains?: string[];
  /**
   * Prohibited tracker/shortener domains.
   */
  disallowedTrackingDomains?: string[];
  /**
   * Required query parameters on tracking links (e.g. ['utm_source', 'utm_medium']).
   */
  requiredTrackingParams?: string[];
  /**
   * Prohibited query parameters (e.g. ['affiliate_id', 'payout_token']).
   */
  disallowedTrackingParams?: string[];
  /**
   * If true, the `utm_source` query parameter must match the destinationKey (case-insensitive).
   */
  enforceDestinationUtmSource?: boolean;
  /**
   * If true, tracking links must use HTTPS. Defaults to true.
   */
  requireHttps?: boolean;
  /**
   * Optional secret for verifying cryptographically signed tracking links (?sig=...).
   */
  signatureSecret?: string;
}

/**
 * Definition of a single publishing slot.
 */
export interface PublishingSlot {
  id?: string;
  name?: string;
  /**
   * Slot start time in 24-hour format: "HH:mm" (e.g. "09:00").
   */
  start: string;
  /**
   * Slot end time in 24-hour format: "HH:mm" (e.g. "17:00").
   */
  end: string;
  /**
   * Days of week this slot is active (0 = Sunday, 1 = Monday, ..., 6 = Saturday).
   * If omitted, slot applies to all days.
   */
  daysOfWeek?: number[];
  /**
   * Maximum allowed publications during this single slot.
   */
  maxPostsPerSlot?: number;
}

/**
 * Configuration for destination publishing slots / scheduling windows.
 */
export interface PublishingSlotsRuleConfig {
  enabled?: boolean;
  slots: PublishingSlot[];
  /**
   * Timezone for evaluating slot times (defaults to 'UTC').
   */
  timezone?: string;
}

/**
 * Aggregate destination posting rules configuration.
 */
export interface DestinationRulesConfig {
  destinationKey: string;
  frequencyLimit?: FrequencyLimitRuleConfig;
  selfPromotion?: SelfPromotionRuleConfig;
  linkRestrictions?: LinkRestrictionsRuleConfig;
  aiDisclosure?: AiDisclosureRuleConfig;
  trackingLinks?: TrackingLinksRuleConfig;
  publishingSlots?: PublishingSlotsRuleConfig;
}

/**
 * Evaluation context passed to individual rule evaluators.
 */
export interface RuleEvaluationContext {
  destinationKey: string;
  content: ContentPayload;
  simulate?: boolean;
}
