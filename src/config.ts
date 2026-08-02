import { getSupabaseClient, withSupabaseRetry } from "./supabaseClient.js";

export type HomeWidgetId =
  | "recent-activity"
  | "upcoming"
  | "reminders"
  | "contacts"
  | "files"
  | "ipos"
  | "finances"
  | "markets"
  | "econ-events";

export type FinanceWidgetId =
  | "net-worth"
  | "spending-over-time"
  | "spending-by-category"
  | "accounts"
  | "recurring-charges"
  | "transactions";

// The single source of truth for which "middle" nav tabs exist (every
// tab except Home/Settings, which stay pinned first/last and aren't
// individually hideable or reorderable). NavVisibility is derived from
// this rather than listing the same ids again by hand, so adding a tab
// here is enough to force a compile error anywhere else (nav.ts's
// MIDDLE_TAB_META, keyed the same way) that still needs updating.
export const NAV_TAB_IDS = [
  "files",
  "calendar",
  "reminders",
  "contacts",
  "info",
  "ipos",
  "finances",
  "school",
  "chat",
] as const;
export type NavTabId = (typeof NAV_TAB_IDS)[number];

export type NavVisibility = Record<NavTabId, boolean>;

// The order of the "middle" nav tabs — kept as plain strings rather than
// NavTabId[] so a stored row containing a since-removed tab id doesn't
// fail to typecheck; callers that need the ordered, filtered, validated
// list use `visibleTabs()` in nav.ts.
export interface DashboardConfig {
  homeWidgets: { id: HomeWidgetId; visible: boolean }[];
  financeWidgets: { id: FinanceWidgetId; visible: boolean }[];
  defaultHomeTab: "news" | "newsletters";
  navVisibility: NavVisibility;
  navOrder: string[];
}

export interface BriefConfig {
  news: boolean;
  calendar: boolean;
  reminders: boolean;
  ipos: boolean;
  headlineCount: number;
  weeklyDigestEnabled: boolean;
  /** 0 = Sunday, ... 6 = Saturday, in the configured timezone. */
  weeklyDigestDay: number;
  /** "HH:MM" 24-hour, in the configured timezone — when the daily brief goes out. */
  sendTime: string;
}

export interface Settings {
  timezone: string;
  newsletterQuery: string;
  dashboardConfig: DashboardConfig;
  briefConfig: BriefConfig;
}

const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  homeWidgets: [
    { id: "recent-activity", visible: true },
    { id: "upcoming", visible: true },
    { id: "reminders", visible: true },
    { id: "contacts", visible: true },
    { id: "files", visible: true },
    { id: "ipos", visible: true },
    { id: "finances", visible: true },
    // Off by default — Home was just decrowded, so a brand new widget
    // shouldn't silently re-add to the pile. Nathan can turn these on
    // himself from Settings once Finnhub is configured (markets) or
    // whenever he wants them (econ-events, which needs no setup at all).
    { id: "markets", visible: false },
    { id: "econ-events", visible: false },
  ],
  // Unlike homeWidgets above, all default visible — this ask was
  // explicitly for *more* visible richness on the Finances page itself
  // (not a shared, crowded Home page), prune-able from Settings after.
  financeWidgets: [
    { id: "net-worth", visible: true },
    { id: "spending-over-time", visible: true },
    { id: "spending-by-category", visible: true },
    { id: "accounts", visible: true },
    { id: "recurring-charges", visible: true },
    { id: "transactions", visible: true },
  ],
  defaultHomeTab: "news",
  navVisibility: Object.fromEntries(NAV_TAB_IDS.map((id) => [id, true])) as NavVisibility,
  navOrder: [...NAV_TAB_IDS],
};

const DEFAULT_BRIEF_CONFIG: BriefConfig = {
  news: true,
  calendar: true,
  reminders: true,
  ipos: true,
  headlineCount: 4,
  // Opt-in: an entirely new message Nathan hasn't asked to receive yet,
  // unlike the other briefConfig fields above which gate pre-existing
  // daily-brief behavior.
  weeklyDigestEnabled: false,
  weeklyDigestDay: 0,
  sendTime: "06:00",
};

