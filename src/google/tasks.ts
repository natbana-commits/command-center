import { getAccessToken, isGoogleConfigured } from "./auth.js";
import { getOrFetch, invalidateCache } from "../util/cache.js";

const TASKS_CACHE_KEY = "tasks:list";

const LIST_TITLE = "Donna Reminders";
const BASE_URL = "https://tasks.googleapis.com/tasks/v1";

export interface Reminder {
  id: string;
  title: string;
  notes?: string;
  due?: string;
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
  return getOrFetch(TASKS_CACHE_KEY, 60, async () => {
    const accessToken = await getAccessToken();
    const listId = await getOrCreateReminderListId(accessToken);

    const response = await apiFetch(
      `/lists/${listId}/tasks?showCompleted=false&showHidden=false`,
      accessToken
    );
    const data = (await response.json()) as {
      items?: { id: string; title: string; notes?: string; due?: string }[];
    };

    return (data.items ?? []).map((t) => ({ id: t.id, title: t.title, notes: t.notes, due: t.due }));
  });
}

export async function getReminder(taskId: string): Promise<Reminder | null> {
  const accessToken = await getAccessToken();
  const listId = await getOrCreateReminderListId(accessToken);

  const response = await fetch(`${BASE_URL}/lists/${listId}/tasks/${taskId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google Tasks API error ${response.status}: ${body}`);
  }

  const t = (await response.json()) as { id: string; title: string; notes?: string; due?: string };
  return { id: t.id, title: t.title, notes: t.notes, due: t.due };
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
  await invalidateCache(TASKS_CACHE_KEY);
  return { id: created.id };
}

export async function completeReminder(taskId: string): Promise<void> {
  const accessToken = await getAccessToken();
  const listId = await getOrCreateReminderListId(accessToken);

  await apiFetch(`/lists/${listId}/tasks/${taskId}`, accessToken, {
    method: "PATCH",
    body: JSON.stringify({ status: "completed" }),
  });
  await invalidateCache(TASKS_CACHE_KEY);
}

export async function updateReminder(
  taskId: string,
  fields: { title?: string; notes?: string; dueIso?: string | null }
): Promise<void> {
  const accessToken = await getAccessToken();
  const listId = await getOrCreateReminderListId(accessToken);

  const body: Record<string, unknown> = {};
  if (fields.title !== undefined) body.title = fields.title;
  if (fields.notes !== undefined) body.notes = fields.notes;
  // Google Tasks has no documented way to clear `due` via null in a PATCH
  // body (it's simply omitted if absent) — callers that want to clear a
  // due date should be aware this only ever sets/replaces it, never clears.
  if (fields.dueIso) body.due = fields.dueIso;

  await apiFetch(`/lists/${listId}/tasks/${taskId}`, accessToken, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  await invalidateCache(TASKS_CACHE_KEY);
}

export async function deleteReminder(taskId: string): Promise<void> {
  const accessToken = await getAccessToken();
  const listId = await getOrCreateReminderListId(accessToken);

  await apiFetch(`/lists/${listId}/tasks/${taskId}`, accessToken, { method: "DELETE" });
  await invalidateCache(TASKS_CACHE_KEY);
}
