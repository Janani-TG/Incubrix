import { ContentPayload } from '../connectors/types';

/**
 * Stable rule identifiers.
 */
export const RuleId = {
  FREQUENCY_LIMIT: 'RULE_FREQUENCY_LIMIT',
  SELF_PROMOTION: 'RULE_SELF_PROMOTION',
  LINK_RESTRICTIONS: 'RULE_LINK_RESTRICTIONS',
  AI_DISCLOSURE: 'RULE_AI_DISCLOSURE',
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
 * Aggregate destination posting rules configuration.
 */
export interface DestinationRulesConfig {
  destinationKey: string;
  frequencyLimit?: FrequencyLimitRuleConfig;
  selfPromotion?: SelfPromotionRuleConfig;
  linkRestrictions?: LinkRestrictionsRuleConfig;
  aiDisclosure?: AiDisclosureRuleConfig;
}

/**
 * Evaluation context passed to individual rule evaluators.
 */
export interface RuleEvaluationContext {
  destinationKey: string;
  content: ContentPayload;
  simulate?: boolean;
}
