import crypto from "node:crypto";
import { getPlaidClient } from "./plaidClient.js";
import { getOrFetch } from "../util/cache.js";

const MAX_TOKEN_AGE_SECONDS = 5 * 60;

function base64UrlDecode(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

interface ParsedJwt {
  header: { alg?: string; kid?: string };
  payload: { iat?: number; request_body_sha256?: string };
  signature: Buffer;
  signedContent: string;
}

function parseJwt(token: string): ParsedJwt | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(base64UrlDecode(parts[0]).toString("utf8"));
    const payload = JSON.parse(base64UrlDecode(parts[1]).toString("utf8"));
    const signature = base64UrlDecode(parts[2]);
    return { header, payload, signature, signedContent: `${parts[0]}.${parts[1]}` };
  } catch {
    return null;
  }
}

// Plaid's JWKs rotate rarely — cached for a day via the same api_cache-
// backed helper used for Google Calendar/Tasks reads, rather than hitting
// /webhook_verification_key/get on every single webhook delivery.
async function getVerificationKey(keyId: string): Promise<crypto.JsonWebKey> {
  return getOrFetch(`plaid-webhook-key:${keyId}`, 24 * 60 * 60, async () => {
    const client = getPlaidClient();
    const response = await client.webhookVerificationKeyGet({ key_id: keyId });
    return response.data.key as unknown as crypto.JsonWebKey;
  });
}

// Plaid signs webhook deliveries with an ES256 JWT in the
// Plaid-Verification header, whose payload carries a SHA-256 hash of the
// raw request body. Verifying both the signature and that body-hash claim
// is what proves a webhook actually came from Plaid and wasn't forged or
// tampered with in transit — this receiver is otherwise unauthenticated
// (Plaid can't present the app's session cookie), so this check is the
// only thing standing between the internet and triggering a finance sync.
export async function verifyPlaidWebhook(jwtHeader: string | undefined, rawBody: string): Promise<boolean> {
  if (!jwtHeader) return false;

  const parsed = parseJwt(jwtHeader);
  if (!parsed) return false;
  const { header, payload, signature, signedContent } = parsed;

  if (header.alg !== "ES256" || !header.kid) return false;
  if (!Number.isFinite(payload.iat) || !payload.request_body_sha256) return false;

  const ageSeconds = Date.now() / 1000 - payload.iat!;
  if (ageSeconds > MAX_TOKEN_AGE_SECONDS || ageSeconds < -30) return false;

  let jwk: crypto.JsonWebKey;
  try {
    jwk = await getVerificationKey(header.kid);
  } catch {
    return false;
  }

  let publicKey: crypto.KeyObject;
  try {
    publicKey = crypto.createPublicKey({ key: jwk, format: "jwk" });
  } catch {
    return false;
  }

  // ES256 JWT signatures are the raw (r || s) concatenation, not the DER
  // encoding Node's crypto.verify expects by default for EC keys —
  // dsaEncoding: "ieee-p1363" tells it to expect the raw form instead.
  const signatureValid = crypto.verify(
    "sha256",
    Buffer.from(signedContent),
    { key: publicKey, dsaEncoding: "ieee-p1363" },
    signature
  );
  if (!signatureValid) return false;

  const bodyHash = crypto.createHash("sha256").update(rawBody, "utf8").digest("hex");
  return bodyHash === payload.request_body_sha256;
}
