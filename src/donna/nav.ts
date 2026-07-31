export const PWA_HEAD = `
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="apple-touch-icon" href="/icon-192.png" />
<meta name="theme-color" content="#fdfcf9" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-title" content="Donna" />
`;

export type Tab = "brief" | "files" | "chat" | "settings";

const TABS: { tab: Tab; label: string; href: string }[] = [
  { tab: "brief", label: "Brief", href: "/donna" },
  { tab: "files", label: "Files", href: "/donna/files" },
  { tab: "chat", label: "Chat", href: "/donna/chat" },
  { tab: "settings", label: "Settings", href: "/donna/settings" },
];

export function renderNav(active: Tab): string {
  return TABS.map(
    (t) =>
      `<a class="tab-link${t.tab === active ? " tab-link-active" : ""}" href="${t.href}">${t.label}</a>`
  ).join("");
}
