import crypto from 'crypto';
import { TrackingLinksRuleConfig } from '../types';
import { extractHostname } from './urlExtractor';

export const STANDARD_UTM_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
];

/**
 * Extracts query parameters from a URL into a plain key-value record.
 */
export function extractQueryParams(urlStr: string): Record<string, string> {
  try {
    const parsed = new URL(urlStr);
    const params: Record<string, string> = {};
    parsed.searchParams.forEach((val, key) => {
      params[key] = val;
    });
    return params;
  } catch {
    return {};
  }
}

/**
 * Determines whether a URL is considered a tracking or attribution link.
 */
export function isTrackingUrl(urlStr: string, config?: TrackingLinksRuleConfig): boolean {
  try {
    const parsed = new URL(urlStr);
    const hasUtm = STANDARD_UTM_PARAMS.some((p) => parsed.searchParams.has(p));
    if (hasUtm) return true;

    if (parsed.searchParams.has('ref') || parsed.searchParams.has('source') || parsed.searchParams.has('sig')) {
      return true;
    }

    if (config?.allowedTrackingDomains && config.allowedTrackingDomains.length > 0) {
      const hostname = parsed.hostname.toLowerCase();
      const isAllowedDomain = config.allowedTrackingDomains.some(
        (d) => hostname === d.toLowerCase() || hostname.endsWith(`.${d.toLowerCase()}`)
      );
      if (isAllowedDomain) return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Computes an HMAC-SHA256 signature for a tracking URL using a shared secret.
 * Normalizes query parameters (excluding 'sig'/'signature') to ensure deterministic signing.
 */
export function signTrackingUrl(urlStr: string, secret: string): string {
  const parsed = new URL(urlStr);
  const searchParams = new URLSearchParams(parsed.search);
  searchParams.delete('sig');
  searchParams.delete('signature');

  // Sort keys alphabetically
  const sortedKeys = Array.from(searchParams.keys()).sort();
  const canonicalQuery = sortedKeys
    .map((k) => `${k}=${searchParams.get(k)}`)
    .join('&');

  const canonicalPayload = `${parsed.origin}${parsed.pathname}?${canonicalQuery}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(canonicalPayload);
  const signature = hmac.digest('hex');

  searchParams.set('sig', signature);
  parsed.search = searchParams.toString();
  return parsed.toString();
}

/**
 * Verifies whether a tracking URL has a valid HMAC-SHA256 signature using timing-safe comparison.
 */
export function verifyTrackingSignature(urlStr: string, secret: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const providedSig = parsed.searchParams.get('sig') || parsed.searchParams.get('signature');
    if (!providedSig) {
      return false;
    }

    const expectedUrl = signTrackingUrl(urlStr, secret);
    const expectedParsed = new URL(expectedUrl);
    const expectedSig = expectedParsed.searchParams.get('sig');

    if (!expectedSig || expectedSig.length !== providedSig.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(providedSig, 'utf8'),
      Buffer.from(expectedSig, 'utf8')
    );
  } catch {
    return false;
  }
}

/**
 * Builds a compliant tracking URL with query parameters and optional cryptographic signature.
 */
export function buildTrackingUrl(
  baseUrl: string,
  params: Record<string, string | undefined>,
  signatureSecret?: string
): string {
  const parsed = new URL(baseUrl);
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null) {
      parsed.searchParams.set(key, val);
    }
  });

  const fullUrl = parsed.toString();
  if (signatureSecret) {
    return signTrackingUrl(fullUrl, signatureSecret);
  }
  return fullUrl;
}

export interface TrackingVerificationResult {
  valid: boolean;
  url: string;
  isTracking: boolean;
  violations: string[];
  details?: Record<string, unknown>;
}

/**
 * Validates a single URL against the destination's TrackingLinksRuleConfig.
 */
export function verifyTrackingUrl(
  urlStr: string,
  destinationKey: string,
  config: TrackingLinksRuleConfig
): TrackingVerificationResult {
  const violations: string[] = [];
  let parsed: URL;

  try {
    parsed = new URL(urlStr);
  } catch {
    return {
      valid: false,
      url: urlStr,
      isTracking: false,
      violations: ['Malformed URL structure.'],
    };
  }

  const isTracking = isTrackingUrl(urlStr, config);

  // If tracking links are mandatory and this link lacks tracking parameters, flag violation
  if (config.requireTrackingLinks === true && !isTracking) {
    violations.push('Link does not contain required tracking or attribution parameters.');
  }

  // 1. Require HTTPS
  if (config.requireHttps !== false && parsed.protocol !== 'https:') {
    violations.push('Tracking link must use secure HTTPS protocol.');
  }

  // 2. Disallowed tracker domains
  if (config.disallowedTrackingDomains && config.disallowedTrackingDomains.length > 0) {
    const hostname = extractHostname(urlStr);
    if (hostname) {
      const isDisallowed = config.disallowedTrackingDomains.some(
        (d) => hostname === d.toLowerCase() || hostname.endsWith(`.${d.toLowerCase()}`)
      );
      if (isDisallowed) {
        violations.push(`Tracking link points to prohibited domain (${hostname}).`);
      }
    }
  }

  // 3. Allowed tracker domains (if configured)
  if (config.allowedTrackingDomains && config.allowedTrackingDomains.length > 0 && isTracking) {
    const hostname = extractHostname(urlStr);
    if (hostname) {
      const isAllowed = config.allowedTrackingDomains.some(
        (d) => hostname === d.toLowerCase() || hostname.endsWith(`.${d.toLowerCase()}`)
      );
      if (!isAllowed) {
        violations.push(`Tracking domain '${hostname}' is not in allowed tracking domains list.`);
      }
    }
  }

  // 4. Required tracking parameters
  if (config.requiredTrackingParams && config.requiredTrackingParams.length > 0 && isTracking) {
    const missingParams = config.requiredTrackingParams.filter((p) => !parsed.searchParams.has(p));
    if (missingParams.length > 0) {
      violations.push(`Tracking link is missing required parameter(s): ${missingParams.join(', ')}.`);
    }
  }

  // 5. Disallowed tracking parameters
  if (config.disallowedTrackingParams && config.disallowedTrackingParams.length > 0) {
    const detectedDisallowed = config.disallowedTrackingParams.filter((p) => parsed.searchParams.has(p));
    if (detectedDisallowed.length > 0) {
      violations.push(`Tracking link contains prohibited parameter(s): ${detectedDisallowed.join(', ')}.`);
    }
  }

  // 6. Enforce destination utm_source
  if (config.enforceDestinationUtmSource === true && isTracking) {
    const utmSource = parsed.searchParams.get('utm_source');
    if (!utmSource || utmSource.trim().toLowerCase() !== destinationKey.trim().toLowerCase()) {
      violations.push(
        `Tracking link utm_source must match destination '${destinationKey}' (found: '${utmSource ?? 'none'}').`
      );
    }
  }

  // 7. Signature verification (if secret provided)
  if (config.signatureSecret && isTracking) {
    const validSig = verifyTrackingSignature(urlStr, config.signatureSecret);
    if (!validSig) {
      violations.push('Tracking link signature verification failed (invalid or missing ?sig=).');
    }
  }

  return {
    valid: violations.length === 0,
    url: urlStr,
    isTracking,
    violations,
    details: {
      hostname: parsed.hostname,
      searchParams: Object.fromEntries(parsed.searchParams.entries()),
    },
  };
}
