import { RuleId, RuleViolation, LinkRestrictionsRuleConfig } from '../types';
import { ContentPayload } from '../../connectors/types';
import { extractUrls, extractHostname } from '../utils/urlExtractor';

export function evaluateLinkRestrictions(
  destinationKey: string,
  content: ContentPayload,
  config: LinkRestrictionsRuleConfig
): RuleViolation[] {
  if (config.enabled === false) {
    return [];
  }

  const violations: RuleViolation[] = [];

  // Extract all URLs from body, title, summary, canonicalUrl, and mediaUrls
  const fullText = [content.title, content.summary ?? '', content.body].join(' ');
  const urls = extractUrls(fullText);

  if (content.canonicalUrl) {
    urls.push(content.canonicalUrl);
  }
  if (content.mediaUrls && content.mediaUrls.length > 0) {
    urls.push(...content.mediaUrls);
  }

  // De-duplicate URLs
  const uniqueUrls = Array.from(new Set(urls));

  // 1. Check max links limit
  if (config.maxLinks !== undefined && uniqueUrls.length > config.maxLinks) {
    violations.push({
      ruleId: RuleId.LINK_RESTRICTIONS,
      message: `Link limit exceeded for destination '${destinationKey}': content contains ${uniqueUrls.length} link(s) (maximum allowed: ${config.maxLinks}).`,
      details: {
        totalLinks: uniqueUrls.length,
        maxLinks: config.maxLinks,
        links: uniqueUrls,
      },
    });
  }

  // 2. Check requireHttps
  if (config.requireHttps === true) {
    const nonHttpsUrls = uniqueUrls.filter((url) => {
      try {
        const parsed = new URL(url);
        return parsed.protocol !== 'https:';
      } catch {
        return true;
      }
    });

    if (nonHttpsUrls.length > 0) {
      violations.push({
        ruleId: RuleId.LINK_RESTRICTIONS,
        message: `Non-HTTPS links detected for destination '${destinationKey}': all links must use HTTPS (detected ${nonHttpsUrls.length} non-HTTPS link(s)).`,
        details: {
          nonHttpsUrls,
        },
      });
    }
  }

  // 3. Check disallowed domains
  if (config.disallowedDomains && config.disallowedDomains.length > 0) {
    const disallowedLower = config.disallowedDomains.map((d) => d.toLowerCase());
    const detectedDisallowed: string[] = [];

    for (const urlStr of uniqueUrls) {
      const hostname = extractHostname(urlStr);
      if (hostname) {
        const isDisallowed = disallowedLower.some(
          (d) => hostname === d || hostname.endsWith(`.${d}`)
        );
        if (isDisallowed) {
          detectedDisallowed.push(urlStr);
        }
      }
    }

    if (detectedDisallowed.length > 0) {
      violations.push({
        ruleId: RuleId.LINK_RESTRICTIONS,
        message: `Disallowed link domain(s) detected for destination '${destinationKey}': prohibited domains (${config.disallowedDomains.join(', ')}).`,
        details: {
          disallowedDomains: config.disallowedDomains,
          detectedLinks: detectedDisallowed,
        },
      });
    }
  }

  // 4. Check allowed domains (whitelist)
  if (config.allowedDomains && config.allowedDomains.length > 0) {
    const allowedLower = config.allowedDomains.map((d) => d.toLowerCase());
    const unapprovedLinks: string[] = [];

    for (const urlStr of uniqueUrls) {
      const hostname = extractHostname(urlStr);
      if (hostname) {
        const isApproved = allowedLower.some(
          (d) => hostname === d || hostname.endsWith(`.${d}`)
        );
        if (!isApproved) {
          unapprovedLinks.push(urlStr);
        }
      }
    }

    if (unapprovedLinks.length > 0) {
      violations.push({
        ruleId: RuleId.LINK_RESTRICTIONS,
        message: `Unapproved domain link(s) detected for destination '${destinationKey}': links must belong to authorized domains (${config.allowedDomains.join(', ')}).`,
        details: {
          allowedDomains: config.allowedDomains,
          unapprovedLinks,
        },
      });
    }
  }

  return violations;
}
