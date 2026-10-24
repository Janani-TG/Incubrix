import { Router, Request, Response } from 'express';
import { DestinationRulesRegistry } from '../../rules/DestinationRulesRegistry';
import { verifyTrackingUrl, buildTrackingUrl } from '../../rules/utils/trackingLinks';
import { TrackingLinksRuleConfig } from '../../rules/types';

export function createTrackingRouter(rulesRegistry: DestinationRulesRegistry): Router {
  const router = Router();

  /**
   * POST /api/v1/tracking/verify
   * Verify an arbitrary tracking link against destination rules or custom rule configuration.
   */
  router.post('/verify', (req: Request, res: Response) => {
    const { url, destinationKey, config: customConfig } = req.body;

    if (!url || typeof url !== 'string') {
      res.status(400).json({
        error: 'ValidationError',
        message: "Missing or invalid 'url' string parameter.",
        statusCode: 400,
      });
      return;
    }

    const destKey = typeof destinationKey === 'string' ? destinationKey.trim() : 'default';
    const destinationRules = rulesRegistry.get(destKey);
    const trackingConfig: TrackingLinksRuleConfig = customConfig || destinationRules?.trackingLinks || {
      enabled: true,
      requireHttps: true,
    };

    const result = verifyTrackingUrl(url, destKey, trackingConfig);

    res.status(200).json({
      valid: result.valid,
      url: result.url,
      isTracking: result.isTracking,
      destinationKey: destKey,
      violations: result.violations,
      details: result.details,
    });
  });

  /**
   * POST /api/v1/tracking/generate
   * Helper to build a compliant verified tracking link with standard UTM parameters and optional cryptographic signature.
   */
  router.post('/generate', (req: Request, res: Response) => {
    const { baseUrl, destinationKey, utmMedium, utmCampaign, utmTerm, utmContent, customParams, sign } = req.body;

    if (!baseUrl || typeof baseUrl !== 'string') {
      res.status(400).json({
        error: 'ValidationError',
        message: "Missing or invalid 'baseUrl' string parameter.",
        statusCode: 400,
      });
      return;
    }

    try {
      new URL(baseUrl);
    } catch {
      res.status(400).json({
        error: 'ValidationError',
        message: `Malformed 'baseUrl': '${baseUrl}'. Must be a valid absolute URL.`,
        statusCode: 400,
      });
      return;
    }

    const destKey = typeof destinationKey === 'string' && destinationKey.trim() ? destinationKey.trim() : 'syndication';
    const destinationRules = rulesRegistry.get(destKey);
    const trackingConfig = destinationRules?.trackingLinks;

    const params: Record<string, string | undefined> = {
      utm_source: destKey,
      utm_medium: utmMedium || 'syndication',
      utm_campaign: utmCampaign || 'incubrix_distribution',
      utm_term: utmTerm,
      utm_content: utmContent,
      ...customParams,
    };

    const signatureSecret = sign === true ? (trackingConfig?.signatureSecret || 'default_incubrix_tracking_secret') : undefined;
    const trackingUrl = buildTrackingUrl(baseUrl, params, signatureSecret);

    res.status(200).json({
      trackingUrl,
      baseUrl,
      destinationKey: destKey,
      isSigned: Boolean(signatureSecret),
      parameters: params,
    });
  });

  return router;
}
