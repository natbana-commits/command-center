import { getContacts } from "../contacts/store.js";
import { getClassFolders } from "../drive/classFolders.js";
import { listRemindersSafe } from "../google/tasks.js";
import { searchContent } from "./index.js";

export interface GlobalSearchResult {
  kind: "reminder" | "contact" | "class" | "newsletter" | "upload";
  title: string;
  subtitle?: string;
  href: string;
}

const RESULT_LIMIT_PER_KIND = 5;

function matches(needle: string, ...fields: (string | null | undefined)[]): boolean {
  return fields.some((f) => f?.toLowerCase().includes(needle));
}

// Extends the existing searchContent() (newsletters/uploads) with reminders,
// contacts, and classes — the command palette's dynamic half. Static
// results (page navigation, quick actions) are handled entirely client-side
// in layout.ts and never reach this function.
export async function globalSearch(query: string): Promise<GlobalSearchResult[]> {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const [reminders, contacts, classFolders, contentResults] = await Promise.all([
    listRemindersSafe().catch(() => []),
    getContacts().catch(() => []),
    getClassFolders().catch(() => []),
    searchContent(query).catch(() => []),
  ]);

  const reminderResults: GlobalSearchResult[] = reminders
    .filter((r) => matches(needle, r.title, r.notes))
    .slice(0, RESULT_LIMIT_PER_KIND)
    .map((r) => ({
      kind: "reminder",
      title: r.title,
      href: `/donna/reminders?edit=${encodeURIComponent(r.id)}`,
    }));

  const contactResults: GlobalSearchResult[] = contacts
    .filter((c) => matches(needle, c.name, c.firm, c.bio))
    .slice(0, RESULT_LIMIT_PER_KIND)
    .map((c) => ({ kind: "contact", title: c.name, subtitle: c.firm ?? undefined, href: "/donna/contacts" }));

  const classResults: GlobalSearchResult[] = classFolders
    .filter((c) => matches(needle, c.className))
    .slice(0, RESULT_LIMIT_PER_KIND)
    .map((c) => ({ kind: "class", title: c.className, href: `/donna/school?classId=${c.id}` }));

  const contentAsGlobal: GlobalSearchResult[] = contentResults.map((r) => ({
    kind: r.kind,
    title: r.title,
    subtitle: r.snippet,
    href: r.kind === "newsletter" ? "/donna" : "/donna/files",
  }));

  return [...reminderResults, ...contactResults, ...classResults, ...contentAsGlobal];
}
