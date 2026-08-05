import { NAV_TAB_IDS, type NavTabId, type NavVisibility } from "../config.js";
import {
  iconHome,
  iconFolder,
  iconCalendar,
  iconBell,
  iconSettings,
  iconUser,
  iconTrendingUp,
  iconWallet,
  iconGraduationCap,
  iconChat,
  iconNewspaper,
} from "./icons.js";

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

// Home is pinned, always shown, always first — not part of NavVisibility
// or the reorderable navOrder. Settings used to be pinned last the same
// way, but now lives as a small icon in the sidebar footer (see
// layout.ts's .sidebar-user) instead of a full nav row — still not part
// of NavVisibility/navOrder, just no longer rendered by visibleTabs()
// below. It's kept here so renderBottomNav can still surface it in the
// mobile "More" sheet. Every other tab is "middle": reorderable, and
// individually hideable.
const HOME_TAB: NavEntry = { tab: "home", label: "Home", href: "/donna", icon: iconHome };
const SETTINGS_TAB: NavEntry = { tab: "settings", label: "Settings", href: "/donna/settings", icon: iconSettings };

// Keyed as Record<NavTabId, ...> rather than a plain array — adding a
// tab to NAV_TAB_IDS (config.ts) without adding its metadata here is a
// compile error instead of a silently-missing sidebar entry.
const MIDDLE_TAB_META: Record<NavTabId, { label: string; href: string; icon: string }> = {
  news: { label: "News", href: "/donna/news", icon: iconNewspaper },
  files: { label: "Files", href: "/donna/files", icon: iconFolder },
  calendar: { label: "Calendar", href: "/donna/calendar", icon: iconCalendar },
  reminders: { label: "Reminders", href: "/donna/reminders", icon: iconBell },
  contacts: { label: "Contacts", href: "/donna/contacts", icon: iconUser },
  ipos: { label: "IPOs", href: "/donna/ipos", icon: iconTrendingUp },
  finances: { label: "Finances", href: "/donna/finances", icon: iconWallet },
  school: { label: "School", href: "/donna/school", icon: iconGraduationCap },
  chat: { label: "Chat", href: "/donna/chat", icon: iconChat },
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
  return [HOME_TAB, ...orderedMiddleTabs(navVisibility, navOrder)];
}

function navLink(t: NavEntry, active: Tab, linkClass: string, activeClass: string): string {
  return `<a class="${linkClass}${t.tab === active ? ` ${activeClass}` : ""}" href="${t.href}">${t.icon}<span>${t.label}</span></a>`;
}

export function renderSidebarNav(active: Tab, navVisibility: NavVisibility, navOrder: string[]): string {
  return visibleTabs(navVisibility, navOrder)
    .map((t) => navLink(t, active, "sidebar-link", "sidebar-link-active"))
    .join("");
}

// Mobile nav: every visible tab (Home + middle tabs + Settings) as one
// horizontally-scrollable strip at the top of the page, above whatever
// sub-tabs that page renders itself — replaces the old fixed bottom bar
// + "More" overflow sheet, since scrolling sideways for the rest beats a
// second tap-to-open layer, and nothing needs to be hidden away anymore.
export function renderMobileNav(active: Tab, navVisibility: NavVisibility, navOrder: string[]): string {
  const tabs = [...visibleTabs(navVisibility, navOrder), SETTINGS_TAB];
  return tabs.map((t) => navLink(t, active, "mobile-tab-strip-link", "mobile-tab-strip-link-active")).join("");
}
