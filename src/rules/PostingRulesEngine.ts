import { Clock, SystemClock } from './clock';
import { PublicationHistoryStore } from './historyStore';
import { DestinationRulesRegistry } from './DestinationRulesRegistry';
import { ContentPayload } from '../connectors/types';
import { RuleEvaluationResult, RuleViolation } from './types';
import { evaluateFrequencyLimit } from './evaluators/frequencyLimit';
import { evaluateSelfPromotion } from './evaluators/selfPromotion';
import { evaluateLinkRestrictions } from './evaluators/linkRestrictions';
import { evaluateAiDisclosure } from './evaluators/aiDisclosure';

export interface EvaluateOptions {
  simulate?: boolean;
}

/**
 * Modular posting-rules engine that evaluates content against destination-specific rules.
 */
export class PostingRulesEngine {
  constructor(
    private registry: DestinationRulesRegistry,
    private historyStore: PublicationHistoryStore,
    private clock: Clock = new SystemClock()
  ) {}

  /**
   * Evaluate content against all active posting rules for the specified destination.
   * Collects all violations without stopping at the first failure.
   */
  public async evaluate(
    destinationKey: string,
    content: ContentPayload,
    options: EvaluateOptions = {}
  ): Promise<RuleEvaluationResult> {
    const evaluatedAt = this.clock.now().toISOString();
    const config = this.registry.get(destinationKey);

    // If destination has no explicit rules configured, allow with clear metadata
    if (!config) {
      return {
        decision: 'allowed',
        allowed: true,
        destinationKey,
        violations: [],
        evaluatedAt,
        metadata: {
          configured: false,
          note: `No posting rules configured for destination '${destinationKey}'; default allow.`,
          simulated: Boolean(options.simulate),
        },
      };
    }

    const violations: RuleViolation[] = [];

    // 1. Evaluate frequency limits (window & cooldown)
    if (config.frequencyLimit) {
      const freqViolations = await evaluateFrequencyLimit(
        destinationKey,
        config.frequencyLimit,
        this.historyStore,
        this.clock
      );
      violations.push(...freqViolations);
    }

    // 2. Evaluate self-promotion restrictions
    if (config.selfPromotion) {
      const promoViolations = evaluateSelfPromotion(
        destinationKey,
        content,
        config.selfPromotion
      );
      violations.push(...promoViolations);
    }

    // 3. Evaluate link restrictions
    if (config.linkRestrictions) {
      const linkViolations = evaluateLinkRestrictions(
        destinationKey,
        content,
        config.linkRestrictions
      );
      violations.push(...linkViolations);
    }

    // 4. Evaluate AI disclosure requirements
    if (config.aiDisclosure) {
      const aiViolations = evaluateAiDisclosure(
        destinationKey,
        content,
        config.aiDisclosure
      );
      violations.push(...aiViolations);
    }

    const allowed = violations.length === 0;

    return {
      decision: allowed ? 'allowed' : 'blocked',
      allowed,
      destinationKey,
      violations,
      evaluatedAt,
      metadata: {
        configured: true,
        simulated: Boolean(options.simulate),
        violationCount: violations.length,
      },
    };
  }
}
