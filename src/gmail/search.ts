import { getAccessToken } from "../google/auth.js";

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailMessage {
  id: string;
  snippet?: string;
  payload?: { headers?: GmailHeader[] };
}

export interface EmailSearchResult {
  subject: string;
  sender: string;
  date: string;
  snippet: string;
}

function findHeader(headers: GmailHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export async function searchEmails(query: string, maxResults = 10): Promise<EmailSearchResult[]> {
  const accessToken = await getAccessToken();

  const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  listUrl.searchParams.set("q", query);
  listUrl.searchParams.set("maxResults", String(maxResults));

  const listResponse = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!listResponse.ok) {
    const body = await listResponse.text();
    throw new Error(`Gmail search error ${listResponse.status}: ${body}`);
  }
  const listData = (await listResponse.json()) as { messages?: { id: string }[] };
  const ids = (listData.messages ?? []).map((m) => m.id);

  const results = await Promise.all(
    ids.map(async (id) => {
      const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`);
      url.searchParams.set("format", "metadata");
      url.searchParams.append("metadataHeaders", "Subject");
      url.searchParams.append("metadataHeaders", "From");
      url.searchParams.append("metadataHeaders", "Date");

      const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) return null;

      const message = (await response.json()) as GmailMessage;
      return {
        subject: findHeader(message.payload?.headers, "Subject"),
        sender: findHeader(message.payload?.headers, "From"),
        date: findHeader(message.payload?.headers, "Date"),
        snippet: message.snippet ?? "",
      };
    })
  );

  return results.filter((r): r is EmailSearchResult => r !== null);
}
