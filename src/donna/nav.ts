import { NAV_TAB_IDS, type NavTabId, type NavVisibility } from "../config.js";
import { iconHome, iconFolder, iconCalendar, iconBell, iconSettings, iconUser, iconInfo, iconMore } from "./icons.js";

export const PWA_HEAD = `
<link rel="icon" href="/icon-192.png" type="image/png" />
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="apple-touch-icon" href="/icon-192.png" />
<meta name="theme-color" content="#faf8f5" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-title" content="Donna" />
<meta name="view-transition" content="same-origin" />
`;

export type Tab = "home" | NavTabId | "settings";

type NavEntry = { tab: Tab; label: string; href: string; icon: string };

// Home and Settings are pinned — always shown, always first/last — so
// they're not part of NavVisibility or the reorderable navOrder. Every
// other tab is "middle": reorderable, and individually hideable.
const HOME_TAB: NavEntry = { tab: "home", label: "Home", href: "/donna", icon: iconHome };
const SETTINGS_TAB: NavEntry = { tab: "settings", label: "Settings", href: "/donna/settings", icon: iconSettings };

// Keyed as Record<NavTabId, ...> rather than a plain array — adding a
// tab to NAV_TAB_IDS (config.ts) without adding its metadata here is a
// compile error instead of a silently-missing sidebar entry.
const MIDDLE_TAB_META: Record<NavTabId, { label: string; href: string; icon: string }> = {
  files: { label: "Files", href: "/donna/files", icon: iconFolder },
  calendar: { label: "Calendar", href: "/donna/calendar", icon: iconCalendar },
  reminders: { label: "Reminders", href: "/donna/reminders", icon: iconBell },
  contacts: { label: "Contacts", href: "/donna/contacts", icon: iconUser },
  info: { label: "Info", href: "/donna/info", icon: iconInfo },
};

const MIDDLE_TABS: NavEntry[] = NAV_TAB_IDS.map((id) => ({ tab: id, ...MIDDLE_TAB_META[id] }));

// Reused by settingsPage.ts so the nav-editing UI's labels can't drift
// from the sidebar/bottom-nav's own labels.
export const NAV_TAB_LABELS: Record<NavTabId, string> = Object.fromEntries(
  NAV_TAB_IDS.map((id) => [id, MIDDLE_TAB_META[id].label])
) as Record<NavTabId, string>;

// Orders the middle tabs by navOrder, then appends any middle tab that
// navOrder doesn't mention (defensive — loadSettings() already
// self-heals this on read, but nav.ts shouldn't silently drop a tab if
// it's ever handed an incomplete order), then filters to visible ones.
function orderedMiddleTabs(navVisibility: NavVisibility, navOrder: string[]): NavEntry[] {
  const byTab = new Map(MIDDLE_TABS.map((t) => [t.tab, t]));
  const ordered = navOrder.map((id) => byTab.get(id as NavTabId)).filter((t): t is NavEntry => Boolean(t));
  const missing = MIDDLE_TABS.filter((t) => !ordered.includes(t));
  return [...ordered, ...missing].filter((t) => navVisibility[t.tab as NavTabId]);
}

function visibleTabs(navVisibility: NavVisibility, navOrder: string[]): NavEntry[] {
  return [HOME_TAB, ...orderedMiddleTabs(navVisibility, navOrder), SETTINGS_TAB];
}

function navLink(t: NavEntry, active: Tab, linkClass: string, activeClass: string): string {
  return `<a class="${linkClass}${t.tab === active ? ` ${activeClass}` : ""}" href="${t.href}">${t.icon}<span>${t.label}</span></a>`;
}

export function renderSidebarNav(active: Tab, navVisibility: NavVisibility, navOrder: string[]): string {
  return visibleTabs(navVisibility, navOrder)
    .map((t) => navLink(t, active, "sidebar-link", "sidebar-link-active"))
    .join("");
}

// Mobile bottom bar has room for about 5 icons before it feels cramped —
// Home + the first 3 (visible, ordered) middle tabs show directly; the
// rest collapse into a "More" sheet. Settings is unconditionally part of
// that overflow (it's appended to every tabs list, visibility or not),
// so overflow always has at least one entry — the sheet/button below
// always render, never just the primary bar alone. Scales fine as more
// tabs get added later: the sheet just grows, the bar doesn't.
export function renderBottomNav(active: Tab, navVisibility: NavVisibility, navOrder: string[]): string {
  const tabs = visibleTabs(navVisibility, navOrder);
  const middle = tabs.slice(1, -1);
  const primary = [tabs[0], ...middle.slice(0, 3)];
  const overflow = [...middle.slice(3), tabs[tabs.length - 1]];

  const primaryHtml = primary.map((t) => navLink(t, active, "bottom-nav-link", "bottom-nav-link-active")).join("");
  const overflowActive = overflow.some((t) => t.tab === active);
  const overflowHtml = overflow
    .map((t) => navLink(t, active, "bottom-nav-sheet-link", "bottom-nav-link-active"))
    .join("");

  return `
    ${primaryHtml}
    <button type="button" class="bottom-nav-link bottom-nav-more${overflowActive ? " bottom-nav-link-active" : ""}" id="bottom-nav-more-btn" aria-label="More">${iconMore}<span>More</span></button>
    <div class="bottom-nav-sheet" id="bottom-nav-sheet">${overflowHtml}</div>`;
}
