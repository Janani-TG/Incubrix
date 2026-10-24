import { RuleId, RuleViolation, PublishingSlotsRuleConfig } from '../types';
import { PublicationHistoryStore } from '../historyStore';
import { Clock } from '../clock';
import { findActiveSlot, getNextAvailableSlot, getSlotWindow } from '../utils/slotCalculator';

/**
 * Evaluates whether content publication complies with destination publishing slots and slot capacity limits.
 */
export async function evaluatePublishingSlots(
  destinationKey: string,
  config: PublishingSlotsRuleConfig,
  historyStore: PublicationHistoryStore,
  clock: Clock
): Promise<RuleViolation[]> {
  if (config.enabled === false || !config.slots || config.slots.length === 0) {
    return [];
  }

  const now = clock.now();
  const timeZone = config.timezone || 'UTC';
  const activeSlot = findActiveSlot(now, config.slots, timeZone);

  // 1. Outside all configured slots
  if (!activeSlot) {
    const nextSlot = getNextAvailableSlot(now, config.slots, timeZone);
    return [
      {
        ruleId: RuleId.PUBLISHING_SLOTS,
        message: `Publishing outside permitted slot for destination '${destinationKey}'. Current time (${now.toISOString()}) is outside all configured publishing slots.`,
        details: {
          currentTime: now.toISOString(),
          timezone: timeZone,
          configuredSlots: config.slots,
          nextAvailableSlot: nextSlot
            ? {
                start: nextSlot.slot.start,
                end: nextSlot.slot.end,
                name: nextSlot.slot.name,
                startsAt: nextSlot.startsAt.toISOString(),
              }
            : null,
        },
      },
    ];
  }

  // 2. Inside an active slot: verify slot capacity limit
  if (activeSlot.maxPostsPerSlot !== undefined && activeSlot.maxPostsPerSlot > 0) {
    const window = getSlotWindow(now, activeSlot, timeZone);
    const records = await historyStore.getPublicationsSince(destinationKey, window.start);

    // Count live publications in this slot window
    const inSlotCount = records.filter(
      (r) => r.publishedAt.getTime() < window.end.getTime() && r.isSimulated !== true
    ).length;

    if (inSlotCount >= activeSlot.maxPostsPerSlot) {
      return [
        {
          ruleId: RuleId.PUBLISHING_SLOTS,
          message: `Publishing slot capacity reached for destination '${destinationKey}'. Slot ${activeSlot.start}-${activeSlot.end} has reached its limit of ${activeSlot.maxPostsPerSlot} publication(s) (${inSlotCount} published).`,
          details: {
            slot: {
              name: activeSlot.name,
              start: activeSlot.start,
              end: activeSlot.end,
              maxPostsPerSlot: activeSlot.maxPostsPerSlot,
            },
            usedCapacity: inSlotCount,
            maxCapacity: activeSlot.maxPostsPerSlot,
            slotWindow: {
              start: window.start.toISOString(),
              end: window.end.toISOString(),
            },
          },
        },
      ];
    }
  }

  return [];
}
