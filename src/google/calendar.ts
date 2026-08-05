import { getAccessToken } from "./auth.js";

const BASE_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export interface CreateEventInput {
  summary: string;
  startIso: string;
  endIso: string;
  description?: string;
}

export async function createCalendarEvent(input: CreateEventInput): Promise<{ id: string }> {
  const accessToken = await getAccessToken();

  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: input.summary,
      description: input.description,
      start: { dateTime: input.startIso },
      end: { dateTime: input.endIso },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google Calendar API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as { id: string };
  return { id: data.id };
}

export interface RecurringAllDayEventInput {
  summary: string;
  /** 1-12 */
  month: number;
  /** 1-31 */
  day: number;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// A yearly-recurring all-day event — birthdays, anniversaries, etc.
// Anchored to this year's occurrence (Google Calendar events happily
// recur backward-compatibly; whether that date already passed this year
// doesn't matter, RRULE:FREQ=YEARLY just keeps firing every year from
// here on). All-day events use an *exclusive* end date one day after
// start, per the Calendar API's own convention.
export async function createRecurringAllDayEvent(input: RecurringAllDayEventInput): Promise<{ id: string }> {
  const accessToken = await getAccessToken();
  const year = new Date().getFullYear();
  const startDate = `${year}-${pad2(input.month)}-${pad2(input.day)}`;
  const end = new Date(`${startDate}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  const endDate = end.toISOString().slice(0, 10);

  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: input.summary,
      start: { date: startDate },
      end: { date: endDate },
      recurrence: ["RRULE:FREQ=YEARLY"],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google Calendar API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as { id: string };
  return { id: data.id };
}

// 410 (Gone) means it's already deleted — treated as success rather than
// an error, since the caller's goal ("this event shouldn't exist anymore")
// is already satisfied either way.
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const accessToken = await getAccessToken();
  const response = await fetch(`${BASE_URL}/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok && response.status !== 410) {
    const body = await response.text();
    throw new Error(`Google Calendar API error ${response.status}: ${body}`);
  }
}
