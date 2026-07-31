import type { CalendarEvent } from "../calendar.js";
import { dayBounds } from "../util/time.js";

// A default "waking hours" window — not something Nathan asked to
// configure, but a reasonable guardrail so a technically-open 3am slot
// never gets proposed as a place to watch a film or do homework.
const WAKING_START_HOUR = 8;
const WAKING_END_HOUR = 22;

export interface OpenSlot {
  start: Date;
  end: Date;
}

export function findOpenSlot(
  events: CalendarEvent[],
  durationMinutes: number,
  rangeStart: Date,
  rangeEnd: Date,
  timezone: string
): OpenSlot | null {
  const durationMs = durationMinutes * 60 * 1000;
  const busy = events
    .filter((e): e is CalendarEvent & { end: Date } => Boolean(e.end))
    .map((e) => ({ start: e.start, end: e.end }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  let cursorDay = new Date(rangeStart);

  while (cursorDay < rangeEnd) {
    const { start: dayStart } = dayBounds(cursorDay, timezone);
    const wakeStart = new Date(dayStart.getTime() + WAKING_START_HOUR * 60 * 60 * 1000);
    const wakeEnd = new Date(dayStart.getTime() + WAKING_END_HOUR * 60 * 60 * 1000);

    const windowStart = wakeStart > rangeStart ? wakeStart : rangeStart;
    const windowEnd = wakeEnd < rangeEnd ? wakeEnd : rangeEnd;

    if (windowStart < windowEnd) {
      let cursor = windowStart;
      for (const b of busy) {
        if (b.end <= cursor) continue;
        if (b.start >= windowEnd) break;
        if (b.start.getTime() - cursor.getTime() >= durationMs) {
          return { start: cursor, end: new Date(cursor.getTime() + durationMs) };
        }
        if (b.end > cursor) cursor = b.end;
      }
      if (windowEnd.getTime() - cursor.getTime() >= durationMs) {
        return { start: cursor, end: new Date(cursor.getTime() + durationMs) };
      }
    }

    cursorDay = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 + 1);
  }

  return null;
}
