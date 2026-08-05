import { getSupabaseClient, withSupabaseRetry } from "../supabaseClient.js";

const BUCKET = "donna-uploads";

export type UploadKind = "lecture" | "photo" | "file";
export type UploadStatus = "pending" | "processing" | "done" | "failed";

export interface Upload {
  id: number;
  storagePath: string;
  kind: UploadKind;
  classId: number | null;
  originalFilename: string;
  status: UploadStatus;
  transcript: string | null;
  notes: string | null;
  error: string | null;
  createdAt: string;
}

function rowToUpload(row: {
  id: number;
  storage_path: string;
  kind: string;
  class_id: number | null;
  original_filename: string;
  status: string;
  transcript: string | null;
  notes: string | null;
  error: string | null;
  created_at: string;
}): Upload {
  return {
    id: row.id,
    storagePath: row.storage_path,
    kind: row.kind as UploadKind,
    classId: row.class_id,
    originalFilename: row.original_filename,
    status: row.status as UploadStatus,
    transcript: row.transcript,
    notes: row.notes,
    error: row.error,
    createdAt: row.created_at,
  };
}

export async function createSignedUploadUrl(
  path: string
): Promise<{ signedUrl: string; token: string }> {
  const client = getSupabaseClient();
  const { data, error } = await client.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) {
    throw new Error(`Supabase storage error: ${error.message}`);
  }
  return { signedUrl: data.signedUrl, token: data.token };
}

// Short-lived read URL for viewing/downloading an upload directly from
// Donna's own storage — the file library previously only linked out for
// real Drive files, leaving anything uploaded through the app unclickable.
export async function createSignedDownloadUrl(path: string): Promise<string> {
  const client = getSupabaseClient();
  const { data, error } = await client.storage.from(BUCKET).createSignedUrl(path, 300);
  if (error) {
    throw new Error(`Supabase storage error: ${error.message}`);
  }
  return data.signedUrl;
}

export async function downloadUpload(path: string): Promise<Buffer> {
  const client = getSupabaseClient();
  const { data, error } = await client.storage.from(BUCKET).download(path);
  if (error) {
    throw new Error(`Supabase storage download error: ${error.message}`);
  }
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function createUpload(input: {
  storagePath: string;
  kind: UploadKind;
  classId: number | null;
  originalFilename: string;
}): Promise<Upload> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client
      .from("uploads")
      .insert({
        storage_path: input.storagePath,
        kind: input.kind,
        class_id: input.classId,
        original_filename: input.originalFilename,
      })
      .select()
      .single()
  );

  if (error) {
    throw new Error(`Supabase insert error: ${error.message}`);
  }
  return rowToUpload(data);
}

export async function getUpload(id: number): Promise<Upload | null> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client.from("uploads").select("*").eq("id", id).maybeSingle()
  );

  if (error) {
    throw new Error(`Supabase read error: ${error.message}`);
  }
  return data ? rowToUpload(data) : null;
}

export async function updateUpload(
  id: number,
  fields: Partial<Pick<Upload, "status" | "transcript" | "notes" | "error">>
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (fields.status !== undefined) update.status = fields.status;
  if (fields.transcript !== undefined) update.transcript = fields.transcript;
  if (fields.notes !== undefined) update.notes = fields.notes;
  if (fields.error !== undefined) update.error = fields.error;

  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("uploads").update(update).eq("id", id)
  );

  if (error) {
    throw new Error(`Supabase update error: ${error.message}`);
  }
}

export async function getUploadsForClass(classId: number): Promise<Upload[]> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client
      .from("uploads")
      .select("*")
      .eq("class_id", classId)
      .order("created_at", { ascending: false })
  );

  if (error) {
    throw new Error(`Supabase read error: ${error.message}`);
  }
  return (data ?? []).map(rowToUpload);
}

export async function getGeneralUploads(): Promise<Upload[]> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client
      .from("uploads")
      .select("*")
      .is("class_id", null)
      .order("created_at", { ascending: false })
  );

  if (error) {
    throw new Error(`Supabase read error: ${error.message}`);
  }
  return (data ?? []).map(rowToUpload);
}

export async function getRecentUploads(limit: number): Promise<Upload[]> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client
      .from("uploads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit)
  );

  if (error) {
    throw new Error(`Supabase read error: ${error.message}`);
  }
  return (data ?? []).map(rowToUpload);
}
