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

// "primary"/"secondary"/"mixed" is about who's selling shares in this
// transaction (the company vs existing holders) — a different axis from
// isNewListing below (whether the company itself was already public
// before this filing) — named "New Shares"/"Re-sale" here specifically
// so it can't be confused with the Initial/Add-on badge.
const OFFERING_TYPE_LABELS: Record<"primary" | "secondary" | "mixed", string> = {
  primary: "New Shares",
  secondary: "Re-sale",
  mixed: "New + Re-sale",
};

function renderIpoBadges(filing: IpoFiling): string {
  const badges: string[] = [];
  if (filing.isSpac) {
    badges.push(`<span class="day-badge-pill" style="color:var(--text-secondary); background:var(--sidebar-bg);">SPAC</span>`);
  } else if (filing.isNewListing === true) {
    badges.push(`<span class="day-badge-pill" style="color:var(--hw-up); background:rgba(47,143,91,0.12);">Initial</span>`);
  } else if (filing.isNewListing === false) {
    badges.push(`<span class="day-badge-pill" style="color:var(--text-secondary); background:var(--sidebar-bg);">Add-on</span>`);
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
    <details class="ipo-row" style="background-image: linear-gradient(135deg, ${tint} 0%, var(--card) 55%);">
      <summary>
        <div class="ipo-row-icon" style="background: ${accent};">${iconTrendingUp}</div>
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
  // A genuinely new company going public (Initial) is more interesting
  // than an already-public company doing another raise (Add-on), and
  // both are more interesting than a blank-check SPAC (no real business
  // to summarize) — SPACs sort last regardless of anything else.
  // Unclassified (isNewListing null — an EDGAR lookup failure) ranks
  // alongside Add-on rather than being penalized to the very bottom for
  // a gap in the data. Filed-date order (JS sort is stable) otherwise.
  const sortedFilings = [...filings].sort((a, b) => {
    const spacDiff = Number(a.isSpac) - Number(b.isSpac);
    if (spacDiff !== 0) return spacDiff;
    return Number(a.isNewListing !== true) - Number(b.isNewListing !== true);
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
