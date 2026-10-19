import { RuleId, RuleViolation, FrequencyLimitRuleConfig } from '../types';
import { PublicationHistoryStore } from '../historyStore';
import { Clock } from '../clock';

export async function evaluateFrequencyLimit(
  destinationKey: string,
  config: FrequencyLimitRuleConfig,
  historyStore: PublicationHistoryStore,
  clock: Clock
): Promise<RuleViolation[]> {
  if (config.enabled === false) {
    return [];
  }

  const violations: RuleViolation[] = [];
  const now = clock.now();

  // 1. Check window-based publication frequency limit
  const windowStart = new Date(now.getTime() - config.windowSeconds * 1000);
  const recentPublications = await historyStore.getPublicationsSince(
    destinationKey,
    windowStart
  );

  if (recentPublications.length >= config.maxPosts) {
    violations.push({
      ruleId: RuleId.FREQUENCY_LIMIT,
      message: `Frequency limit exceeded for destination '${destinationKey}': maximum of ${config.maxPosts} publication(s) allowed per ${config.windowSeconds}s window (current in window: ${recentPublications.length}).`,
      details: {
        maxPosts: config.maxPosts,
        windowSeconds: config.windowSeconds,
        currentInWindow: recentPublications.length,
        windowStart: windowStart.toISOString(),
      },
    });
  }

  // 2. Check cooldown gap between consecutive publications
  if (config.cooldownSeconds && config.cooldownSeconds > 0) {
    const lastPublication = await historyStore.getLastPublication(destinationKey);
    if (lastPublication) {
      const elapsedSeconds =
        (now.getTime() - new Date(lastPublication.publishedAt).getTime()) / 1000;

      if (elapsedSeconds < config.cooldownSeconds) {
        const remainingSeconds = Math.ceil(config.cooldownSeconds - elapsedSeconds);
        violations.push({
          ruleId: RuleId.FREQUENCY_LIMIT,
          message: `Cooldown period active for destination '${destinationKey}': must wait ${config.cooldownSeconds}s between posts (elapsed: ${Math.floor(elapsedSeconds)}s, remaining: ${remainingSeconds}s).`,
          details: {
            cooldownSeconds: config.cooldownSeconds,
            elapsedSeconds,
            remainingSeconds,
            lastPublishedAt: new Date(lastPublication.publishedAt).toISOString(),
          },
        });
      }
    }
  }

  return violations;
}
