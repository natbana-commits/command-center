// A shared, deterministic "pick a vibrant color for this string" helper —
// reused across pages (Reminders, School, Files, Contacts, News,
// Settings) so a list of otherwise-uncategorized items (contacts,
// community sources, class names, section titles) still reads as varied
// rather than one flat color repeated down the page, without each page
// needing its own palette. Draws from the same --hw-* tokens Home's
// widget grid already established, rather than inventing a second
// palette — same visual language everywhere a "vibrant tile" shows up.
const TILE_COLOR_TOKENS: readonly { accent: string; tint: string }[] = [
  { accent: "var(--hw-reminders)", tint: "var(--hw-reminders-tint)" },
  { accent: "var(--hw-upcoming)", tint: "var(--hw-upcoming-tint)" },
  { accent: "var(--hw-activity)", tint: "var(--hw-activity-tint)" },
  { accent: "var(--hw-classes)", tint: "var(--hw-classes-tint)" },
  { accent: "var(--hw-files)", tint: "var(--hw-files-tint)" },
  { accent: "var(--hw-ipos)", tint: "var(--hw-ipos-tint)" },
  { accent: "var(--hw-finance)", tint: "var(--hw-finance-tint)" },
  { accent: "var(--hw-markets)", tint: "var(--hw-markets-tint)" },
  { accent: "var(--hw-econ)", tint: "var(--hw-econ-tint)" },
  { accent: "var(--hw-contacts)", tint: "var(--hw-contacts-tint)" },
  { accent: "var(--hw-news)", tint: "var(--hw-news-tint)" },
];

export interface TileColor {
  accent: string;
  tint: string;
}

// Same simple string hash used by financesPage.ts's avatarColor — picked
// purely so the same seed always lands on the same color across renders
// (and, since both draw from the same idea, across pages), not for any
// cryptographic property.
export function tileColorForSeed(seed: string): TileColor {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return TILE_COLOR_TOKENS[hash % TILE_COLOR_TOKENS.length];
}
