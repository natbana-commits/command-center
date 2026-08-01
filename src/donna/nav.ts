import type { NavVisibility } from "../config.js";
import { iconHome, iconFolder, iconCalendar, iconBell, iconSettings } from "./icons.js";

export const PWA_HEAD = `
<link rel="icon" href="/icon-192.png" type="image/png" />
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="apple-touch-icon" href="/icon-192.png" />
<meta name="theme-color" content="#faf8f5" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-title" content="Donna" />
`;

export type Tab = "home" | "files" | "calendar" | "reminders" | "settings";

const TABS: { tab: Tab; label: string; href: string; icon: string }[] = [
  { tab: "home", label: "Home", href: "/donna", icon: iconHome },
  { tab: "files", label: "Files", href: "/donna/files", icon: iconFolder },
  { tab: "calendar", label: "Calendar", href: "/donna/calendar", icon: iconCalendar },
  { tab: "reminders", label: "Reminders", href: "/donna/reminders", icon: iconBell },
  { tab: "settings", label: "Settings", href: "/donna/settings", icon: iconSettings },
];

// "home" and "settings" always stay in nav — they're the only way back to
// Settings itself and the landing page, so they're not part of
// NavVisibility at all.
function visibleTabs(navVisibility: NavVisibility): typeof TABS {
  return TABS.filter((t) => {
    if (t.tab === "home" || t.tab === "settings") return true;
    return navVisibility[t.tab];
  });
}

export function renderSidebarNav(active: Tab, navVisibility: NavVisibility): string {
  return visibleTabs(navVisibility)
    .map(
      (t) =>
        `<a class="sidebar-link${t.tab === active ? " sidebar-link-active" : ""}" href="${t.href}">${t.icon}<span>${t.label}</span></a>`
    )
    .join("");
}

export function renderBottomNav(active: Tab, navVisibility: NavVisibility): string {
  return visibleTabs(navVisibility)
    .map(
      (t) =>
        `<a class="bottom-nav-link${t.tab === active ? " bottom-nav-link-active" : ""}" href="${t.href}">${t.icon}<span>${t.label}</span></a>`
    )
    .join("");
}
