import { getSupabaseClient, withSupabaseRetry } from "../supabaseClient.js";

export interface Flashcard {
  id: number;
  classId: number;
  question: string;
  answer: string;
  sourceUploadId: number | null;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  reviewCount: number;
  createdAt: string;
}

interface FlashcardRow {
  id: number;
  class_id: number;
  question: string;
  answer: string;
  source_upload_id: number | null;
  last_reviewed_at: string | null;
  next_review_at: string | null;
  review_count: number;
  created_at: string;
}

function rowToFlashcard(row: FlashcardRow): Flashcard {
  return {
    id: row.id,
    classId: row.class_id,
    question: row.question,
    answer: row.answer,
    sourceUploadId: row.source_upload_id,
    lastReviewedAt: row.last_reviewed_at,
    nextReviewAt: row.next_review_at,
    reviewCount: row.review_count,
    createdAt: row.created_at,
  };
}

const SELECT_COLUMNS =
  "id, class_id, question, answer, source_upload_id, last_reviewed_at, next_review_at, review_count, created_at";

export async function getFlashcardsForClass(classId: number): Promise<Flashcard[]> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client.from("flashcards").select(SELECT_COLUMNS).eq("class_id", classId).order("created_at", { ascending: false })
  );
  if (error) {
    if (error.code === "PGRST205") return [];
    throw new Error(`Supabase read error: ${error.message}`);
  }
  return (data ?? []).map(rowToFlashcard);
}

export async function createFlashcards(
  classId: number,
  sourceUploadId: number | null,
  cards: { question: string; answer: string }[]
): Promise<void> {
  if (cards.length === 0) return;
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("flashcards").insert(
      cards.map((c) => ({
        class_id: classId,
        question: c.question,
        answer: c.answer,
        source_upload_id: sourceUploadId,
      }))
    )
  );
  if (error) {
    throw new Error(`Supabase insert error: ${error.message}`);
  }
}

export async function deleteFlashcard(id: number): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() => client.from("flashcards").delete().eq("id", id));
  if (error) {
    throw new Error(`Supabase delete error: ${error.message}`);
  }
}

// Lightweight spaced repetition, not a full SM-2 implementation —
// proportionate to a single-user study tool. Each correct review moves to
// the next (longer) interval; a miss resets to the first interval rather
// than penalizing further, since the point is re-exposure, not scoring.
const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30];

export async function reviewFlashcard(id: number, gotIt: boolean): Promise<void> {
  const client = getSupabaseClient();
  const { data, error: readError } = await withSupabaseRetry(() =>
    client.from("flashcards").select("review_count").eq("id", id).maybeSingle()
  );
  if (readError || !data) {
    throw new Error(`Supabase read error: ${readError?.message ?? "flashcard not found"}`);
  }

  const nextCount = gotIt ? data.review_count + 1 : 0;
  // Index by the review just passed (data.review_count, pre-increment),
  // not nextCount — indexing by nextCount skipped the intended 1-day
  // first interval, jumping a brand-new card straight to 3 days on its
  // first correct answer. A miss still resets to the shortest interval
  // via nextCount's 0 above.
  const intervalDays = REVIEW_INTERVALS_DAYS[Math.min(gotIt ? data.review_count : 0, REVIEW_INTERVALS_DAYS.length - 1)];
  const nextReviewAt = new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await withSupabaseRetry(() =>
    client
      .from("flashcards")
      .update({ review_count: nextCount, last_reviewed_at: new Date().toISOString(), next_review_at: nextReviewAt })
      .eq("id", id)
  );
  if (error) {
    throw new Error(`Supabase update error: ${error.message}`);
  }
}

// Filtered in JS rather than a PostgREST `.or()` filter built from an ISO
// timestamp string — same reasoning src/ipos/store.ts documents for
// company/ticker lookups: a value containing extra `.` characters (as
// every ISO datetime does) risks confusing that filter DSL. A personal
// flashcard bank is small enough that fetching the class's full set and
// filtering here costs nothing.
export async function getDueFlashcardsForClass(classId: number): Promise<Flashcard[]> {
  const all = await getFlashcardsForClass(classId);
  const now = Date.now();
  return all.filter((c) => !c.nextReviewAt || new Date(c.nextReviewAt).getTime() <= now);
}
