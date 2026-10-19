import { ConnectorRegistry } from '../connectors/ConnectorRegistry';
import { PublishRequest, PublishResult } from '../connectors/types';
import { PostingRulesEngine } from './PostingRulesEngine';
import { PublicationHistoryStore } from './historyStore';
import { RuleEvaluationResult } from './types';

export interface GuardedPublishResult extends PublishResult {
  decision: 'allowed' | 'blocked';
  evaluation: RuleEvaluationResult;
}

/**
 * Service that guards connector publishing by enforcing destination rules before invocation.
 * Guarantees that blocked requests never reach the underlying connector.
 */
export class GuardedPublishService {
  constructor(
    private connectorRegistry: ConnectorRegistry,
    private rulesEngine: PostingRulesEngine,
    private historyStore: PublicationHistoryStore
  ) {}

  public async publish(request: PublishRequest): Promise<GuardedPublishResult> {
    // 1. Retrieve connector to verify destination exists
    const connector = this.connectorRegistry.get(request.destinationKey);

    // 2. Evaluate posting rules before publishing (simulation does NOT bypass safety rules)
    const evaluation = await this.rulesEngine.evaluate(
      request.destinationKey,
      request.content,
      { simulate: request.simulate }
    );

    // 3. Blocked requests are immediately rejected without calling connector.publish
    if (!evaluation.allowed) {
      return {
        success: false,
        destinationKey: request.destinationKey,
        status: 'failed',
        isSimulated: Boolean(request.simulate),
        timestamp: new Date().toISOString(),
        decision: 'blocked',
        evaluation,
        error: {
          code: 'RULE_VIOLATION',
          message: `Publishing blocked by destination posting rules: ${evaluation.violations.map((v) => v.message).join('; ')}`,
          details: {
            violations: evaluation.violations,
          },
        },
      };
    }

    // 4. Content is allowed: invoke destination connector
    const publishResult = await connector.publish(request);

    // 5. If publish succeeded and was not simulated, record publication in history
    if (publishResult.success && !publishResult.isSimulated) {
      await this.historyStore.recordPublication({
        destinationKey: request.destinationKey,
        publishedAt: new Date(publishResult.timestamp),
        externalId: publishResult.externalId,
        isSimulated: false,
      });
    }

    return {
      ...publishResult,
      decision: 'allowed',
      evaluation,
    };
  }
}
