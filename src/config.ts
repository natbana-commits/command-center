import { getSupabaseClient, withSupabaseRetry } from "./supabaseClient.js";

export type HomeWidgetId = "recent-activity" | "upcoming" | "reminders" | "contacts" | "files";

export interface NavVisibility {
  files: boolean;
  calendar: boolean;
  reminders: boolean;
  contacts: boolean;
  info: boolean;
}

// The order of the "middle" nav tabs (everything except Home/Settings,
// which stay pinned first/last) — kept as plain strings rather than the
// `Tab` type from nav.ts to avoid a circular import; callers that need
// the ordered, filtered list use `visibleTabs()` in nav.ts, which knows
// the real Tab values.
export interface DashboardConfig {
  homeWidgets: { id: HomeWidgetId; visible: boolean }[];
  defaultHomeTab: "news" | "newsletters";
  navVisibility: NavVisibility;
  navOrder: string[];
}

export interface BriefConfig {
  news: boolean;
  calendar: boolean;
  reminders: boolean;
  headlineCount: number;
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
  ],
  defaultHomeTab: "news",
  navVisibility: { files: true, calendar: true, reminders: true, contacts: true, info: true },
  navOrder: ["files", "calendar", "reminders", "contacts", "info"],
};

const DEFAULT_BRIEF_CONFIG: BriefConfig = {
  news: true,
  calendar: true,
  reminders: true,
  headlineCount: 4,
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

  // Same self-healing idea for navOrder: a stored row from before a tab
  // existed (or before navOrder existed at all) just won't list it —
  // append anything missing so a newly added tab still shows in nav.
  const storedNavOrder: string[] = data.dashboard_config?.navOrder ?? DEFAULT_DASHBOARD_CONFIG.navOrder;
  const missingNavTabs = DEFAULT_DASHBOARD_CONFIG.navOrder.filter((t) => !storedNavOrder.includes(t));

  const dashboardConfig: DashboardConfig = {
    ...DEFAULT_DASHBOARD_CONFIG,
    ...data.dashboard_config,
    homeWidgets: [...storedWidgets, ...missingWidgets],
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
