import type { NavVisibility } from "../config.js";
import type { IpoFiling } from "../ipos/store.js";
import type { FollowedCompany } from "../ipos/followedCompanies.js";
import { escapeHtml } from "../util/html.js";
import { renderLayout } from "./layout.js";

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
    <div class="card" style="margin-bottom: var(--sp-3);">
      <h1 class="section-title">Following</h1>
      ${
        followedCompanies.length === 0
          ? `<p class="empty">Not following any companies yet — use the Follow button below a filing, or ask Donna in chat.</p>`
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

function renderIpoBadges(filing: IpoFiling): string {
  const badges: string[] = [];
  if (filing.isSpac) {
    badges.push(`<span class="day-badge-pill" style="color:var(--text-secondary); background:var(--sidebar-bg);">SPAC</span>`);
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

  return `
    <details class="newsletter">
      <summary>
        <div class="newsletter-subject">${escapeHtml(filing.companyName)}${filing.ticker ? ` (${escapeHtml(filing.ticker)})` : ""}</div>
        <div class="newsletter-sender">Filed ${escapeHtml(formatDate(filing.filedDate))}</div>
        ${renderIpoBadges(filing)}
      </summary>
      <div class="news-expanded">
        <h1 class="section-title">Business</h1>
        <p><strong>${escapeHtml(filing.companyName)}</strong> — ${escapeHtml(filing.businessSummary ?? "Not summarized.")}</p>
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
  // Blank-check SPACs are less interesting to skim than operating companies
  // (no real business to summarize) — push them down, otherwise keep the
  // incoming filed-date order (JS sort is stable).
  const sortedFilings = [...filings].sort((a, b) => Number(a.isSpac) - Number(b.isSpac));

  const body = `
    <div class="section">
      <h1 class="page-title">IPOs</h1>
      <p class="page-sub">${filings.length} tracked</p>
    </div>
    ${renderFollowingSection(followedCompanies)}
    <div class="card">
      ${
        sortedFilings.length === 0
          ? `<p class="empty">No IPO filings tracked yet — check back after tomorrow's daily check.</p>`
          : sortedFilings.map((f) => renderFilingRow(f, followedCiks)).join("\n")
      }
    </div>`;

  return renderLayout({
    title: "Donna IPOs",
    activeTab: "ipos",
    bodyHtml: body,
    showChatFab: true,
    navVisibility,
    navOrder,
  });
}
