import { getAccessToken, isGoogleConfigured } from "./auth.js";

const LIST_TITLE = "Donna Reminders";
const BASE_URL = "https://tasks.googleapis.com/tasks/v1";

export interface Reminder {
  id: string;
  title: string;
  notes?: string;
}

async function apiFetch(path: string, accessToken: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google Tasks API error ${response.status}: ${body}`);
  }
  return response;
}

let cachedListId: string | null = null;

async function getOrCreateReminderListId(accessToken: string): Promise<string> {
  if (cachedListId) return cachedListId;

  const listsResponse = await apiFetch("/users/@me/lists", accessToken);
  const listsData = (await listsResponse.json()) as { items?: { id: string; title: string }[] };
  const existing = (listsData.items ?? []).find((l) => l.title === LIST_TITLE);

  if (existing) {
    cachedListId = existing.id;
    return existing.id;
  }

  const createResponse = await apiFetch("/users/@me/lists", accessToken, {
    method: "POST",
    body: JSON.stringify({ title: LIST_TITLE }),
  });
  const created = (await createResponse.json()) as { id: string };
  cachedListId = created.id;
  return created.id;
}

export async function listReminders(): Promise<Reminder[]> {
  const accessToken = await getAccessToken();
  const listId = await getOrCreateReminderListId(accessToken);

  const response = await apiFetch(
    `/lists/${listId}/tasks?showCompleted=false&showHidden=false`,
    accessToken
  );
  const data = (await response.json()) as {
    items?: { id: string; title: string; notes?: string }[];
  };

  return (data.items ?? []).map((t) => ({ id: t.id, title: t.title, notes: t.notes }));
}

// Safe to call unconditionally: returns [] (no throw) until Google is
// configured, or if the API call fails for any reason — reminders are
// "nice to have" context, not something that should break the brief/chat.
export async function listRemindersSafe(): Promise<Reminder[]> {
  if (!isGoogleConfigured()) return [];
  try {
    return await listReminders();
  } catch (err) {
    console.error("Failed to list reminders:", err);
    return [];
  }
}

export async function addReminder(
  title: string,
  notes?: string,
  dueIso?: string
): Promise<{ id: string }> {
  const accessToken = await getAccessToken();
  const listId = await getOrCreateReminderListId(accessToken);

  const response = await apiFetch(`/lists/${listId}/tasks`, accessToken, {
    method: "POST",
    body: JSON.stringify({ title, notes, due: dueIso }),
  });
  const created = (await response.json()) as { id: string };
  return { id: created.id };
}

export async function completeReminder(taskId: string): Promise<void> {
  const accessToken = await getAccessToken();
  const listId = await getOrCreateReminderListId(accessToken);

  await apiFetch(`/lists/${listId}/tasks/${taskId}`, accessToken, {
    method: "PATCH",
    body: JSON.stringify({ status: "completed" }),
  });
}