const DEFAULT_SETTINGS: Settings = {
  timezone: "America/New_York",
  newsletterQuery: "newer_than:2d label:newsletters",
  dashboardConfig: DEFAULT_DASHBOARD_CONFIG,
  briefConfig: DEFAULT_BRIEF_CONFIG,
};

export async function loadSettings(): Promise<Settings> {
  const client = getSupabaseClient();
  const { data, error } = await withSupabaseRetry(() =>
    client
      .from("app_settings")
      .select("timezone, newsletter_query, dashboard_config, brief_config")
      .eq("id", 1)
      .maybeSingle()
  );

  if (error || !data) {
    return DEFAULT_SETTINGS;
  }

  // Merge rather than a bare `??` fallback — a stored config missing a
  // nested key (e.g. an older row saved before a field existed) should
  // fall back to that field's default, not silently read as `undefined`
  // everywhere it's used.
  //
  // homeWidgets is an array, not a keyed object, so a stored row saved
  // before a new widget id existed (e.g. "contacts"/"files") wouldn't
  // contain it at all — append any default widget missing from the
  // stored list so newly added widgets show up without a migration.
  const storedWidgets = data.dashboard_config?.homeWidgets ?? DEFAULT_DASHBOARD_CONFIG.homeWidgets;
  const missingWidgets = DEFAULT_DASHBOARD_CONFIG.homeWidgets.filter(
    (w) => !storedWidgets.some((sw: { id: HomeWidgetId }) => sw.id === w.id)
  );

  // Same self-healing idea for financeWidgets — a stored row saved before
  // this field existed at all just won't have it.
  const storedFinanceWidgets = data.dashboard_config?.financeWidgets ?? DEFAULT_DASHBOARD_CONFIG.financeWidgets;
  const missingFinanceWidgets = DEFAULT_DASHBOARD_CONFIG.financeWidgets.filter(
    (w) => !storedFinanceWidgets.some((sw: { id: FinanceWidgetId }) => sw.id === w.id)
  );

  // Same self-healing idea for navOrder: a stored row from before a tab
  // existed (or before navOrder existed at all) just won't list it —
  // append anything missing so a newly added tab still shows in nav.
  const storedNavOrder: string[] = data.dashboard_config?.navOrder ?? DEFAULT_DASHBOARD_CONFIG.navOrder;
  const missingNavTabs = DEFAULT_DASHBOARD_CONFIG.navOrder.filter((t) => !storedNavOrder.includes(t));

  const dashboardConfig: DashboardConfig = {
    ...DEFAULT_DASHBOARD_CONFIG,
    ...data.dashboard_config,
    homeWidgets: [...storedWidgets, ...missingWidgets],
    financeWidgets: [...storedFinanceWidgets, ...missingFinanceWidgets],
    navVisibility: { ...DEFAULT_DASHBOARD_CONFIG.navVisibility, ...data.dashboard_config?.navVisibility },
    navOrder: [...storedNavOrder, ...missingNavTabs],
  };
  const briefConfig: BriefConfig = { ...DEFAULT_BRIEF_CONFIG, ...data.brief_config };

  return {
    timezone: data.timezone,
    newsletterQuery: data.newsletter_query,
    dashboardConfig,
    briefConfig,
  };
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  const update: Record<string, unknown> = { id: 1, updated_at: new Date().toISOString() };
  if (settings.timezone !== undefined) update.timezone = settings.timezone;
  if (settings.newsletterQuery !== undefined) update.newsletter_query = settings.newsletterQuery;
  if (settings.dashboardConfig !== undefined) update.dashboard_config = settings.dashboardConfig;
  if (settings.briefConfig !== undefined) update.brief_config = settings.briefConfig;

  const client = getSupabaseClient();
  const { error } = await withSupabaseRetry(() =>
    client.from("app_settings").upsert(update, { onConflict: "id" })
  );

  if (error) {
    throw new Error(`Supabase settings save error: ${error.message}`);
  }
}
