import type { DailyContext } from "../chat/dailyContext.js";
import type { DashboardConfig, HomeWidgetId } from "../config.js";
import type { Contact } from "../contacts/store.js";
import type { ClassFolder } from "../drive/classFolders.js";
import type { StoredNewsletter } from "../gmail/store.js";
import type { Reminder } from "../google/tasks.js";
import type { ReminderNotification } from "../reminders/notifications.js";
import type { ReminderGroup } from "../reminders/groups.js";
import type { Upload } from "../storage/uploads.js";
import type { IpoFiling } from "../ipos/store.js";
import type { PlaidAccount } from "../finance/accounts.js";
import type { BalancePoint } from "../finance/balanceHistory.js";
import type { CalendarEvent } from "../calendar.js";
import type { Quote } from "../markets/quotes.js";
import type { EconomicEvent } from "../markets/economicEvents.js";
import { escapeHtml } from "../util/html.js";
import { formatRelativeTime, withTimeSuffix, localDateKey } from "../util/time.js";
import { renderLayout } from "./layout.js";
import {
  iconBell,
  iconCalendar,
  iconFolder,
  iconUser,
  iconTrendingUp,
  iconWallet,
  iconGraduationCap,
  iconClock,
  iconBarChart,
  iconNewspaper,
  iconUpload,
  iconScan,
  iconMic,
} from "./icons.js";
import { renderLineChart } from "./charts.js";
import { effectiveDue, formatDue, hasTime } from "./remindersPage.js";
import { daysAwayLabel } from "./dayBadge.js";
import { storyAnchorId } from "./newsPage.js";

// Nav destination each Home tile links to when clicked outside its own
// interactive controls (dropdown/toggle/buttons/links) — see
// navigateCard() in CLIENT_SCRIPT.
const CARD_HREFS: Record<HomeWidgetId, string> = {
  "recent-activity": "/donna/files",
  upcoming: "/donna/calendar",
  reminders: "/donna/reminders",
  contacts: "/donna/contacts",
  files: "/donna/files",
  classes: "/donna/school",
  ipos: "/donna/ipos",
  finances: "/donna/finances",
  markets: "/donna/settings#settings-watchlist",
  "econ-events": "/donna/calendar",
  news: "/donna/news",
};

function formatMoney(amount: number, currency: string | null): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency ?? "USD" }).format(amount);
}

