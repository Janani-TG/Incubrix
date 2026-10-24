import { PublishingSlot } from '../types';

/**
 * Parses a 24-hour time string in "HH:mm" format into hours, minutes, and total minutes from midnight.
 */
export function parseSlotTime(timeStr: string): { hours: number; minutes: number; totalMinutes: number } {
  if (!timeStr || typeof timeStr !== 'string') {
    throw new Error(`Invalid time string: '${timeStr}'. Expected 'HH:mm'.`);
  }

  const parts = timeStr.trim().split(':');
  if (parts.length !== 2 || parts[0] === undefined || parts[1] === undefined) {
    throw new Error(`Invalid time format: '${timeStr}'. Expected 'HH:mm'.`);
  }

  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);

  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Invalid time value: '${timeStr}'. Hours must be 0-23, minutes 0-59.`);
  }

  return {
    hours,
    minutes,
    totalMinutes: hours * 60 + minutes,
  };
}

export interface TimezoneDateParts {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  totalMinutes: number;
}

/**
 * Extracts date and time components in a given timezone (defaults to UTC).
 */
export function getDatePartsInTimezone(date: Date, timeZone: string = 'UTC'): TimezoneDateParts {
  if (timeZone.toUpperCase() === 'UTC') {
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hours,
      minutes,
      seconds: date.getUTCSeconds(),
      dayOfWeek: date.getUTCDay(),
      totalMinutes: hours * 60 + minutes,
    };
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      weekday: 'short',
    });

    const parts = formatter.formatToParts(date);
    const lookup: Record<string, string> = {};
    for (const p of parts) {
      lookup[p.type] = p.value;
    }

    const weekdays: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };

    const hours = parseInt(lookup.hour || '0', 10) % 24;
    const minutes = parseInt(lookup.minute || '0', 10);
    const dayOfWeek = weekdays[lookup.weekday || 'Sun'] ?? 0;

    return {
      year: parseInt(lookup.year || '1970', 10),
      month: parseInt(lookup.month || '1', 10),
      day: parseInt(lookup.day || '1', 10),
      hours,
      minutes,
      seconds: parseInt(lookup.second || '0', 10),
      dayOfWeek,
      totalMinutes: hours * 60 + minutes,
    };
  } catch {
    // Fallback to UTC if timezone is invalid
    return getDatePartsInTimezone(date, 'UTC');
  }
}

/**
 * Determines whether a given date falls inside a specified publishing slot.
 */
export function isTimeInSlot(
  date: Date,
  slot: PublishingSlot,
  timeZone: string = 'UTC'
): boolean {
  const parts = getDatePartsInTimezone(date, timeZone);

  // Check day of week
  if (slot.daysOfWeek && slot.daysOfWeek.length > 0) {
    if (!slot.daysOfWeek.includes(parts.dayOfWeek)) {
      return false;
    }
  }

  const start = parseSlotTime(slot.start);
  const end = parseSlotTime(slot.end);

  // Standard daytime slot (e.g. 09:00 to 17:00)
  if (start.totalMinutes < end.totalMinutes) {
    return parts.totalMinutes >= start.totalMinutes && parts.totalMinutes < end.totalMinutes;
  }

  // Overnight slot spanning midnight (e.g. 22:00 to 04:00)
  return parts.totalMinutes >= start.totalMinutes || parts.totalMinutes < end.totalMinutes;
}

/**
 * Finds the active publishing slot matching the given date, or returns null if outside all slots.
 */
export function findActiveSlot(
  date: Date,
  slots: PublishingSlot[],
  timeZone: string = 'UTC'
): PublishingSlot | null {
  for (const slot of slots) {
    if (isTimeInSlot(date, slot, timeZone)) {
      return slot;
    }
  }
  return null;
}

/**
 * Computes the start and end Date objects corresponding to the slot window for the given date.
 */
export function getSlotWindow(
  date: Date,
  slot: PublishingSlot,
  timeZone: string = 'UTC'
): { start: Date; end: Date } {
  const parts = getDatePartsInTimezone(date, timeZone);
  const startParsed = parseSlotTime(slot.start);
  const endParsed = parseSlotTime(slot.end);

  if (timeZone.toUpperCase() === 'UTC') {
    const startDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, startParsed.hours, startParsed.minutes, 0, 0));
    let endDate: Date;

    if (startParsed.totalMinutes < endParsed.totalMinutes) {
      endDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, endParsed.hours, endParsed.minutes, 0, 0));
    } else {
      // Overnight: ends next UTC day
      endDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1, endParsed.hours, endParsed.minutes, 0, 0));
    }

    return { start: startDate, end: endDate };
  }

  // Generic timezone calculation
  const startDeltaMinutes = startParsed.totalMinutes - parts.totalMinutes;
  const startDate = new Date(date.getTime() + startDeltaMinutes * 60 * 1000 - parts.seconds * 1000);

  let endDeltaMinutes: number;
  if (startParsed.totalMinutes < endParsed.totalMinutes) {
    endDeltaMinutes = endParsed.totalMinutes - parts.totalMinutes;
  } else {
    endDeltaMinutes = (endParsed.totalMinutes + 24 * 60) - parts.totalMinutes;
  }
  const endDate = new Date(date.getTime() + endDeltaMinutes * 60 * 1000 - parts.seconds * 1000);

  return { start: startDate, end: endDate };
}

/**
 * Finds the next upcoming publishing slot and its start time relative to the given date.
 */
export function getNextAvailableSlot(
  date: Date,
  slots: PublishingSlot[],
  timeZone: string = 'UTC'
): { slot: PublishingSlot; startsAt: Date } | null {
  if (!slots || slots.length === 0) {
    return null;
  }

  let earliest: { slot: PublishingSlot; startsAt: Date } | null = null;

  // Scan up to 8 days in the future
  for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
    const checkDate = new Date(date.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const parts = getDatePartsInTimezone(checkDate, timeZone);

    for (const slot of slots) {
      if (slot.daysOfWeek && slot.daysOfWeek.length > 0) {
        if (!slot.daysOfWeek.includes(parts.dayOfWeek)) {
          continue;
        }
      }

      const startParsed = parseSlotTime(slot.start);
      let slotStartTime: Date;

      if (timeZone.toUpperCase() === 'UTC') {
        slotStartTime = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, startParsed.hours, startParsed.minutes, 0, 0));
      } else {
        const deltaMinutes = startParsed.totalMinutes - parts.totalMinutes;
        slotStartTime = new Date(checkDate.getTime() + deltaMinutes * 60 * 1000 - parts.seconds * 1000);
      }

      // Must be in the future relative to current date
      if (slotStartTime.getTime() > date.getTime()) {
        if (!earliest || slotStartTime.getTime() < earliest.startsAt.getTime()) {
          earliest = { slot, startsAt: slotStartTime };
        }
      }
    }
  }

  return earliest;
}
