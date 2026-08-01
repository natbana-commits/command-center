import crypto from "node:crypto";

// Application-layer encryption for Plaid access tokens — a meaningfully
// higher-value secret than anything else this app stores (Telegram bot
// token, Google OAuth tokens), so it doesn't just rely on Supabase's own
// disk-level encryption the way everything else here does.
const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.FINANCE_ENCRYPTION_KEY;
  if (!hex) throw new Error("Missing FINANCE_ENCRYPTION_KEY in environment");
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error("FINANCE_ENCRYPTION_KEY must be 32 bytes (64 hex characters)");
  }
  return key;
}

export interface EncryptedValue {
  ciphertext: string;
  iv: string;
}

// The GCM auth tag is appended to the ciphertext (both hex-encoded) so a
// single column can hold everything needed to decrypt, rather than adding
// a third stored field just for the tag.
export function encrypt(plaintext: string): EncryptedValue {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([encrypted, authTag]).toString("hex"),
    iv: iv.toString("hex"),
  };
}

export function decrypt(value: EncryptedValue): string {
  const combined = Buffer.from(value.ciphertext, "hex");
  const authTag = combined.subarray(combined.length - 16);
  const encrypted = combined.subarray(0, combined.length - 16);
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(value.iv, "hex"));
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
