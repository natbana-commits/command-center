const MAX_FILE_BYTES = 25 * 1024 * 1024; // OpenAI Whisper's hard per-request limit

export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export class FileTooLargeError extends Error {}

export async function transcribeAudio(audio: Buffer, filename: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY in environment");
  }
  if (audio.byteLength > MAX_FILE_BYTES) {
    throw new FileTooLargeError(
      `File is ${(audio.byteLength / 1024 / 1024).toFixed(1)}MB, over the 25MB limit. Try a shorter recording or a more compressed format for now — splitting long files isn't supported yet.`
    );
  }

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)]), filename);
  form.append("model", "whisper-1");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Whisper API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as { text?: string };
  return data.text ?? "";
}
