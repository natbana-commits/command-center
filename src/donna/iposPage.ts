import type { NavVisibility } from "../config.js";
import type { IpoFiling } from "../ipos/store.js";
import type { FollowedCompany } from "../ipos/followedCompanies.js";
import { escapeHtml } from "../util/html.js";
import { renderLayout } from "./layout.js";
import { iconTrendingUp } from "./icons.js";
import { tileColorForSeed } from "./tileColor.js";

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function renderFollowedRow(company: FollowedCompany): string {
  return `
    <div class="class-row">
      <span>${escapeHtml(company.companyName)}${company.ticker ? ` (${escapeHtml(company.ticker)})` : ""}</span>
      <form method="POST" action="/donna/ipos">
        <input type="hidden" name="action" value="unfollow" />
        <input type="hidden" name="cik" value="${escapeHtml(company.cik)}" />
        <button class="btn btn-danger" type="submit">Unfollow</button>
      </form>
    </div>`;
}

function renderFollowingSection(followedCompanies: FollowedCompany[]): string {
  return `
    <div class="ipo-following-card">
      <div class="ipo-following-head">
        <div class="ipo-row-icon">${iconTrendingUp}</div>
        <h1 class="section-title" style="margin:0;">Following</h1>
      </div>
      ${
        followedCompanies.length === 0
          ? `<p class="empty">Not following any companies yet. Use the Follow button below a filing, or ask Donna in chat.</p>`
          : followedCompanies.map(renderFollowedRow).join("\n")
      }
    </div>`;
}

function renderFollowToggle(filing: IpoFiling, followedCiks: Set<string>): string {
  const isFollowed = followedCiks.has(filing.cik);
  return `
    <form method="POST" action="/donna/ipos" style="margin-top: var(--sp-2);">
      <input type="hidden" name="action" value="${isFollowed ? "unfollow" : "follow"}" />
      <input type="hidden" name="cik" value="${escapeHtml(filing.cik)}" />
      <input type="hidden" name="companyName" value="${escapeHtml(filing.companyName)}" />
      ${filing.ticker ? `<input type="hidden" name="ticker" value="${escapeHtml(filing.ticker)}" />` : ""}
      <button class="btn-secondary btn-small" type="submit">${isFollowed ? "Unfollow this company" : "Follow this company"}</button>
    </form>`;
}

const OFFERING_TYPE_LABELS: Record<"primary" | "secondary" | "mixed", string> = {
  primary: "Initial",
  secondary: "Re-sale",
  mixed: "Initial + Re-sale",
};

function renderIpoBadges(filing: IpoFiling): string {
  const badges: string[] = [];
  if (filing.isSpac) {
    badges.push(`<span class="day-badge-pill" style="color:var(--text-secondary); background:var(--sidebar-bg);">SPAC</span>`);
  }
  if (filing.offeringType) {
    badges.push(`<span class="day-badge-pill" style="color:var(--accent); background:rgba(184,107,69,0.1);">${escapeHtml(OFFERING_TYPE_LABELS[filing.offeringType])}</span>`);
  }
  if (filing.industry) {
    badges.push(`<span class="day-badge-pill" style="color:var(--accent); background:rgba(184,107,69,0.1);">${escapeHtml(filing.industry)}</span>`);
  }
  if (filing.estimatedRevenue) {
    badges.push(`<span class="hint" style="margin:0;">${escapeHtml(filing.estimatedRevenue)} revenue</span>`);
  }
  return badges.length ? `<div class="ipo-badges">${badges.join("\n")}</div>` : "";
}

function renderFilingRow(filing: IpoFiling, followedCiks: Set<string>): string {
  const riskHtml = filing.riskHighlights.length
    ? `<ul>${filing.riskHighlights.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>`
    : `<p class="empty">Not summarized.</p>`;

  const { accent, tint } = tileColorForSeed(filing.companyName);
  return `
    <details class="ipo-row" style="--accent: ${accent}; --tint: ${tint};">
      <summary>
        <div class="ipo-row-icon">${iconTrendingUp}</div>
        <div class="ipo-row-body">
          <div class="ipo-row-subject">${escapeHtml(filing.companyName)}${filing.ticker ? ` (${escapeHtml(filing.ticker)})` : ""}</div>
          <div class="ipo-row-sender">Filed ${escapeHtml(formatDate(filing.filedDate))}</div>
          ${renderIpoBadges(filing)}
        </div>
      </summary>
      <div class="news-expanded" style="padding-left:0;">
        <h1 class="section-title">Business</h1>
        <p><strong>${escapeHtml(filing.companyName)}:</strong> ${escapeHtml(filing.businessSummary ?? "Not summarized.")}</p>
        <h1 class="section-title">Financials</h1>
        <p>${escapeHtml(filing.financialsSummary ?? "Not summarized.")}</p>
        <h1 class="section-title">Deal terms</h1>
        <p>${escapeHtml(filing.dealTermsSummary ?? "Not summarized.")}</p>
        <h1 class="section-title">Risk highlights</h1>
        ${riskHtml}
        <a class="news-link" href="${escapeHtml(filing.sourceUrl)}" target="_blank" rel="noopener noreferrer">Read the S-1 →</a>
        ${renderFollowToggle(filing, followedCiks)}
      </div>
    </details>`;
}

export interface IposPageData {
  filings: IpoFiling[];
  followedCompanies: FollowedCompany[];
  navVisibility: NavVisibility;
  navOrder: string[];
}

export function buildIposHtml(data: IposPageData): string {
  const { filings, followedCompanies, navVisibility, navOrder } = data;
  const followedCiks = new Set(followedCompanies.map((c) => c.cik));
  // Initial offerings (new shares from the company) are more interesting
  // than a pure secondary sale (existing holders cashing out) — push
  // secondary-only filings down first, then blank-check SPACs (no real
  // business to summarize) down within each group, otherwise keep the
  // incoming filed-date order (JS sort is stable). Unclassified
  // (offeringType null) filings rank alongside primary/mixed rather than
  // being penalized for a gap in the data.
  const sortedFilings = [...filings].sort((a, b) => {
    const offeringDiff = Number(a.offeringType === "secondary") - Number(b.offeringType === "secondary");
    if (offeringDiff !== 0) return offeringDiff;
    return Number(a.isSpac) - Number(b.isSpac);
  });

  const body = `
    <div class="section">
      <h1 class="page-title">IPOs</h1>
      <p class="page-sub">${filings.length} tracked</p>
    </div>
    ${renderFollowingSection(followedCompanies)}
    ${
      sortedFilings.length === 0
        ? `<p class="empty">No IPO filings tracked yet. Check back after tomorrow's daily check.</p>`
        : sortedFilings.map((f) => renderFilingRow(f, followedCiks)).join("\n")
    }`;

  return renderLayout({
    title: "Donna IPOs",
    activeTab: "ipos",
    bodyHtml: body,
    showChatFab: true,
    navVisibility,
    navOrder,
  });
}