function formatFullDate(day: string, timezone: string): string {
  // `day` is a plain YYYY-MM-DD key with no time component; anchor it at
  // noon before formatting so timezone conversion can't roll it to the
  // adjacent calendar date.
  return new Date(`${day}T12:00:00`).toLocaleDateString("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function greetingWord(timezone: string): string {
  const hour = Number(
    new Date().toLocaleTimeString("en-US", { timeZone: timezone, hour: "numeric", hour12: false })
  );
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// Compact "Xd" / "1d late" / "today" label — same day-diff math as the big
// day-badge component, just rendered as plain inline text since these
// widgets are far too condensed for the full badge.
function compactDayLabel(dateKey: string): string {
  const label = daysAwayLabel(dateKey);
  if (label.big === "Today") return "today";
  return label.overdue ? `${label.big}d late` : `${label.big}d`;
}

function widgetHeadIcon(icon: string): string {
  return `<div class="hw-icon">${icon}</div>`;
}

// ---------------------------------------------------------------------
// Reminders — the one pinned double-height "priority" widget. A group
// filter (populated from Nathan's actual reminder groups, not a fixed
// set) lets him narrow the list without leaving Home.
// ---------------------------------------------------------------------
function renderRemindersTile(
  reminders: Reminder[],
  googleConfigured: boolean,
  notifications: Map<string, ReminderNotification>,
  timezone: string,
  reminderGroups: ReminderGroup[],
  groupLinks: Map<string, number>
): string {
  const href = CARD_HREFS.reminders;
  if (!googleConfigured) {
    return `
      <div class="hw-tile hw-gw-reminders" data-tint="reminders" onclick="navigateCard(event, '${href}')">
        <div class="hw-pad"><div class="hw-head"><div class="hw-head-left">${widgetHeadIcon(iconBell)}<div class="hw-title">Reminders</div></div></div>
        <p class="empty">Not connected yet — finish Google setup to use reminders.</p></div>
      </div>`;
  }

  const withDue = reminders
    .map((r) => ({ r, due: effectiveDue(r, notifications.get(r.id)) }))
    .sort((a, b) => {
      if (!a.due && !b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return new Date(a.due).getTime() - new Date(b.due).getTime();
    });

  const overdueCount = withDue.filter((x) => x.due && new Date(x.due).getTime() < Date.now()).length;
  const upcomingCount = withDue.length - overdueCount;

  const groupById = new Map(reminderGroups.map((g) => [g.id, g]));
  // Every group starts active — a group chip narrows the list down rather
  // than the old single-select dropdown's "pick exactly one group at a
  // time," so you can see e.g. two classes' deadlines together, or a
  // class + Personal, whatever combination is useful right now.
  const chipsHtml = reminderGroups
    .map(
      (g) =>
        `<button type="button" class="hw-group-chip hw-group-chip-active" data-group="${g.id}" style="--chip-color:${escapeHtml(g.color)};" onclick="toggleReminderGroupChip(this)">${escapeHtml(g.name)}</button>`
    )
    .join("");

  const rowsHtml =
    withDue.length === 0
      ? `<p class="empty">No reminders.</p>`
      : withDue
          .slice(0, 8)
          .map(({ r, due }) => {
            const group = groupById.get(groupLinks.get(r.id) ?? -1);
            const dateKey = due ? localDateKey(new Date(due), timezone) : null;
            const timeLabel = due && hasTime(due, timezone) ? new Date(due).toLocaleTimeString("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" }) : "";
            const dayLabel = dateKey ? compactDayLabel(dateKey) : "";
            const overdue = due ? new Date(due).getTime() < Date.now() : false;
            return `
              <div class="hw-row" data-group="${group ? group.id : ""}">
                <div class="hw-row-main">
                  <div class="hw-row-name">${escapeHtml(withTimeSuffix(r.title, null))}</div>
                  ${group ? `<div class="hw-row-sub" style="color:${escapeHtml(group.color)};">${escapeHtml(group.name)}</div>` : ""}
                </div>
                ${timeLabel ? `<div class="hw-row-time">${escapeHtml(timeLabel)}</div>` : ""}
                <div class="hw-row-val"${overdue ? ' style="color:var(--hw-reminders);"' : ""}>${escapeHtml(dayLabel)}</div>
              </div>`;
          })
          .join("\n");

  return `
    <div class="hw-tile hw-gw-reminders" data-tint="reminders" onclick="navigateCard(event, '${href}')">
      <div class="hw-pad">
        <div class="hw-head">
          <div class="hw-head-left">${widgetHeadIcon(iconBell)}<div class="hw-title">Reminders</div></div>
        </div>
        <div class="hw-kpi-row"><div class="hw-kpi">${overdueCount}</div><div class="hw-trend">overdue · ${upcomingCount} upcoming</div></div>
        ${reminderGroups.length > 0 ? `<div class="hw-group-chips">${chipsHtml}</div>` : ""}
        <div class="hw-rows">${rowsHtml}</div>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------
// Finances — Fidelity (or the first investment account found) balance +
// a real sparkline, Week/Month toggle. Falls back to the old total-cash
// summary when there's no investment account to chart.
// ---------------------------------------------------------------------
export interface FinanceAccountSummary {
  name: string;
  balanceLabel: string;
  trendLabel: string;
  trendUp: boolean;
  changeLabel: string;
  weekChartHtml: string;
  monthChartHtml: string;
  monthAvailable: boolean;
  emptyMessage: string | null;
}

// Shared by the initial server render (renderFinancesTile below) and the
// account-summary JSON endpoint the account picker calls into — one place
// computing the balance/trend/chart so switching accounts client-side
// can't drift from what a fresh page load would show for that account.
export function computeFinanceAccountSummary(
  account: PlaidAccount,
  weekHistory: BalancePoint[],
  monthHistory: BalancePoint[]
): FinanceAccountSummary {
  const currency = account.isoCurrencyCode;
  const balanceLabel = formatMoney(account.currentBalance ?? 0, currency);

  if (weekHistory.length < 2) {
    return {
      name: account.name,
      balanceLabel,
      trendLabel: "",
      trendUp: true,
      changeLabel: "",
      weekChartHtml: "",
      monthChartHtml: "",
      monthAvailable: false,
      emptyMessage: "Balance history fills in once a few more days are recorded.",
    };
  }

  const change = weekHistory[weekHistory.length - 1].balance - weekHistory[0].balance;
  const changePct = weekHistory[0].balance !== 0 ? (change / weekHistory[0].balance) * 100 : 0;
  const changeSign = change >= 0 ? "+" : "";
  const chartHtml = (points: BalancePoint[]) =>
    `<div style="--accent: var(--hw-finance);">${renderLineChart(points.map((p) => ({ label: p.date, value: p.balance })), { width: 240, height: 60 })}</div>`;
  const monthAvailable = monthHistory.length >= 2;

  return {
    name: account.name,
    balanceLabel,
    trendLabel: `${changeSign}${changePct.toFixed(2)}%`,
    trendUp: change >= 0,
    changeLabel: `${changeSign}${formatMoney(Math.abs(change), currency)}`,
    weekChartHtml: chartHtml(weekHistory),
    monthChartHtml: monthAvailable ? chartHtml(monthHistory) : "",
    monthAvailable,
    emptyMessage: null,
  };
}

function renderFinancesTile(
  fidelityAccount: PlaidAccount | null,
  fidelityBalanceWeek: BalancePoint[],
  fidelityBalanceMonth: BalancePoint[],
  totalCash: number,
  accountCount: number,
  financeAccountOptions: { accountId: string; label: string }[]
): string {
  const href = CARD_HREFS.finances;
  const wrapOpen = `<div class="hw-tile hw-gw-finances" data-tint="finance" onclick="navigateCard(event, '${href}')"><div class="hw-pad">`;
  const wrapClose = `</div></div>`;

  const accountSelect =
    financeAccountOptions.length > 0
      ? `<select class="hw-mini-select" onchange="setFinAccount(this)">${
          !fidelityAccount ? `<option value="" selected disabled>Choose an account</option>` : ""
        }${financeAccountOptions
          .map((o) => `<option value="${escapeHtml(o.accountId)}"${fidelityAccount && o.accountId === fidelityAccount.accountId ? " selected" : ""}>${escapeHtml(o.label)}</option>`)
          .join("")}</select>`
      : "";

  const summary: FinanceAccountSummary = fidelityAccount
    ? computeFinanceAccountSummary(fidelityAccount, fidelityBalanceWeek, fidelityBalanceMonth)
    : {
        name: "Finances",
        balanceLabel: formatMoney(totalCash, "USD"),
        trendLabel: `${accountCount} account${accountCount === 1 ? "" : "s"}`,
        trendUp: true,
        changeLabel: "",
        weekChartHtml: "",
        monthChartHtml: "",
        monthAvailable: false,
        emptyMessage: financeAccountOptions.length > 0 ? "Pick an account above to see its balance trend." : "Link an account to see a balance trend here.",
      };

  // Always render the same skeleton (toggle/charts/stat-row present but
  // hidden when there's nothing to show yet) — the account picker swaps
  // an account with full history in for one without (or vice versa)
  // client-side, and needs every element to already exist to update.
  const hasChart = !summary.emptyMessage;
  return `${wrapOpen}
    <div class="hw-head">
      <div class="hw-head-left" id="hw-fin-name">${widgetHeadIcon(iconWallet)}<div class="hw-title">${escapeHtml(summary.name)}</div></div>
      ${accountSelect}
    </div>
    <div class="hw-head" style="margin-top:2px; display:${hasChart ? "" : "none"};" id="hw-fin-toggle-row">
      <div class="hw-fin-toggle" id="hw-fin-toggle">
        <button type="button" class="hw-fin-toggle-btn hw-fin-toggle-active" data-range="week" onclick="setFinRange(this, 'week')">Week</button>
        ${summary.monthAvailable ? `<button type="button" class="hw-fin-toggle-btn" data-range="month" onclick="setFinRange(this, 'month')">Month</button>` : ""}
      </div>
    </div>
    <div class="hw-kpi-row"><div class="hw-kpi" id="hw-fin-balance">${escapeHtml(summary.balanceLabel)}</div><div class="hw-trend" id="hw-fin-trend" style="${summary.trendUp ? "color:var(--hw-up);" : "color:var(--hw-down);"}">${escapeHtml(summary.trendLabel)}</div></div>
    <div class="hw-fin-chart" data-range-view="week" id="hw-fin-chart-week" style="display:${hasChart ? "" : "none"};">${summary.weekChartHtml}</div>
    <div class="hw-fin-chart" data-range-view="month" id="hw-fin-chart-month" style="display:none;">${summary.monthChartHtml}</div>
    <div class="hw-fin-stat-row" id="hw-fin-stat-row" style="display:${hasChart ? "" : "none"};"><span>Change</span><span id="hw-fin-change" style="${summary.trendUp ? "color:var(--hw-up);" : "color:var(--hw-down);"} font-weight:700;">${escapeHtml(summary.changeLabel)}</span></div>
    <p class="empty" style="margin-top:auto; display:${hasChart ? "none" : ""};" id="hw-fin-empty">${escapeHtml(summary.emptyMessage ?? "")}</p>
  ${wrapClose}`;
}

// ---------------------------------------------------------------------
// Markets
// ---------------------------------------------------------------------
function renderMarketsTile(quotes: Quote[]): string {
  const href = CARD_HREFS.markets;
  const headHtml = `<div class="hw-head-left">${widgetHeadIcon(iconTrendingUp)}<div class="hw-title">Markets</div></div>`;
  if (quotes.length === 0) {
    return `
      <div class="hw-tile hw-gw-markets" data-tint="markets" onclick="navigateCard(event, '${href}')">
        <div class="hw-pad"><div class="hw-head">${headHtml}</div><p class="empty">No quotes yet — add tickers to your Watchlist in Settings.</p></div>
      </div>`;
  }
  const top = [...quotes].sort((a, b) => b.changePercent - a.changePercent)[0];
  const rows = quotes
    .slice(0, 4)
    .map((q) => {
      const up = q.changePercent >= 0;
      const changeLabel = `${up ? "+" : ""}${q.changePercent.toFixed(2)}%`;
      return `
        <div class="hw-row">
          <div class="hw-row-main"><div class="hw-row-name">${escapeHtml(q.symbol)}</div></div>
          <div class="hw-row-val" style="color:${up ? "var(--hw-up)" : "var(--hw-down)"};">${escapeHtml(formatMoney(q.price, "USD"))} · ${escapeHtml(changeLabel)}</div>
        </div>`;
    })
    .join("\n");
  return `
    <div class="hw-tile hw-gw-markets" data-tint="markets" onclick="navigateCard(event, '${href}')">
      <div class="hw-pad">
        <div class="hw-head">${headHtml}</div>
        <div class="hw-kpi-row"><div class="hw-kpi" style="color:${top.changePercent >= 0 ? "var(--hw-up)" : "var(--hw-down)"};">${top.changePercent >= 0 ? "+" : ""}${top.changePercent.toFixed(2)}%</div><div class="hw-trend">${escapeHtml(top.symbol)} leads</div></div>
        <div class="hw-rows">${rows}</div>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------
// Upcoming (mini today/tomorrow agenda)
// ---------------------------------------------------------------------
function formatEventDuration(e: CalendarEvent): string | null {
  if (!e.end) return null;
  const minutes = Math.round((e.end.getTime() - e.start.getTime()) / 60000);
  if (minutes <= 0) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem === 0 ? `${hours}h` : `${hours}h ${rem}m`;
}

function renderUpcomingTile(todayEvents: CalendarEvent[], tomorrowEvents: CalendarEvent[], timezone: string): string {
  const href = CARD_HREFS.upcoming;
  const headHtml = `<div class="hw-head-left">${widgetHeadIcon(iconCalendar)}<div class="hw-title">Upcoming</div></div>`;
  const eventRow = (e: CalendarEvent) => {
    const timeLabel = e.start.toLocaleTimeString("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" });
    const duration = formatEventDuration(e);
    return `
      <div class="hw-row">
        <div class="hw-row-main">
          <div class="hw-row-name">${escapeHtml(e.summary)}</div>
          ${duration ? `<div class="hw-row-sub">${escapeHtml(duration)}${e.location ? ` · ${escapeHtml(e.location)}` : ""}</div>` : e.location ? `<div class="hw-row-sub">${escapeHtml(e.location)}</div>` : ""}
        </div>
        <div class="hw-row-time">${escapeHtml(timeLabel)}</div>
      </div>`;
  };
  const todayHtml = todayEvents.length ? todayEvents.slice(0, 2).map(eventRow).join("\n") : `<p class="empty" style="margin:0;">Nothing today.</p>`;
  const tomorrowHtml = tomorrowEvents.length ? tomorrowEvents.slice(0, 2).map(eventRow).join("\n") : "";
  return `
    <div class="hw-tile hw-gw-upcoming" data-tint="upcoming" onclick="navigateCard(event, '${href}')">
      <div class="hw-pad">
        <div class="hw-head">${headHtml}</div>
        <div class="hw-kpi-row"><div class="hw-kpi">${todayEvents.length}</div><div class="hw-trend">today</div></div>
        <div class="hw-rows">${todayHtml}</div>
        ${tomorrowHtml ? `<div class="hw-row-divider">Tomorrow</div><div class="hw-rows">${tomorrowHtml}</div>` : ""}
      </div>
    </div>`;
}

// ---------------------------------------------------------------------
// Classes — up to 6 tiles, just the course names, linking into School.
// ---------------------------------------------------------------------
function renderClassesTile(classFolders: ClassFolder[]): string {
  const href = CARD_HREFS.classes;
  const headHtml = `<div class="hw-head-left">${widgetHeadIcon(iconGraduationCap)}<div class="hw-title">Classes</div></div>`;
  if (classFolders.length === 0) {
    return `
      <div class="hw-tile hw-gw-classes" data-tint="classes" onclick="navigateCard(event, '${href}')">
        <div class="hw-pad"><div class="hw-head">${headHtml}</div><p class="empty">No classes set up yet — add one in Settings.</p></div>
      </div>`;
  }
  const realTiles = classFolders
    .slice(0, 6)
    .map((c) => `<a class="hw-class-tile" href="/donna/school?classId=${c.id}"><div class="hw-class-tile-code">${escapeHtml(c.className)}</div></a>`)
    .join("\n");
  const emptySlots = Math.max(0, 6 - classFolders.length);
  const emptyTiles = Array.from({ length: emptySlots > 0 && classFolders.length < 6 ? emptySlots : 0 })
    .map(() => `<a class="hw-class-tile hw-class-tile-empty" href="/donna/settings#settings-classes">+</a>`)
    .join("\n");
  return `
    <div class="hw-tile hw-gw-classes" data-tint="classes" onclick="navigateCard(event, '${href}')">
      <div class="hw-pad">
        <div class="hw-head">${headHtml}</div>
        <div class="hw-class-grid">${realTiles}${emptyTiles}</div>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------
// IPOs — filing/SPAC counts, real industry mix, top (most recent) filing.
// ---------------------------------------------------------------------
const IPO_MIX_COLORS = ["var(--hw-ipo-1)", "var(--hw-ipo-2)", "var(--hw-ipo-3)"];

function renderIposTile(filings: IpoFiling[]): string {
  const href = CARD_HREFS.ipos;
  const headHtml = `<div class="hw-head-left">${widgetHeadIcon(iconTrendingUp)}<div class="hw-title">IPOs</div></div>`;
  if (filings.length === 0) {
    return `
      <div class="hw-tile hw-gw-ipos" data-tint="ipos" onclick="navigateCard(event, '${href}')">
        <div class="hw-pad"><div class="hw-head">${headHtml}</div><p class="empty">No new IPO filings tracked yet.</p></div>
      </div>`;
  }

  const spacCount = filings.filter((f) => f.isSpac).length;
  const classified = filings.filter((f) => f.industry);
  const counts = new Map<string, number>();
  for (const f of classified) counts.set(f.industry!, (counts.get(f.industry!) ?? 0) + 1);
  const sortedIndustries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const topIndustries = sortedIndustries.slice(0, 3);
  // The top 3 rarely account for every classified filing — anything past
  // them used to just leave an uncolored, invisible-in-light-mode gap in
  // the bar (percentages that never summed to 100%). Rolling the rest
  // into a labeled "Other" segment keeps the bar visually whole and
  // still adds up to the real total.
  const otherCount = sortedIndustries.slice(3).reduce((sum, [, count]) => sum + count, 0);
  const barSegments: { label: string; count: number; color: string }[] = topIndustries.map(([name, count], i) => ({
    label: name,
    count,
    color: IPO_MIX_COLORS[i],
  }));
  if (otherCount > 0) barSegments.push({ label: "Other", count: otherCount, color: "var(--text-muted)" });

  const barHtml =
    classified.length > 0
      ? `
    <div class="hw-ipo-bar">${barSegments.map((s) => `<div style="width:${((s.count / classified.length) * 100).toFixed(0)}%; background:${s.color};"></div>`).join("")}</div>
    <div class="hw-ipo-legend">${barSegments
      .map((s) => `<div class="hw-ipo-legend-item"><span class="hw-ipo-legend-dot" style="background:${s.color};"></span>${escapeHtml(s.label)} ${Math.round((s.count / classified.length) * 100)}%</div>`)
      .join("")}</div>`
      : "";

  const top = filings[0];
  const topDateLabel = new Date(`${top.filedDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const topChip = top.isSpac ? "SPAC" : top.industry ?? "Filing";

  return `
    <div class="hw-tile hw-gw-ipos" data-tint="ipos" onclick="navigateCard(event, '${href}')">
      <div class="hw-pad">
        <div class="hw-head">${headHtml}</div>
        <div class="hw-ipo-stats">
          <div class="hw-ipo-stat"><div class="hw-ipo-stat-num">${filings.length}</div><div class="hw-ipo-stat-label">filings</div></div>
          <div class="hw-ipo-stat"><div class="hw-ipo-stat-num">${spacCount}</div><div class="hw-ipo-stat-label">SPACs</div></div>
        </div>
        ${barHtml}
        <div class="hw-ipo-best">
          <div class="hw-ipo-best-label">Most recent</div>
          <div class="hw-ipo-best-row"><span class="hw-ipo-best-name">${escapeHtml(top.companyName)}</span><span class="hw-ipo-best-chip">${escapeHtml(topChip)}</span></div>
          <div class="hw-ipo-best-meta">${escapeHtml(topDateLabel)}</div>
        </div>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------
// Files — quick actions instead of a deadlines list (that content moved
// into Classes' "click through to School" + the Files page itself).
// ---------------------------------------------------------------------
function renderFilesTile(): string {
  const headHtml = `<div class="hw-head-left">${widgetHeadIcon(iconFolder)}<div class="hw-title">Files</div></div>`;
  return `
    <div class="hw-tile hw-gw-files" data-tint="files">
      <div class="hw-pad">
        <div class="hw-head">${headHtml}</div>
        <div class="hw-file-actions">
          <a class="hw-file-action-btn" data-action-tint="markets" href="/donna/files#file-file">${iconUpload}Upload</a>
          <a class="hw-file-action-btn" data-action-tint="finance" href="/donna/files#photo-file">${iconScan}Scan</a>
          <a class="hw-file-action-btn" data-action-tint="ipos" href="/donna/files#lecture-file">${iconMic}Transcribe</a>
        </div>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------
// Recent Activity
// ---------------------------------------------------------------------
function uploadLabel(u: Upload): string {
  const kindLabel = u.kind === "lecture" ? "Transcript" : "Scan";
  return `${kindLabel}: ${u.originalFilename}`;
}

function renderRecentActivityTile(uploads: Upload[]): string {
  const href = CARD_HREFS["recent-activity"];
  const headHtml = `<div class="hw-head-left">${widgetHeadIcon(iconClock)}<div class="hw-title">Recent Activity</div></div>`;
  const rows = uploads.length
    ? uploads
        .slice(0, 4)
        .map(
          (u) =>
            `<div class="hw-row"><div class="hw-row-main"><div class="hw-row-name">${escapeHtml(uploadLabel(u))}</div></div><div class="hw-row-time">${escapeHtml(formatRelativeTime(u.createdAt))}</div></div>`
        )
        .join("\n")
    : `<p class="empty">No recent activity.</p>`;
  return `
    <div class="hw-tile hw-gw-activity" data-tint="activity" onclick="navigateCard(event, '${href}')">
      <div class="hw-pad">
        <div class="hw-head">${headHtml}</div>
        <div class="hw-kpi-row"><div class="hw-kpi">${uploads.length}</div><div class="hw-trend">recent</div></div>
        <div class="hw-rows">${rows}</div>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------
// Econ Events
// ---------------------------------------------------------------------
function renderEconEventsTile(events: EconomicEvent[]): string {
  const href = CARD_HREFS["econ-events"];
  const headHtml = `<div class="hw-head-left">${widgetHeadIcon(iconBarChart)}<div class="hw-title">Econ Events</div></div>`;
  if (events.length === 0) {
    return `
      <div class="hw-tile hw-gw-econ" data-tint="econ" onclick="navigateCard(event, '${href}')">
        <div class="hw-pad"><div class="hw-head">${headHtml}</div><p class="empty">No upcoming events seeded.</p></div>
      </div>`;
  }
  const next = events[0];
  const rows = events
    .slice(0, 2)
    .map((e) => {
      const dateLabel = new Date(`${e.eventDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return `<div class="hw-row"><div class="hw-row-main"><div class="hw-row-name">${escapeHtml(e.eventName)}</div></div><div class="hw-row-val">${escapeHtml(dateLabel)}</div></div>`;
    })
    .join("\n");
  return `
    <div class="hw-tile hw-gw-econ" data-tint="econ" onclick="navigateCard(event, '${href}')">
      <div class="hw-pad">
        <div class="hw-head">${headHtml}</div>
        <div class="hw-kpi-row"><div class="hw-kpi">${compactDayLabel(next.eventDate)}</div><div class="hw-trend">${escapeHtml(next.eventName)}</div></div>
        <div class="hw-rows">${rows}</div>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------
function renderContactsTile(contacts: Contact[]): string {
  const href = CARD_HREFS.contacts;
  const headHtml = `<div class="hw-head-left">${widgetHeadIcon(iconUser)}<div class="hw-title">Contacts</div></div>`;
  if (contacts.length === 0) {
    return `
      <div class="hw-tile hw-gw-contacts" data-tint="contacts" onclick="navigateCard(event, '${href}')">
        <div class="hw-pad"><div class="hw-head">${headHtml}</div><p class="empty">No contacts tracked yet.</p></div>
      </div>`;
  }
  const staleCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const staleCount = contacts.filter((c) => !c.lastContactedAt || new Date(`${c.lastContactedAt}T12:00:00`).getTime() < staleCutoff).length;
  const rows = contacts
    .slice(0, 3)
    .map((c) => `<div class="hw-row"><div class="hw-row-main"><div class="hw-row-name">${escapeHtml(c.name)}</div></div><div class="hw-row-val">${escapeHtml(c.relationshipTag ?? "")}</div></div>`)
    .join("\n");
  return `
    <div class="hw-tile hw-gw-contacts" data-tint="contacts" onclick="navigateCard(event, '${href}')">
      <div class="hw-pad">
        <div class="hw-head">${headHtml}</div>
        <div class="hw-kpi-row"><div class="hw-kpi">${contacts.length}</div><div class="hw-trend">${staleCount > 0 ? `${staleCount} stale` : "tracked"}</div></div>
        <div class="hw-rows">${rows}</div>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------
// News — top headline + a newsletter preview, both deep-linking into the
// News tab at that exact item (see newsPage.ts's ?highlight= handling).
// ---------------------------------------------------------------------
function renderNewsTile(context: DailyContext | null, newsletters: StoredNewsletter[]): string {
  const headHtml = `<div class="hw-head-left">${widgetHeadIcon(iconNewspaper)}<div class="hw-title">News</div></div>`;
  const topStory = context?.stories[0];
  const headlineHtml = topStory
    ? `
    <a class="hw-news-source" href="/donna/news?highlight=${encodeURIComponent(topStory.url)}#${storyAnchorId(topStory.url)}">${escapeHtml(topStory.source)}</a>
    <a class="hw-news-headline" href="/donna/news?highlight=${encodeURIComponent(topStory.url)}#${storyAnchorId(topStory.url)}">${escapeHtml(topStory.headline)}</a>`
    : `<p class="empty">No brief generated yet today.</p>`;

  const newsletterRows = newsletters
    .slice(0, 2)
    .map(
      (n) =>
        `<a class="hw-row hw-row-link" href="/donna/news?highlight=${encodeURIComponent(`newsletter:${n.id}`)}#newsletter-${escapeHtml(n.id)}"><div class="hw-row-main"><div class="hw-row-name">${escapeHtml(n.subject)}</div></div></a>`
    )
    .join("\n");

  return `
    <div class="hw-tile hw-gw-news" data-tint="news" onclick="navigateCard(event, '/donna/news')">
      <div class="hw-pad">
        <div class="hw-head">${headHtml}</div>
        ${headlineHtml}
        ${newsletterRows ? `<div class="hw-rows" style="margin-top:6px;">${newsletterRows}</div>` : ""}
      </div>
    </div>`;
}

export interface DonnaPageData {
  context: DailyContext | null;
  newsletters: StoredNewsletter[];
  reminders: Reminder[];
  reminderNotifications: Map<string, ReminderNotification>;
  recentUploads: Upload[];
  googleConfigured: boolean;
  dashboardConfig: DashboardConfig;
  contacts: Contact[];
  classFolders: ClassFolder[];
  ipoFilings: IpoFiling[];
  fidelityAccount: PlaidAccount | null;
  fidelityBalanceWeek: BalancePoint[];
  fidelityBalanceMonth: BalancePoint[];
  financeAccountOptions: { accountId: string; label: string }[];
  totalCash: number;
  accountCount: number;
  todayEvents: CalendarEvent[];
  tomorrowEvents: CalendarEvent[];
  reminderGroups: ReminderGroup[];
  groupLinks: Map<string, number>;
  watchlistQuotes: Quote[];
  upcomingEconEvents: EconomicEvent[];
}

function renderWidgetGrid(data: DonnaPageData, timezone: string): string {
  const {
    dashboardConfig,
    reminders,
    reminderNotifications,
    recentUploads,
    googleConfigured,
    contacts,
    classFolders,
    ipoFilings,
    fidelityAccount,
    fidelityBalanceWeek,
    fidelityBalanceMonth,
    financeAccountOptions,
    totalCash,
    accountCount,
    todayEvents,
    tomorrowEvents,
    reminderGroups,
    groupLinks,
    watchlistQuotes,
    upcomingEconEvents,
    context,
    newsletters,
  } = data;

  const renderers: Record<HomeWidgetId, () => string> = {
    reminders: () => renderRemindersTile(reminders, googleConfigured, reminderNotifications, timezone, reminderGroups, groupLinks),
    finances: () => renderFinancesTile(fidelityAccount, fidelityBalanceWeek, fidelityBalanceMonth, totalCash, accountCount, financeAccountOptions),
    markets: () => renderMarketsTile(watchlistQuotes),
    upcoming: () => renderUpcomingTile(todayEvents, tomorrowEvents, timezone),
    classes: () => renderClassesTile(classFolders),
    ipos: () => renderIposTile(ipoFilings),
    files: () => renderFilesTile(),
    "recent-activity": () => renderRecentActivityTile(recentUploads),
    "econ-events": () => renderEconEventsTile(upcomingEconEvents),
    contacts: () => renderContactsTile(contacts),
    news: () => renderNewsTile(context, newsletters),
  };

  return dashboardConfig.homeWidgets
    .filter((w) => w.visible && renderers[w.id])
    .map((w) => renderers[w.id]())
    .join("\n");
}

export function buildDonnaHtml(data: DonnaPageData): string {
  const { context, dashboardConfig } = data;
  const timezone = context?.timezone ?? "America/New_York";
  const dateLabel = context ? formatFullDate(context.day, timezone) : "";

  const body = `
    <div class="section">
      <h1 class="page-title">${greetingWord(timezone)}, Nathan.</h1>
      ${dateLabel ? `<p class="page-sub">${escapeHtml(dateLabel)}</p>` : ""}
    </div>

    <div class="hw-grid" id="hw-grid">
      ${renderWidgetGrid(data, timezone)}
    </div>`;

  return renderLayout({
    title: "Donna",
    activeTab: "home",
    bodyHtml: body,
    pageScript: CLIENT_SCRIPT,
    showChatFab: true,
    navVisibility: dashboardConfig.navVisibility,
    navOrder: dashboardConfig.navOrder,
  });
}

const CLIENT_SCRIPT = `
(function () {
  function navigateCard(event, href) {
    if (event.target.closest(".hw-fin-toggle, a, button, input, label, select")) return;
    if (href) window.location.href = href;
  }
  window.navigateCard = navigateCard;

  function toggleReminderGroupChip(chip) {
    chip.classList.toggle("hw-group-chip-active");
    const tile = chip.closest(".hw-tile");
    if (!tile) return;
    const active = Array.prototype.map.call(tile.querySelectorAll(".hw-group-chip.hw-group-chip-active"), function (c) {
      return c.dataset.group;
    });
    tile.querySelectorAll(".hw-row[data-group]").forEach((row) => {
      const g = row.dataset.group;
      row.style.display = !g || active.indexOf(g) !== -1 ? "" : "none";
    });
  }
  window.toggleReminderGroupChip = toggleReminderGroupChip;

  function setFinRange(btn, range) {
    const tile = btn.closest(".hw-tile");
    if (!tile) return;
    tile.querySelectorAll(".hw-fin-toggle-btn").forEach((b) => b.classList.toggle("hw-fin-toggle-active", b === btn));
    tile.querySelectorAll(".hw-fin-chart").forEach((el) => {
      el.style.display = el.dataset.rangeView === range ? "" : "none";
    });
  }
  window.setFinRange = setFinRange;

  async function setFinAccount(select) {
    const accountId = select.value;
    if (!accountId) return;
    const tile = select.closest(".hw-tile");
    if (!tile) return;
    tile.style.opacity = "0.6";
    try {
      const res = await fetch("/donna/finances?page=account-summary&accountId=" + encodeURIComponent(accountId));
      if (!res.ok) throw new Error("bad status");
      const data = await res.json();

      const nameTitle = tile.querySelector("#hw-fin-name .hw-title");
      if (nameTitle) nameTitle.textContent = data.name;
      const balanceEl = tile.querySelector("#hw-fin-balance");
      if (balanceEl) balanceEl.textContent = data.balanceLabel;
      const trendEl = tile.querySelector("#hw-fin-trend");
      if (trendEl) {
        trendEl.textContent = data.trendLabel;
        trendEl.style.color = data.trendUp ? "var(--hw-up)" : "var(--hw-down)";
      }
      const changeEl = tile.querySelector("#hw-fin-change");
      if (changeEl) {
        changeEl.textContent = data.changeLabel;
        changeEl.style.color = data.trendUp ? "var(--hw-up)" : "var(--hw-down)";
      }

      const hasChart = !data.emptyMessage;
      const toggleRow = tile.querySelector("#hw-fin-toggle-row");
      const statRow = tile.querySelector("#hw-fin-stat-row");
      const emptyEl = tile.querySelector("#hw-fin-empty");
      if (toggleRow) toggleRow.style.display = hasChart ? "" : "none";
      if (statRow) statRow.style.display = hasChart ? "" : "none";
      if (emptyEl) {
        emptyEl.style.display = hasChart ? "none" : "";
        emptyEl.textContent = data.emptyMessage || "";
      }

      const weekChart = tile.querySelector("#hw-fin-chart-week");
      if (weekChart) {
        weekChart.innerHTML = data.weekChartHtml || "";
        weekChart.style.display = hasChart ? "" : "none";
      }
      const monthChart = tile.querySelector("#hw-fin-chart-month");
      if (monthChart) {
        monthChart.innerHTML = data.monthChartHtml || "";
        monthChart.style.display = "none";
      }

      // Rebuilt fresh (rather than just toggled) so a switch back to
      // "Week" is the selected state every time an account loads, even
      // if the previous account was left on "Month".
      const toggle = tile.querySelector("#hw-fin-toggle");
      if (toggle) {
        toggle.innerHTML =
          '<button type="button" class="hw-fin-toggle-btn hw-fin-toggle-active" data-range="week" onclick="setFinRange(this, \\'week\\')">Week</button>' +
          (data.monthAvailable ? '<button type="button" class="hw-fin-toggle-btn" data-range="month" onclick="setFinRange(this, \\'month\\')">Month</button>' : "");
      }
    } catch (err) {
      // Leave whatever the previous account showed rather than blanking
      // the widget over a network hiccup.
    } finally {
      tile.style.opacity = "";
    }
  }
  window.setFinAccount = setFinAccount;

  // The CSS fallback (calc(100vh - 220px)) is a guess at how much chrome
  // sits above the grid — right on a laptop, short of the mark on a
  // bigger monitor where that guess doesn't scale. Measuring the grid's
  // actual offset and setting an exact height fixes that regardless of
  // screen size; the CSS rule stays as the pre-JS/no-JS fallback.
  function fitGrid() {
    const grid = document.getElementById("hw-grid");
    if (!grid) return;
    if (window.innerWidth <= 1200) {
      grid.style.height = "";
      return;
    }
    const rect = grid.getBoundingClientRect();
    const available = window.innerHeight - rect.top - 24;
    grid.style.height = Math.max(available, 560) + "px";
  }
  fitGrid();
  if (!window.__hwGridResizeBound) {
    window.__hwGridResizeBound = true;
    let resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(fitGrid, 150);
    });
  }
})();
`;
