export function chunkText(text: string, maxLen = 3500): string[] {
  if (text.length <= maxLen) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLen) {
    let splitAt = remaining.lastIndexOf("\n\n", maxLen);
    if (splitAt < maxLen * 0.5) {
      splitAt = remaining.lastIndexOf(". ", maxLen);
    }
    if (splitAt < maxLen * 0.5) {
      splitAt = remaining.lastIndexOf(" ", maxLen);
    }
    if (splitAt < 1) {
      splitAt = maxLen;
    }

    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}
