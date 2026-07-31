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
