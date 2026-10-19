import { RuleId, RuleViolation, SelfPromotionRuleConfig } from '../types';
import { ContentPayload } from '../../connectors/types';
import { extractUrls, extractHostname } from '../utils/urlExtractor';

export function evaluateSelfPromotion(
  destinationKey: string,
  content: ContentPayload,
  config: SelfPromotionRuleConfig
): RuleViolation[] {
  if (config.enabled === false) {
    return [];
  }

  const violations: RuleViolation[] = [];

  // Combine searchable textual content
  const fullText = [
    content.title,
    content.summary ?? '',
    content.body,
  ].join(' ');

  // 1. Check promotional links
  if (config.promotionalDomains && config.promotionalDomains.length > 0) {
    const urls = extractUrls(fullText);
    if (content.canonicalUrl) {
      urls.push(content.canonicalUrl);
    }

    const promoDomainsLower = config.promotionalDomains.map((d) => d.toLowerCase());
    const detectedPromoUrls: string[] = [];

    for (const urlStr of urls) {
      const hostname = extractHostname(urlStr);
      if (hostname) {
        const matchesPromo = promoDomainsLower.some(
          (d) => hostname === d || hostname.endsWith(`.${d}`)
        );
        if (matchesPromo) {
          detectedPromoUrls.push(urlStr);
        }
      }
    }

    const maxAllowed = config.maxPromotionalLinks ?? 0;
    if (detectedPromoUrls.length > maxAllowed) {
      violations.push({
        ruleId: RuleId.SELF_PROMOTION,
        message: `Self-promotion link limit exceeded for destination '${destinationKey}': found ${detectedPromoUrls.length} link(s) to promotional domains (maximum allowed: ${maxAllowed}).`,
        details: {
          promotionalLinkCount: detectedPromoUrls.length,
          maxAllowed,
          detectedLinks: detectedPromoUrls,
        },
      });
    }
  }

  // 2. Check disallowed promotional keywords
  if (config.disallowedKeywords && config.disallowedKeywords.length > 0) {
    const textLower = fullText.toLowerCase();
    const detectedKeywords: { keyword: string; occurrences: number }[] = [];
    let totalKeywordOccurrences = 0;

    for (const keyword of config.disallowedKeywords) {
      const kwLower = keyword.toLowerCase().trim();
      if (!kwLower) continue;

      let count = 0;
      let pos = 0;
      while ((pos = textLower.indexOf(kwLower, pos)) !== -1) {
        count++;
        pos += kwLower.length;
      }

      if (count > 0) {
        detectedKeywords.push({ keyword, occurrences: count });
        totalKeywordOccurrences += count;
      }
    }

    const maxOccurrences = config.maxKeywordOccurrences ?? 0;
    if (totalKeywordOccurrences > maxOccurrences) {
      violations.push({
        ruleId: RuleId.SELF_PROMOTION,
        message: `Self-promotion keyword restriction violated for destination '${destinationKey}': detected ${totalKeywordOccurrences} promotional keyword occurrence(s) (maximum allowed: ${maxOccurrences}).`,
        details: {
          totalOccurrences: totalKeywordOccurrences,
          maxAllowed: maxOccurrences,
          detectedKeywords,
        },
      });
    }
  }

  return violations;
}
