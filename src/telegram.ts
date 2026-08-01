export async function sendTelegramMessage(text: string, parseMode?: "HTML"): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in environment");
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      ...(parseMode ? { parse_mode: parseMode } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API error ${res.status}: ${body}`);
  }
}

// Voice notes (and any other Telegram-hosted file) arrive as a `file_id` —
// resolving it to actual bytes is a two-step Bot API dance: getFile to
// learn the file's storage path, then a plain download from that path.
export async function downloadTelegramVoice(fileId: string): Promise<Buffer> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN in environment");
  }

  const getFileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
  if (!getFileRes.ok) {
    const body = await getFileRes.text();
    throw new Error(`Telegram getFile error ${getFileRes.status}: ${body}`);
  }
  const getFileData = (await getFileRes.json()) as { result?: { file_path?: string } };
  const filePath = getFileData.result?.file_path;
  if (!filePath) {
    throw new Error("Telegram getFile response had no file_path");
  }

  const downloadRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
  if (!downloadRes.ok) {
    throw new Error(`Telegram file download error ${downloadRes.status}`);
  }
  return Buffer.from(await downloadRes.arrayBuffer());
}
