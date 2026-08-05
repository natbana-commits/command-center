import { getSupabaseClient, withSupabaseRetry } from "../supabaseClient.js";
import type { S1Summary } from "./summarize.js";

export interface IpoFiling {
  id: number;
  accessionNo: string;
  cik: string;
  companyName: string;
  ticker: string | null;
  exchange: string | null;
  filedDate: string;
  sourceUrl: string;
  industry: string | null;
  estimatedRevenue: string | null;
  isSpac: boolean;
  offeringType: "primary" | "secondary" | "mixed" | null;
  businessSummary: string | null;
  financialsSummary: string | null;
  dealTermsSummary: string | null;
  riskHighlights: string[];
}

interface IpoFilingRow {
  id: number;
  accession_no: string;
  cik: string;
  company_name: string;
  ticker: string | null;
  exchange: string | null;
  filed_date: string;
  source_url: string;
  industry: string | null;
  estimated_revenue: string | null;
  is_spac: boolean | null;
  offering_type: "primary" | "secondary" | "mixed" | null;
  business_summary: string | null;
  financials_summary: string | null;
  deal_terms_summary: string | null;
  risk_highlights: string | null;
}

function rowToFiling(row: IpoFilingRow): IpoFiling {
  return {
    id: row.id,
    accessionNo: row.accession_no,
    cik: row.cik,
    companyName: row.company_name,
    ticker: row.ticker,
    exchange: row.exchange,
    filedDate: row.filed_date,
    sourceUrl: row.source_url,
    // Older rows (summarized before these fields existed) come back null —
    // isSpac defaults to false rather than "unknown" so they sort with
    // regular filings instead of all landing in one bucket.
    industry: row.industry,
    estimatedRevenue: row.estimated_revenue,
    isSpac: row.is_spac ?? false,
    offeringType: row.offering_type,
    businessSummary: row.business_summary,
    financialsSummary: row.financials_summary,
    dealTermsSummary: row.deal_terms_summary,
    riskHighlights: row.risk_highlights ? row.risk_highlights.split("\n").filter(Boolean) : [],
  };
}

const SELECT_COLUMNS =
  "id, accession_no, cik, company_name, ticker, exchange, filed_date, source_url, industry, estimated_revenue, is_spac, offering_type, business_summary, financials_summary, deal_terms_summary, risk_highlights";

export async function getRecentIpoFilings(limit = 20): Promise<IpoFiling[]> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client.from("ipo_filings").select(SELECT_COLUMNS).order("filed_date", { ascending: false }).limit(limit)
  );

  if (error) {
    if (error.code === "PGRST205") return [];
    throw new Error(`Supabase read error: ${error.message}`);
  }
  return (data ?? []).map(rowToFiling);
}

export async function getIpoFilingById(id: number): Promise<IpoFiling | null> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client.from("ipo_filings").select(SELECT_COLUMNS).eq("id", id).maybeSingle()
  );

  if (error) {
    throw new Error(`Supabase read error: ${error.message}`);
  }
  return data ? rowToFiling(data) : null;
}

const SCAN_LIMIT = 100;

// Fetches a bounded recent window and filters in JS rather than building
// a raw PostgREST `.or()` filter out of user-controlled text (the same
// reasoning src/search/index.ts already documents — commas/parens in a
// chat-supplied company name would break an `.or()` string).
export async function getIpoFilingByCompanyOrTicker(query: string): Promise<IpoFiling | null> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client.from("ipo_filings").select(SELECT_COLUMNS).order("filed_date", { ascending: false }).limit(SCAN_LIMIT)
  );

  if (error) {
    if (error.code === "PGRST205") return null;
    throw new Error(`Supabase read error: ${error.message}`);
  }

  const needle = query.toLowerCase();
  const match = (data ?? []).find(
    (row) => row.company_name.toLowerCase().includes(needle) || (row.ticker ?? "").toLowerCase().includes(needle)
  );
  return match ? rowToFiling(match) : null;
}

export async function getProcessedAccessions(accessionNos: string[]): Promise<Set<string>> {
  if (accessionNos.length === 0) return new Set();

  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client.from("ipo_filings").select("accession_no").in("accession_no", accessionNos)
  );

  if (error) {
    if (error.code === "PGRST205") return new Set();
    throw new Error(`Supabase read error: ${error.message}`);
  }
  return new Set((data ?? []).map((row) => row.accession_no));
}

// Upsert on accession_no so re-processing an already-tracked filing (e.g.
// an on-demand chat lookup for something the daily poll already caught)
// overwrites cleanly instead of erroring on the unique constraint.
export async function saveIpoFiling(fields: {
  accessionNo: string;
  cik: string;
  companyName: string;
  ticker?: string;
  exchange?: string;
  filedDate: string;
  sourceUrl: string;
  summary: S1Summary;
}): Promise<IpoFiling> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client
      .from("ipo_filings")
      .upsert(
        {
          accession_no: fields.accessionNo,
          cik: fields.cik,
          company_name: fields.companyName,
          ticker: fields.ticker || null,
          exchange: fields.exchange || null,
          filed_date: fields.filedDate,
          source_url: fields.sourceUrl,
          industry: fields.summary.industry ?? null,
          estimated_revenue: fields.summary.estimatedRevenue ?? null,
          is_spac: fields.summary.isSpac ?? false,
          offering_type: fields.summary.offeringType ?? null,
          business_summary: fields.summary.businessSummary,
          financials_summary: fields.summary.financialsSummary,
          deal_terms_summary: fields.summary.dealTermsSummary,
          risk_highlights: (fields.summary.riskHighlights ?? []).join("\n"),
        },
        { onConflict: "accession_no" }
      )
      .select(SELECT_COLUMNS)
      .single()
  );

  if (error || !data) {
    throw new Error(`Supabase insert error: ${error?.message ?? "no row returned"}`);
  }
  return rowToFiling(data);
}
