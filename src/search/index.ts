import { getSupabaseClient, withSupabaseRetry } from "../supabaseClient.js";
import { stripHtml } from "../util/html.js";

export interface SearchResult {
  kind: "newsletter" | "upload";
  title: string;
  date: string;
  snippet: string;
}

function snippetOf(text: string, maxLength = 200): string {
  const trimmed = text.trim();
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}…` : trimmed;
}

const RESULT_LIMIT = 5;
// Bounded recent window pulled from each table, then filtered in JS —
// simpler and safer than building a raw PostgREST `.or()` filter string
// out of user-controlled search text (which breaks on commas/parens in
// the query and isn't parameterized the way `.eq()`/`.ilike()` are).
const SCAN_LIMIT = 200;

async function searchNewsletters(query: string): Promise<SearchResult[]> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client
      .from("newsletters")
      .select("subject, sender, received_at, html")
      .order("received_at", { ascending: false })
      .limit(SCAN_LIMIT)
  );

  if (error) {
    if (error.code === "PGRST205") return [];
    throw new Error(`Supabase read error: ${error.message}`);
  }

  const needle = query.toLowerCase();
  const results: SearchResult[] = [];
  for (const row of data ?? []) {
    const plainBody = stripHtml(row.html);
    if (row.subject.toLowerCase().includes(needle) || plainBody.toLowerCase().includes(needle)) {
      results.push({
        kind: "newsletter",
        title: `${row.subject} (${row.sender})`,
        date: row.received_at,
        snippet: snippetOf(plainBody),
      });
      if (results.length >= RESULT_LIMIT) break;
    }
  }
  return results;
}

async function searchUploads(query: string): Promise<SearchResult[]> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client
      .from("uploads")
      .select("original_filename, created_at, transcript, notes")
      .eq("status", "done")
      .order("created_at", { ascending: false })
      .limit(SCAN_LIMIT)
  );

  if (error) {
    if (error.code === "PGRST205") return [];
    throw new Error(`Supabase read error: ${error.message}`);
  }

  const needle = query.toLowerCase();
  const results: SearchResult[] = [];
  for (const row of data ?? []) {
    const body = row.transcript ?? row.notes ?? "";
    if (
      row.original_filename.toLowerCase().includes(needle) ||
      body.toLowerCase().includes(needle)
    ) {
      results.push({
        kind: "upload",
        title: row.original_filename,
        date: row.created_at,
        snippet: snippetOf(body),
      });
      if (results.length >= RESULT_LIMIT) break;
    }
  }
  return results;
}

// Searches stored newsletters and lecture/photo uploads by keyword — not
// Drive class files, which the existing get_class_files tool already
// covers when the user names a specific class.
export async function searchContent(query: string): Promise<SearchResult[]> {
  const [newsletters, uploads] = await Promise.all([
    searchNewsletters(query).catch(() => []),
    searchUploads(query).catch(() => []),
  ]);
  return [...newsletters, ...uploads];
}
