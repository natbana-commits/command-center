// Fallback shown in place of a story's thumbnail when the RSS feed didn't
// include one, or the image URL fails to load (WSJ/FT images are often
// paywalled or hotlink-protected). Rather than reproducing each outlet's
// actual trademarked logo, this renders a plain initials monogram in a
// per-source color — visually distinct, legally uncomplicated.
interface SourceBadge {
  initials: string;
  color: string;
}

const SOURCE_BADGES: Record<string, SourceBadge> = {
  WSJ: { initials: "WSJ", color: "#000000" },
  FT: { initials: "FT", color: "#fff1e5" },
  Bloomberg: { initials: "B", color: "#000000" },
  MarketWatch: { initials: "MW", color: "#1a4d64" },
  CNBC: { initials: "CNBC", color: "#005594" },
  "Seeking Alpha": { initials: "SA", color: "#ff6b00" },
};

const DEFAULT_BADGE: SourceBadge = { initials: "•", color: "#6d6a66" };

function badgeFor(source: string): SourceBadge {
  return SOURCE_BADGES[source] ?? DEFAULT_BADGE;
}

// FT's badge color is a very light cream — force dark text there, white
// everywhere else, rather than computing contrast generically for a
// six-entry table.
function textColorFor(source: string): string {
  return source === "FT" ? "#1f1f1f" : "#ffffff";
}

export function renderSourceBadge(source: string, className: string): string {
  const badge = badgeFor(source);
  const fontSize = badge.initials.length > 2 ? "11px" : "14px";
  return `<div class="${className}" style="background:${badge.color};color:${textColorFor(source)};font-size:${fontSize};">${badge.initials}</div>`;
}
