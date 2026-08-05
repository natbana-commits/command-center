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
  | "credit-card-spending"
  | "top-merchants"
  | "accounts"
  | "recurring-charges"
  | "upcoming-payments"
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
    { id: "credit-card-spending", visible: true },
    { id: "top-merchants", visible: true },
    { id: "accounts", visible: true },
    { id: "recurring-charges", visible: true },
    { id: "upcoming-payments", visible: true },
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

// Inserts any entry present in `defaults` but missing from `stored` right
// after its nearest preceding neighbor (in default order) that's still
// present, instead of always tacking it onto the end — see loadSettings.
function mergeMissingByDefaultOrder<T>(stored: T[], defaults: T[], getId: (item: T) => string): T[] {
  const result = [...stored];
  for (let defaultIndex = 0; defaultIndex < defaults.length; defaultIndex++) {
    const item = defaults[defaultIndex]!;
    const id = getId(item);
    if (result.some((r) => getId(r) === id)) continue;

    let insertAfter = -1;
    for (let i = defaultIndex - 1; i >= 0; i--) {
      const neighborId = getId(defaults[i]!);
      const neighborIndex = result.findIndex((r) => getId(r) === neighborId);
      if (neighborIndex !== -1) {
        insertAfter = neighborIndex;
        break;
      }
    }
    result.splice(insertAfter + 1, 0, item);
  }
  return result;
}

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
  // homeWidgets/financeWidgets/navOrder are arrays, not keyed objects, so a
  // stored row saved before a new id existed (e.g. "contacts"/"files", or
  // "credit-card-spending"/"top-merchants") wouldn't contain it at all.
  // Self-heal by inserting any default entry missing from the stored list
  // next to its nearest still-present neighbor in DEFAULT order, rather
  // than always appending to the end — otherwise a widget added in the
  // middle of the default order (e.g. between spending-by-category and
  // accounts) would land far away from where it visually belongs for
  // every user who already had settings saved before it existed.
  const storedWidgets = data.dashboard_config?.homeWidgets ?? DEFAULT_DASHBOARD_CONFIG.homeWidgets;
  const storedFinanceWidgets = data.dashboard_config?.financeWidgets ?? DEFAULT_DASHBOARD_CONFIG.financeWidgets;
  const storedNavOrder: string[] = data.dashboard_config?.navOrder ?? DEFAULT_DASHBOARD_CONFIG.navOrder;

  const dashboardConfig: DashboardConfig = {
    ...DEFAULT_DASHBOARD_CONFIG,
    ...data.dashboard_config,
    homeWidgets: mergeMissingByDefaultOrder(storedWidgets, DEFAULT_DASHBOARD_CONFIG.homeWidgets, (w) => w.id),
    financeWidgets: mergeMissingByDefaultOrder(storedFinanceWidgets, DEFAULT_DASHBOARD_CONFIG.financeWidgets, (w) => w.id),
    navVisibility: { ...DEFAULT_DASHBOARD_CONFIG.navVisibility, ...data.dashboard_config?.navVisibility },
    navOrder: mergeMissingByDefaultOrder(storedNavOrder, DEFAULT_DASHBOARD_CONFIG.navOrder, (t) => t),
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
