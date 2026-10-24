import { AppError } from '../errors/AppError';
import { DestinationRulesConfig } from './types';

/**
 * Error thrown when a destination rule configuration is malformed or invalid.
 */
export class RuleConfigurationError extends AppError {
  public readonly destinationKey?: string;
  public readonly field?: string;

  constructor(message: string, destinationKey?: string, field?: string) {
    super(message, 400);
    this.name = 'RuleConfigurationError';
    this.destinationKey = destinationKey;
    this.field = field;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Validates a DestinationRulesConfig object to ensure all settings are sound and safe.
 */
export function validateDestinationRulesConfig(
  config: DestinationRulesConfig
): void {
  if (!config) {
    throw new RuleConfigurationError('Destination rule configuration cannot be null or undefined.');
  }

  if (!config.destinationKey || typeof config.destinationKey !== 'string' || !config.destinationKey.trim()) {
    throw new RuleConfigurationError(
      'destinationKey must be a non-empty string in rule configuration.',
      config.destinationKey,
      'destinationKey'
    );
  }

  const destKey = config.destinationKey.trim();

  // Validate frequencyLimit
  if (config.frequencyLimit) {
    const { maxPosts, windowSeconds, cooldownSeconds } = config.frequencyLimit;

    if (typeof maxPosts !== 'number' || maxPosts <= 0 || !Number.isInteger(maxPosts)) {
      throw new RuleConfigurationError(
        `Invalid frequencyLimit: maxPosts must be a positive integer, received: ${maxPosts}`,
        destKey,
        'frequencyLimit.maxPosts'
      );
    }

    if (typeof windowSeconds !== 'number' || windowSeconds <= 0) {
      throw new RuleConfigurationError(
        `Invalid frequencyLimit: windowSeconds must be a positive number, received: ${windowSeconds}`,
        destKey,
        'frequencyLimit.windowSeconds'
      );
    }

    if (cooldownSeconds !== undefined && (typeof cooldownSeconds !== 'number' || cooldownSeconds < 0)) {
      throw new RuleConfigurationError(
        `Invalid frequencyLimit: cooldownSeconds must be a non-negative number, received: ${cooldownSeconds}`,
        destKey,
        'frequencyLimit.cooldownSeconds'
      );
    }
  }

  // Validate selfPromotion
  if (config.selfPromotion) {
    const { maxPromotionalLinks, maxKeywordOccurrences } = config.selfPromotion;

    if (
      maxPromotionalLinks !== undefined &&
      (typeof maxPromotionalLinks !== 'number' || maxPromotionalLinks < 0 || !Number.isInteger(maxPromotionalLinks))
    ) {
      throw new RuleConfigurationError(
        `Invalid selfPromotion: maxPromotionalLinks must be a non-negative integer, received: ${maxPromotionalLinks}`,
        destKey,
        'selfPromotion.maxPromotionalLinks'
      );
    }

    if (
      maxKeywordOccurrences !== undefined &&
      (typeof maxKeywordOccurrences !== 'number' || maxKeywordOccurrences < 0 || !Number.isInteger(maxKeywordOccurrences))
    ) {
      throw new RuleConfigurationError(
        `Invalid selfPromotion: maxKeywordOccurrences must be a non-negative integer, received: ${maxKeywordOccurrences}`,
        destKey,
        'selfPromotion.maxKeywordOccurrences'
      );
    }
  }

  // Validate linkRestrictions
  if (config.linkRestrictions) {
    const { maxLinks } = config.linkRestrictions;

    if (maxLinks !== undefined && (typeof maxLinks !== 'number' || maxLinks < 0 || !Number.isInteger(maxLinks))) {
      throw new RuleConfigurationError(
        `Invalid linkRestrictions: maxLinks must be a non-negative integer, received: ${maxLinks}`,
        destKey,
        'linkRestrictions.maxLinks'
      );
    }
  }

  // Validate trackingLinks
  if (config.trackingLinks) {
    const { allowedTrackingDomains, disallowedTrackingDomains, requiredTrackingParams, disallowedTrackingParams } = config.trackingLinks;

    if (allowedTrackingDomains !== undefined && !Array.isArray(allowedTrackingDomains)) {
      throw new RuleConfigurationError(
        'Invalid trackingLinks: allowedTrackingDomains must be an array of strings.',
        destKey,
        'trackingLinks.allowedTrackingDomains'
      );
    }

    if (disallowedTrackingDomains !== undefined && !Array.isArray(disallowedTrackingDomains)) {
      throw new RuleConfigurationError(
        'Invalid trackingLinks: disallowedTrackingDomains must be an array of strings.',
        destKey,
        'trackingLinks.disallowedTrackingDomains'
      );
    }

    if (requiredTrackingParams !== undefined && !Array.isArray(requiredTrackingParams)) {
      throw new RuleConfigurationError(
        'Invalid trackingLinks: requiredTrackingParams must be an array of strings.',
        destKey,
        'trackingLinks.requiredTrackingParams'
      );
    }

    if (disallowedTrackingParams !== undefined && !Array.isArray(disallowedTrackingParams)) {
      throw new RuleConfigurationError(
        'Invalid trackingLinks: disallowedTrackingParams must be an array of strings.',
        destKey,
        'trackingLinks.disallowedTrackingParams'
      );
    }
  }

  // Validate publishingSlots
  if (config.publishingSlots) {
    const { slots, timezone } = config.publishingSlots;

    if (!Array.isArray(slots) || slots.length === 0) {
      throw new RuleConfigurationError(
        'Invalid publishingSlots: slots must be a non-empty array of slot objects.',
        destKey,
        'publishingSlots.slots'
      );
    }

    if (timezone !== undefined && typeof timezone !== 'string') {
      throw new RuleConfigurationError(
        'Invalid publishingSlots: timezone must be a string.',
        destKey,
        'publishingSlots.timezone'
      );
    }

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (!slot || typeof slot !== 'object') {
        throw new RuleConfigurationError(
          `Invalid publishingSlots: slot at index ${i} must be an object.`,
          destKey,
          `publishingSlots.slots[${i}]`
        );
      }

      if (!slot.start || typeof slot.start !== 'string') {
        throw new RuleConfigurationError(
          `Invalid publishingSlots: slot at index ${i} missing required 'start' time string.`,
          destKey,
          `publishingSlots.slots[${i}].start`
        );
      }

      if (!slot.end || typeof slot.end !== 'string') {
        throw new RuleConfigurationError(
          `Invalid publishingSlots: slot at index ${i} missing required 'end' time string.`,
          destKey,
          `publishingSlots.slots[${i}].end`
        );
      }

      if (slot.daysOfWeek !== undefined) {
        if (!Array.isArray(slot.daysOfWeek) || slot.daysOfWeek.some((d) => typeof d !== 'number' || d < 0 || d > 6 || !Number.isInteger(d))) {
          throw new RuleConfigurationError(
            `Invalid publishingSlots: slot at index ${i} daysOfWeek must be an array of integers between 0 and 6.`,
            destKey,
            `publishingSlots.slots[${i}].daysOfWeek`
          );
        }
      }

      if (slot.maxPostsPerSlot !== undefined) {
        if (typeof slot.maxPostsPerSlot !== 'number' || slot.maxPostsPerSlot <= 0 || !Number.isInteger(slot.maxPostsPerSlot)) {
          throw new RuleConfigurationError(
            `Invalid publishingSlots: slot at index ${i} maxPostsPerSlot must be a positive integer, received: ${slot.maxPostsPerSlot}`,
            destKey,
            `publishingSlots.slots[${i}].maxPostsPerSlot`
          );
        }
      }
    }
  }
}
