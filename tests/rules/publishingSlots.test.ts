import { describe, it, expect, beforeEach } from 'vitest';
import {
  evaluatePublishingSlots,
  parseSlotTime,
  isTimeInSlot,
  findActiveSlot,
  getNextAvailableSlot,
  getSlotWindow,
  ControllableClock,
  InMemoryPublicationHistoryStore,
  RuleId,
  PublishingSlot,
} from '../../src/rules';

describe('Publishing Slots Schedule & Capacity Rules', () => {
  let clock: ControllableClock;
  let historyStore: InMemoryPublicationHistoryStore;

  const standardWeekdaySlots: PublishingSlot[] = [
    {
      name: 'Morning Slot',
      start: '09:00',
      end: '12:00',
      daysOfWeek: [1, 2, 3, 4, 5], // Monday - Friday
      maxPostsPerSlot: 2,
    },
    {
      name: 'Afternoon Slot',
      start: '14:00',
      end: '17:00',
      daysOfWeek: [1, 2, 3, 4, 5],
      maxPostsPerSlot: 1,
    },
  ];

  beforeEach(() => {
    // 2026-03-02 is a Monday
    // Initialized at 2026-03-02T10:00:00.000Z (Monday 10:00 UTC -> inside Morning Slot)
    clock = new ControllableClock(new Date('2026-03-02T10:00:00.000Z'));
    historyStore = new InMemoryPublicationHistoryStore();
  });

  describe('Slot Calculation Utilities', () => {
    it('should parse valid HH:mm time strings', () => {
      expect(parseSlotTime('09:00')).toEqual({ hours: 9, minutes: 0, totalMinutes: 540 });
      expect(parseSlotTime('17:45')).toEqual({ hours: 17, minutes: 45, totalMinutes: 1065 });
      expect(parseSlotTime('00:00')).toEqual({ hours: 0, minutes: 0, totalMinutes: 0 });
    });

    it('should throw on invalid time strings', () => {
      expect(() => parseSlotTime('invalid')).toThrow();
      expect(() => parseSlotTime('25:00')).toThrow();
      expect(() => parseSlotTime('12:60')).toThrow();
    });

    it('should accurately detect when time falls within slot', () => {
      const slot: PublishingSlot = {
        start: '09:00',
        end: '12:00',
        daysOfWeek: [1, 2, 3, 4, 5],
      };

      // Monday 10:00 UTC -> inside
      expect(isTimeInSlot(new Date('2026-03-02T10:00:00.000Z'), slot, 'UTC')).toBe(true);

      // Monday 08:59 UTC -> outside
      expect(isTimeInSlot(new Date('2026-03-02T08:59:00.000Z'), slot, 'UTC')).toBe(false);

      // Monday 12:00 UTC -> outside (upper bound is exclusive)
      expect(isTimeInSlot(new Date('2026-03-02T12:00:00.000Z'), slot, 'UTC')).toBe(false);

      // Sunday 10:00 UTC (2026-03-01) -> outside because Sunday (day 0) not in daysOfWeek
      expect(isTimeInSlot(new Date('2026-03-01T10:00:00.000Z'), slot, 'UTC')).toBe(false);
    });

    it('should support overnight slots spanning midnight', () => {
      const overnightSlot: PublishingSlot = {
        start: '22:00',
        end: '04:00',
      };

      // 23:00 -> inside
      expect(isTimeInSlot(new Date('2026-03-02T23:00:00.000Z'), overnightSlot, 'UTC')).toBe(true);

      // 03:00 -> inside
      expect(isTimeInSlot(new Date('2026-03-02T03:00:00.000Z'), overnightSlot, 'UTC')).toBe(true);

      // 12:00 -> outside
      expect(isTimeInSlot(new Date('2026-03-02T12:00:00.000Z'), overnightSlot, 'UTC')).toBe(false);
    });

    it('should calculate the next available slot when outside current slots', () => {
      // Monday 13:00 UTC (between 12:00 and 14:00)
      const outsideTime = new Date('2026-03-02T13:00:00.000Z');
      const next = getNextAvailableSlot(outsideTime, standardWeekdaySlots, 'UTC');

      expect(next).not.toBeNull();
      expect(next?.slot.name).toBe('Afternoon Slot');
      expect(next?.startsAt.toISOString()).toBe('2026-03-02T14:00:00.000Z');
    });
  });

  describe('Rule Evaluation: evaluatePublishingSlots', () => {
    it('should allow publishing when current time falls within an active slot with capacity', async () => {
      // Monday 10:00 UTC -> inside Morning Slot
      const violations = await evaluatePublishingSlots(
        'devto',
        {
          enabled: true,
          slots: standardWeekdaySlots,
          timezone: 'UTC',
        },
        historyStore,
        clock
      );

      expect(violations).toHaveLength(0);
    });

    it('should block publishing when current time is outside all configured slots', async () => {
      // Advance clock to Monday 13:00 UTC (outside Morning and Afternoon slots)
      clock.setTime(new Date('2026-03-02T13:00:00.000Z'));

      const violations = await evaluatePublishingSlots(
        'devto',
        {
          enabled: true,
          slots: standardWeekdaySlots,
          timezone: 'UTC',
        },
        historyStore,
        clock
      );

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].ruleId).toBe(RuleId.PUBLISHING_SLOTS);
      expect(violations[0].message).toContain('outside all configured publishing slots');
      expect(violations[0].details?.nextAvailableSlot).toBeDefined();
    });

    it('should block publishing on weekends when daysOfWeek excludes Saturday and Sunday', async () => {
      // Sunday 2026-03-01 10:00 UTC
      clock.setTime(new Date('2026-03-01T10:00:00.000Z'));

      const violations = await evaluatePublishingSlots(
        'devto',
        {
          enabled: true,
          slots: standardWeekdaySlots,
          timezone: 'UTC',
        },
        historyStore,
        clock
      );

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].ruleId).toBe(RuleId.PUBLISHING_SLOTS);
    });

    it('should enforce slot capacity limits within the active window', async () => {
      // Clock at Monday 10:00 UTC (Morning Slot has maxPostsPerSlot: 2)
      const slotConfig = {
        enabled: true,
        slots: standardWeekdaySlots,
        timezone: 'UTC',
      };

      // 1. Initial check: 0 publications in slot -> allowed
      let violations = await evaluatePublishingSlots('devto', slotConfig, historyStore, clock);
      expect(violations).toHaveLength(0);

      // Record first live publication in this slot (10:05 UTC)
      historyStore.recordPublication({
        destinationKey: 'devto',
        publishedAt: new Date('2026-03-02T10:05:00.000Z'),
        externalId: 'ext-1',
      });

      // 2. Second check: 1 publication in slot (limit 2) -> allowed
      violations = await evaluatePublishingSlots('devto', slotConfig, historyStore, clock);
      expect(violations).toHaveLength(0);

      // Record second live publication in this slot (10:15 UTC)
      historyStore.recordPublication({
        destinationKey: 'devto',
        publishedAt: new Date('2026-03-02T10:15:00.000Z'),
        externalId: 'ext-2',
      });

      // 3. Third check: 2 publications in slot (limit 2) -> BLOCKED
      violations = await evaluatePublishingSlots('devto', slotConfig, historyStore, clock);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].ruleId).toBe(RuleId.PUBLISHING_SLOTS);
      expect(violations[0].message).toContain('Publishing slot capacity reached');
      expect(violations[0].details?.usedCapacity).toBe(2);
      expect(violations[0].details?.maxCapacity).toBe(2);

      // Simulated publications should not consume quota
      historyStore.clear('devto');
      historyStore.recordPublication({
        destinationKey: 'devto',
        publishedAt: new Date('2026-03-02T10:05:00.000Z'),
        externalId: 'ext-sim-1',
        isSimulated: true,
      });
      historyStore.recordPublication({
        destinationKey: 'devto',
        publishedAt: new Date('2026-03-02T10:10:00.000Z'),
        externalId: 'ext-sim-2',
        isSimulated: true,
      });

      violations = await evaluatePublishingSlots('devto', slotConfig, historyStore, clock);
      expect(violations).toHaveLength(0);
    });

    it('should reset capacity accounting when moving to the next slot', async () => {
      const slotConfig = {
        enabled: true,
        slots: standardWeekdaySlots,
        timezone: 'UTC',
      };

      // Fill Morning Slot capacity
      historyStore.recordPublication({
        destinationKey: 'devto',
        publishedAt: new Date('2026-03-02T10:00:00.000Z'),
      });
      historyStore.recordPublication({
        destinationKey: 'devto',
        publishedAt: new Date('2026-03-02T10:30:00.000Z'),
      });

      // Morning slot is full
      let violations = await evaluatePublishingSlots('devto', slotConfig, historyStore, clock);
      expect(violations.length).toBeGreaterThan(0);

      // Advance clock to Afternoon Slot: Monday 15:00 UTC
      clock.setTime(new Date('2026-03-02T15:00:00.000Z'));

      // Afternoon slot capacity has not been used yet -> allowed
      violations = await evaluatePublishingSlots('devto', slotConfig, historyStore, clock);
      expect(violations).toHaveLength(0);
    });
  });
});
