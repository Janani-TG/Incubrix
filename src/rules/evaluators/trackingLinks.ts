import { RuleId, RuleViolation, TrackingLinksRuleConfig } from '../types';
import { ContentPayload } from '../../connectors/types';
import { extractUrls } from '../utils/urlExtractor';
import { verifyTrackingUrl, isTrackingUrl } from '../utils/trackingLinks';

/**
 * Evaluates whether all links in the content comply with destination verified tracking link policies.
 */
export function evaluateTrackingLinks(
  destinationKey: string,
  content: ContentPayload,
  config: TrackingLinksRuleConfig
): RuleViolation[] {
  if (config.enabled === false) {
    return [];
  }

  const fullText = [content.title, content.summary ?? '', content.body].join(' ');
  const urls = extractUrls(fullText);

  if (content.canonicalUrl) {
    urls.push(content.canonicalUrl);
  }
  if (content.mediaUrls && content.mediaUrls.length > 0) {
    urls.push(...content.mediaUrls);
  }

  const uniqueUrls = Array.from(new Set(urls));
  const violations: RuleViolation[] = [];

  for (const urlStr of uniqueUrls) {
    // If requireTrackingLinks is false and URL is not a tracking link, skip verification
    if (config.requireTrackingLinks !== true && !isTrackingUrl(urlStr, config)) {
      continue;
    }

    const verification = verifyTrackingUrl(urlStr, destinationKey, config);
    if (!verification.valid) {
      for (const reason of verification.violations) {
        violations.push({
          ruleId: RuleId.TRACKING_LINKS,
          message: `Unverified tracking link for destination '${destinationKey}': ${reason}`,
          details: {
            url: urlStr,
            destinationKey,
            reason,
            ...verification.details,
          },
        });
      }
    }
  }

  return violations;
}
