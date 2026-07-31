import { getAccessToken } from "../google/auth.js";
import { sanitizeNewsletterHtml } from "./sanitize.js";

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailPart {
  partId?: string;
  mimeType: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: GmailPart[];
}

interface GmailMessage {
  id: string;
  payload: GmailPart;
  internalDate: string;
}

export interface NewsletterEmail {
  id: string;
  subject: string;
  sender: string;
  receivedAt: Date;
  html: string;
}

function findHeader(headers: GmailHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function findHtmlPart(part: GmailPart): GmailPart | null {
  if (part.mimeType === "text/html" && part.body?.data) {
    return part;
  }
  for (const child of part.parts ?? []) {
    const found = findHtmlPart(child);
    if (found) return found;
  }
  return null;
}

function collectInlineImageParts(part: GmailPart, acc: GmailPart[] = []): GmailPart[] {
  const contentId = findHeader(part.headers, "Content-ID");
  if (contentId && part.body?.attachmentId) {
    acc.push(part);
  }
  for (const child of part.parts ?? []) {
    collectInlineImageParts(child, acc);
  }
  return acc;
}

async function fetchAttachmentAsBase64(
  accessToken: string,
  messageId: string,
  attachmentId: string
): Promise<string> {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) {
    throw new Error(`Gmail attachment fetch error ${response.status}`);
  }
  const data = (await response.json()) as { data?: string };
  if (!data.data) {
    throw new Error("Gmail attachment response missing data");
  }
  // Attachments come back base64url-encoded; data: URIs need standard base64.
  return Buffer.from(data.data, "base64url").toString("base64");
}

// Newsletters usually host images remotely (Substack, Beehiiv, Mailchimp,
// etc.), but a few embed them as attachments referenced via cid: — inline
// those as data URIs so they render wherever this HTML ends up.
async function inlineImages(
  accessToken: string,
  messageId: string,
  root: GmailPart,
  html: string
): Promise<string> {
  let result = html;

  for (const part of collectInlineImageParts(root)) {
    const contentId = findHeader(part.headers, "Content-ID").replace(/[<>]/g, "");
    if (!contentId || !part.body?.attachmentId) continue;

    try {
      const base64 = await fetchAttachmentAsBase64(accessToken, messageId, part.body.attachmentId);
      result = result.replaceAll(`cid:${contentId}`, `data:${part.mimeType};base64,${base64}`);
    } catch {
      // Leave the cid: reference as-is rather than failing the whole email
      // over one inline image.
    }
  }

  return result;
}

export async function fetchNewsletters(query: string, maxResults = 20): Promise<NewsletterEmail[]> {
  const accessToken = await getAccessToken();

  const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  listUrl.searchParams.set("q", query);
  listUrl.searchParams.set("maxResults", String(maxResults));

  const listResponse = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!listResponse.ok) {
    const body = await listResponse.text();
    throw new Error(`Gmail list error ${listResponse.status}: ${body}`);
  }
  const listData = (await listResponse.json()) as { messages?: { id: string }[] };
  const ids = (listData.messages ?? []).map((m) => m.id);

  const newsletters: NewsletterEmail[] = [];

  for (const id of ids) {
    const messageResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!messageResponse.ok) continue;

    const message = (await messageResponse.json()) as GmailMessage;
    const htmlPart = findHtmlPart(message.payload);
    if (!htmlPart?.body?.data) continue;

    let html = Buffer.from(htmlPart.body.data, "base64url").toString("utf-8");
    html = await inlineImages(accessToken, id, message.payload, html);
    html = sanitizeNewsletterHtml(html);

    newsletters.push({
      id: message.id,
      subject: findHeader(message.payload.headers, "Subject"),
      sender: findHeader(message.payload.headers, "From"),
      receivedAt: new Date(Number(message.internalDate)),
      html,
    });
  }

  return newsletters;
}
