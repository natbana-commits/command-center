import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

let cachedClient: PlaidApi | null = null;

export function getPlaidClient(): PlaidApi {
  if (cachedClient) return cachedClient;

  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const env = process.env.PLAID_ENV ?? "sandbox";

  if (!clientId || !secret) {
    throw new Error("Missing PLAID_CLIENT_ID or PLAID_SECRET in environment");
  }

  const basePath = PlaidEnvironments[env as keyof typeof PlaidEnvironments];
  if (!basePath) {
    throw new Error(`Invalid PLAID_ENV "${env}" — expected one of: ${Object.keys(PlaidEnvironments).join(", ")}`);
  }

  const configuration = new Configuration({
    basePath,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  });

  cachedClient = new PlaidApi(configuration);
  return cachedClient;
}
