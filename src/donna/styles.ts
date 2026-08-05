export const BASE_STYLES = `
  @font-face {
    font-family: "Inter";
    font-style: normal;
    font-weight: 400;
    font-display: swap;
    src: url("/fonts/inter-400.woff2") format("woff2");
  }
  @font-face {
    font-family: "Inter";
    font-style: normal;
    font-weight: 500;
    font-display: swap;
    src: url("/fonts/inter-500.woff2") format("woff2");
  }
  @font-face {
    font-family: "Inter";
    font-style: normal;
    font-weight: 600;
    font-display: swap;
    src: url("/fonts/inter-600.woff2") format("woff2");
  }
  @font-face {
    font-family: "Inter";
    font-style: normal;
    font-weight: 700;
    font-display: swap;
    src: url("/fonts/inter-700.woff2") format("woff2");
  }

  :root {
    color-scheme: light;
    --bg: #faf8f5;
    --sidebar-bg: #f3f0ea;
    --card: #ffffff;
    --border: #e8e4de;
    --ink: #1f1f1f;
    --text-secondary: #6d6a66;
    --text-muted: #a29d96;
    --accent: #b86b45;
    --accent-hover: #a15e3a;
    --taupe: #c8c0b5;
    --olive: #b8b29b;
    --danger: #b8442e;
    /* Home widget-grid category colors (see .hw-* rules below) — a
       distinct hue per widget so the redesigned grid reads as vibrant
       rather than the single-accent look everywhere else in the app. */
    --hw-reminders: #c1485c; --hw-reminders-tint: #fbeaec;
    --hw-upcoming: #c17a2f;  --hw-upcoming-tint: #faf1e3;
    --hw-activity: #1f8f8a;  --hw-activity-tint: #e5f4f3;
    --hw-classes: #5b62c9;   --hw-classes-tint: #ecedfa;
    --hw-files: #c9622f;     --hw-files-tint: #faf0e8;
    --hw-ipos: #8a5bc9;      --hw-ipos-tint: #f3ecfa;
    --hw-finance: #2f8f5b;   --hw-finance-tint: #e7f4ec;
    --hw-markets: #2f6fb0;   --hw-markets-tint: #e8f0fa;
    --hw-econ: #9a9330;      --hw-econ-tint: #f6f5e3;
    --hw-contacts: #c9527d;  --hw-contacts-tint: #fbebf1;
    --hw-news: #2f9ec9;      --hw-news-tint: #e6f5fa;
    --hw-up: #2f8f5b; --hw-down: #c1485c;
    --hw-ipo-1: #2f6fb0; --hw-ipo-2: #2f8f5b; --hw-ipo-3: #9a9330;
    /* Fixed dark surface for header bars/badges that pair with hardcoded
       white text (modal/chat headers, the logo mark, the ask popup) —
       deliberately NOT overridden in the dark theme below, since these
       are meant to stay a dark bar in both themes rather than invert
       along with --ink (which flips to a light color for body text). */
    --ink-fixed: #1f1f1f;
    --sans: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    /* Used to be Merriweather (serif) — retired sitewide per feedback that
       it looked off, especially in the day-badge numbers. Kept as a
       separate token from --sans (rather than replacing every usage
       in-place) in case a deliberate display face is wanted again later. */
    --display: var(--sans);
    --mono: SFMono-Regular, Consolas, "Liberation Mono", Menlo, Courier, monospace;
    --sp-1: 8px;
    --sp-2: 16px;
    --sp-3: 24px;
    --sp-4: 32px;
    --sp-6: 48px;
    --sp-8: 64px;
  }
  /* Dark palette: applied automatically when the OS prefers dark and
     Nathan hasn't explicitly picked light, or always when he's toggled
     dark explicitly (data-theme, set by THEME_TOGGLE_SCRIPT below). */
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      color-scheme: dark;
      --bg: #18160f;
      --sidebar-bg: #100f0a;
      --card: #221f18;
      --border: #38332a;
      --ink: #f1ede4;
      --text-secondary: #b7b0a3;
      --text-muted: #7e776a;
      --accent: #dd9367;
      --accent-hover: #e8a578;
      --taupe: #4c4638;
      --olive: #7d7a5e;
      --danger: #e2725a;
      --hw-reminders: #ef8398; --hw-reminders-tint: #2e1c21;
      --hw-upcoming: #e8a86a;  --hw-upcoming-tint: #2f2417;
      --hw-activity: #5fc9c2;  --hw-activity-tint: #1a2b2a;
      --hw-classes: #9aa0ec;   --hw-classes-tint: #22243a;
      --hw-files: #e2895a;     --hw-files-tint: #2f2117;
      --hw-ipos: #bfa0ec;      --hw-ipos-tint: #251d33;
      --hw-finance: #5fc98d;   --hw-finance-tint: #1c2b22;
      --hw-markets: #7db3f2;   --hw-markets-tint: #1b2531;
      --hw-econ: #cfc85f;      --hw-econ-tint: #2b2a17;
      --hw-contacts: #ef8fb5;  --hw-contacts-tint: #2e1c26;
      --hw-news: #7dd0ec;      --hw-news-tint: #182b31;
      --hw-up: #5fc98d; --hw-down: #ef8398;
      --hw-ipo-1: #7db3f2; --hw-ipo-2: #5fc98d; --hw-ipo-3: #cfc85f;
    }
  }
  :root[data-theme="dark"] {
    color-scheme: dark;
    --bg: #18160f;
    --sidebar-bg: #100f0a;
    --card: #221f18;
    --border: #38332a;
    --ink: #f1ede4;
    --text-secondary: #b7b0a3;
    --text-muted: #7e776a;
    --accent: #dd9367;
    --accent-hover: #e8a578;
    --taupe: #4c4638;
    --olive: #7d7a5e;
    --danger: #e2725a;
    --hw-reminders: #ef8398; --hw-reminders-tint: #2e1c21;
    --hw-upcoming: #e8a86a;  --hw-upcoming-tint: #2f2417;
    --hw-activity: #5fc9c2;  --hw-activity-tint: #1a2b2a;
    --hw-classes: #9aa0ec;   --hw-classes-tint: #22243a;
    --hw-files: #e2895a;     --hw-files-tint: #2f2117;
    --hw-ipos: #bfa0ec;      --hw-ipos-tint: #251d33;
    --hw-finance: #5fc98d;   --hw-finance-tint: #1c2b22;
    --hw-markets: #7db3f2;   --hw-markets-tint: #1b2531;
    --hw-econ: #cfc85f;      --hw-econ-tint: #2b2a17;
    --hw-contacts: #ef8fb5;  --hw-contacts-tint: #2e1c26;
    --hw-news: #7dd0ec;      --hw-news-tint: #182b31;
    --hw-up: #5fc98d; --hw-down: #ef8398;
    --hw-ipo-1: #7db3f2; --hw-ipo-2: #5fc98d; --hw-ipo-3: #cfc85f;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--ink);
    font-family: var(--sans);
    line-height: 1.5;
    font-size: 15px;
  }
  a { color: inherit; }

  /* --- shell / sidebar --- */
  .app-shell { display: flex; min-height: 100vh; }
  .sidebar {
    width: 240px;
    flex: 0 0 240px;
    background: var(--sidebar-bg);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    padding: var(--sp-3) var(--sp-2);
    position: sticky;
    top: 0;
    height: 100vh;
  }
  .sidebar-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 8px;
    margin-bottom: var(--sp-4);
  }
  .sidebar-logo-mark {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: var(--ink-fixed);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--display);
    font-weight: 700;
    font-size: 16px;
    flex: 0 0 auto;
  }
  .sidebar-logo-word {
    font-family: var(--display);
    font-weight: 700;
    font-size: 19px;
    color: var(--ink);
  }
  .sidebar-nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
  }
  .sidebar-link {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 9px 12px;
    border-radius: 8px;
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
  }
  .sidebar-link svg { width: 18px; height: 18px; flex: 0 0 auto; }
  .sidebar-link:hover { background: rgba(0,0,0,0.04); color: var(--ink); }
  .sidebar-link-active {
    background: var(--card);
    color: var(--ink);
    border: 1px solid var(--border);
  }
  .sidebar-user {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 36px;
    padding: var(--sp-3) 8px;
    margin-top: auto;
    border-top: 1px solid var(--border);
  }
  .sidebar-user-icon-link {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    padding: 10px;
    border-radius: 10px;
    background: none;
    border: none;
    cursor: pointer;
    font: inherit;
  }
  .sidebar-user-icon-link svg { width: 24px; height: 24px; }
  .sidebar-user-icon-link:hover,
  .sidebar-user-icon-link-active { color: var(--accent); background: var(--sidebar-bg); }
  .main-content {
    flex: 1;
    min-width: 0;
    max-width: 1200px;
    padding: var(--sp-6) var(--sp-4) var(--sp-8);
  }

  .mobile-tab-strip { display: none; }
  .mobile-topbar-btn { display: none; }
  .chat-mobile-bar { display: none; }

  @media (max-width: 860px) {
    .sidebar { display: none; }
    .main-content { padding: var(--sp-3) var(--sp-2) 80px; max-width: 100%; }
    /* iOS Safari auto-zooms the whole page on focusing any input/select/
       textarea under 16px — every one of them was set smaller for a
       tighter desktop look, which meant tapping to type anywhere (the
       chat bar included) zoomed the page in and threw off the layout
       until you zoomed back out by hand. 16px here is the documented
       Safari threshold, not an arbitrary bump. !important because every
       one of those smaller sizes comes from a more specific selector
       (.field input[type="text"], .chat-overlay-footer input, etc.) that
       would otherwise win the cascade over this plain element selector. */
    input, select, textarea { font-size: 16px !important; }
    /* Horizontally-scrollable strip, sticky to the top of the content
       area — sits above whatever sub-tabs a page renders inside its own
       body (Calendar's day/week/month toggle, School's class tabs, etc.)
       since it's a sibling of #page-content rather than fixed over
       everything. Every visible tab shows here; nothing collapses into
       an overflow menu, you just scroll sideways for the rest. */
    .mobile-tab-strip {
      display: flex;
      position: sticky;
      top: 0;
      z-index: 30;
      gap: 4px;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      background: var(--bg);
      border-bottom: 1px solid var(--border);
      padding: 8px 4px;
      margin: 0 calc(var(--sp-2) * -1) var(--sp-2);
    }
    .mobile-tab-strip::-webkit-scrollbar { display: none; }
    .mobile-tab-strip-link {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      color: var(--text-muted);
      text-decoration: none;
      font-size: 9.5px;
      flex: 0 0 auto;
      padding: 4px 12px;
      border-radius: 10px;
      white-space: nowrap;
    }
    .mobile-tab-strip-link svg { width: 19px; height: 19px; }
    .mobile-tab-strip-link-active { color: var(--accent); background: var(--sidebar-bg); }

    /* The sidebar's Settings icon is hidden on mobile — this fixed
       top-right link is what stands in for it there. Info/theme/sign-out
       all moved into the Settings page itself, so this is just a link,
       no dropdown needed. */
    .mobile-topbar-btn {
      display: flex;
      position: fixed;
      top: max(12px, env(safe-area-inset-top));
      right: 12px;
      z-index: 950;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--card);
      border: 1px solid var(--border);
      color: var(--text-secondary);
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .mobile-topbar-btn svg { width: 18px; height: 18px; }

    .chat-mobile-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      position: fixed;
      left: 12px;
      right: 12px;
      bottom: calc(16px + env(safe-area-inset-bottom));
      height: 46px;
      padding: 0 16px;
      border-radius: 999px;
      background: var(--card);
      border: 1px solid var(--border);
      box-shadow: 0 4px 16px rgba(0,0,0,0.12);
      color: var(--accent);
      cursor: pointer;
      z-index: 901;
    }
    .chat-mobile-bar svg { width: 18px; height: 18px; flex: 0 0 auto; }
    .chat-mobile-bar span { font-size: 14px; color: var(--text-muted); }
  }

  /* --- typography helpers --- */
  .page-title { font-family: var(--display); font-weight: 700; font-size: 28px; color: var(--ink); margin: 0; }
  .page-sub { color: var(--text-secondary); font-size: 14px; margin: 4px 0 0; }
  .section-title {
    font-family: var(--display);
    color: var(--ink);
    font-size: 18px;
    margin: 0 0 var(--sp-2);
  }
  .empty { color: var(--text-muted); font-size: 14px; }

  /* --- cards --- */
  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: var(--sp-2);
  }
  /* True masonry packing (CLIENT_SCRIPT in page.ts): a CSS grid's rows
     still align across all columns even with align-items: start, so a
     short card next to a tall one in the SAME row still leaves the row
     below it starting at the tall card's baseline — real gap-free packing
     needs the JS to know each card's actual rendered height, which a
     grid's own layout algorithm doesn't expose. The JS moves each .card
     into a .masonry-col; this is also the graceful no-JS fallback (cards
     wrap 3-per-row, grid-style, hanging space included — same as before
     this feature existed, not broken, just not gap-free). */
  .card-row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--sp-2);
    margin-bottom: var(--sp-4);
  }
  .card-row > .card { flex: 1 1 calc(33.333% - var(--sp-2) * 2 / 3); min-width: 260px; }
  .masonry-col { flex: 1; display: flex; flex-direction: column; gap: var(--sp-2); min-width: 0; }
  @media (max-width: 860px) {
    .card-row { flex-direction: column; flex-wrap: nowrap; }
    .card-row > .card { flex: 1 1 auto; min-width: 0; }
  }
  .card-header { display: flex; align-items: center; gap: 8px; margin-bottom: var(--sp-2); }
  .card-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    margin: 0;
    flex: 1;
    min-width: 0;
  }
  .card-icon { color: var(--text-muted); flex: 0 0 auto; display: flex; }
  .card-clickable { cursor: pointer; }
  .card-clickable:hover { border-color: var(--accent); }
  .card-collapse-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-muted);
    padding: 2px;
    flex: 0 0 auto;
    display: flex;
  }
  .card-collapse-btn svg { transition: transform 0.15s ease; }
  .card-collapsed .card-collapse-btn svg { transform: rotate(-90deg); }
  .card-collapsed .card-content { display: none; }
  .card-edit-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-muted);
    padding: 2px;
    flex: 0 0 auto;
    display: flex;
    text-decoration: none;
  }
  .card-edit-btn svg { width: 14px; height: 14px; }
  .card-edit-btn:hover { color: var(--accent); }
  .page-edit-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
    text-decoration: none;
    margin-top: 6px;
  }
  .page-edit-link svg { width: 14px; height: 14px; }
  .page-edit-link:hover { color: var(--accent); }
  .mini-day-group { margin-bottom: 8px; }
  .mini-day-group:last-child { margin-bottom: 0; }
  .mini-day-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
    margin-bottom: 2px;
  }

  .section { margin-bottom: var(--sp-4); }

  /* --- news rows --- */
  .news-row {
    border-bottom: 1px solid var(--border);
    padding: var(--sp-2) 0;
  }
  .news-row:last-child { border-bottom: none; }
  .news-row summary {
    display: flex;
    gap: var(--sp-2);
    align-items: flex-start;
    cursor: pointer;
    list-style: none;
  }
  .news-row summary::-webkit-details-marker { display: none; }
  .news-thumb-wrap {
    position: relative;
    width: 64px;
    height: 64px;
    border-radius: 8px;
    overflow: hidden;
    flex: 0 0 auto;
    background: var(--sidebar-bg);
  }
  .news-thumb-fallback {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--sans);
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  .news-thumb {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .news-row-main { flex: 1; min-width: 0; }
  .news-row-meta {
    font-size: 12px;
    color: var(--text-muted);
    margin-bottom: 2px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .news-watchlist-badge {
    font-size: 11px;
    font-weight: 600;
    color: var(--accent);
    background: rgba(184, 107, 69, 0.1);
    border-radius: 4px;
    padding: 1px 6px;
  }
  .news-row-headline {
    font-family: var(--sans);
    font-weight: 600;
    font-size: 15px;
    color: var(--ink);
    margin: 0 0 4px;
  }
  .news-row-summary {
    font-size: 13px;
    color: var(--text-secondary);
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .news-expanded { padding: var(--sp-2) 0 0 calc(64px + var(--sp-2)); }
  .news-expanded p { font-size: 14px; color: var(--ink); margin: 0 0 12px; }
  .news-callout {
    background: var(--sidebar-bg);
    border-left: 3px solid var(--accent);
    padding: 10px 14px;
    font-size: 13px;
    color: var(--ink);
    margin: 12px 0;
  }
  .news-image {
    width: 100%;
    max-height: 280px;
    object-fit: cover;
    border-radius: 8px;
    margin-bottom: 12px;
  }
  .news-link { font-size: 13px; color: var(--accent); text-decoration: none; }
  .news-link:hover { text-decoration: underline; }

  /* --- home tab switcher (News / Newsletters) --- */
  .home-tabs {
    display: flex;
    gap: 4px;
    border-bottom: 1px solid var(--border);
    margin-bottom: var(--sp-2);
  }
  .home-tab-btn {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    padding: 10px 4px;
    margin-right: var(--sp-2);
    font-family: var(--sans);
    font-size: 14px;
    font-weight: 500;
    color: var(--text-secondary);
    cursor: pointer;
  }
  .home-tab-btn:hover { color: var(--ink); }
  .home-tab-btn-active { color: var(--ink); border-bottom-color: var(--accent); }

  /* --- newsletters --- */
  .newsletter {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: var(--sp-2);
    margin-bottom: var(--sp-2);
  }
  .newsletter summary {
    cursor: pointer;
    list-style: none;
  }
  .newsletter summary::-webkit-details-marker { display: none; }
  .newsletter[open] summary { margin-bottom: var(--sp-2); }
  .newsletter-subject { font-weight: 600; color: var(--ink); font-size: 14px; margin-bottom: 2px; }
  .newsletter-sender { font-size: 12px; color: var(--text-muted); }
  .ipo-badges { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
  .newsletter-frame { width: 100%; height: 500px; border: none; }

  /* --- agenda rows: generic two-line row, reused well beyond just the
     calendar (Home widgets, Files, School) --- */
  .agenda-event-row { display: flex; gap: var(--sp-2); padding: 8px 0; }
  .agenda-event-time { flex: 0 0 90px; font-weight: 500; font-size: 13px; color: var(--text-secondary); }
  .agenda-event-title { font-size: 14px; color: var(--ink); }

  /* --- calendar week grid --- */
  .cal-week-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--sp-2); gap: var(--sp-2); }
  .cal-week-grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(120px, 1fr));
    gap: var(--sp-2);
    overflow-x: auto;
    padding-bottom: 4px;
  }
  .cal-day-col {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: var(--sp-2);
    /* Fills down to roughly the bottom of the viewport (accounting for the
       page header/nav row above it) instead of a short fixed box — the
       max() floor keeps it from collapsing too small on a short viewport. */
    min-height: max(calc(100vh - 300px), 420px);
  }
  .cal-day-col-today { border-color: var(--accent); }
  .cal-day-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding-bottom: 8px;
    margin-bottom: 8px;
    border-bottom: 1px solid var(--border);
  }
  .cal-day-name { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); }
  .cal-day-num { font-family: var(--display); font-size: 18px; font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; color: var(--ink); }
  .cal-day-num-today { color: var(--accent); }
  .cal-day-events { display: flex; flex-direction: column; gap: 6px; }
  .cal-event-block {
    border-left: 3px solid var(--accent);
    padding: 6px 8px;
    border-radius: 4px;
    background: var(--sidebar-bg);
  }
  .cal-event-time { display: block; font-size: 11px; font-weight: 500; color: var(--text-secondary); }
  .cal-event-title {
    display: block;
    font-size: 12.5px;
    font-weight: 500;
    color: var(--ink);
    margin-top: 1px;
    /* Wraps instead of truncating — the whole point of the wider grid is
       to have room to actually read what's on the calendar. */
    overflow-wrap: break-word;
  }
  .cal-event-location {
    display: block;
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 2px;
    overflow-wrap: break-word;
  }
  @media (max-width: 860px) {
    .cal-week-grid { grid-template-columns: repeat(7, minmax(100px, 1fr)); }
    .cal-day-col { min-height: max(calc(100vh - 340px), 360px); }
  }

  /* --- Calendar: day view (2-day side-by-side grid) --- */
  .cal-day-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(240px, 1fr));
    max-width: 900px;
    gap: var(--sp-2);
    overflow-x: auto;
    padding-bottom: 4px;
  }
  @media (max-width: 860px) {
    .cal-day-grid { grid-template-columns: repeat(2, minmax(160px, 1fr)); }
  }

  /* --- Calendar: month view --- */
  .cal-month-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; background: var(--border); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
  .cal-month-weekday {
    background: var(--sidebar-bg);
    padding: 6px;
    text-align: center;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
  }
  .cal-month-cell {
    background: var(--card);
    min-height: 90px;
    padding: 6px;
    text-decoration: none;
    display: flex;
    flex-direction: column;
    gap: 3px;
    color: inherit;
  }
  .cal-month-cell:hover { background: var(--sidebar-bg); }
  .cal-month-cell-outside { opacity: 0.4; }
  .cal-month-daynum { font-size: 12px; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; }
  .cal-month-daynum-today {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--accent);
    color: #fff;
  }
  .cal-month-chip {
    font-size: 10.5px;
    padding: 1px 5px;
    border-radius: 4px;
    background: var(--sidebar-bg);
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cal-month-more { font-size: 10.5px; color: var(--text-muted); }
  @media (max-width: 860px) {
    .cal-month-cell { min-height: 64px; }
    .cal-month-chip { display: none; }
  }

  /* --- day-badge row: shared "days until X" style, used by the Econ
     events widget, Reminders, and Finances' Upcoming Payments widget --- */
  .day-badge-row { display: flex; align-items: center; gap: var(--sp-2); padding: 8px 0; }
  .day-badge-row + .day-badge-row { border-top: 1px solid var(--border); }
  .day-badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 52px;
    height: 52px;
    border-radius: 12px;
    background: var(--sidebar-bg);
    border: 1px solid var(--border);
  }
  .day-badge-overdue { background: #b3441f1a; }
  .day-badge-number { font-family: var(--display); font-size: 20px; font-weight: 700; line-height: 1; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; color: var(--ink); }
  .day-badge-unit { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.03em; margin-top: 2px; }
  .day-badge-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  .day-badge-title { font-size: 14px; color: var(--ink); }
  .day-badge-pill {
    display: inline-block;
    align-self: flex-start;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 999px;
    letter-spacing: 0.02em;
  }

  /* --- finances page --- */
  .finance-row { display: flex; align-items: center; gap: var(--sp-2); padding: 10px 0; }
  .finance-row + .finance-row { border-top: 1px solid var(--border); }
  .finance-row-link { text-decoration: none; color: inherit; margin: 0 -8px; padding: 10px 8px; border-radius: 8px; }
  .finance-row-link:hover { background: var(--sidebar-bg); }
  .finance-row-icon {
    flex: 0 0 auto;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--display);
    font-weight: 700;
    font-size: 14px;
    color: #fff;
  }
  .finance-row-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .finance-row-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .finance-row-meta { font-size: 12px; color: var(--text-muted); }
  .finance-row-amount {
    flex: 0 0 auto;
    text-align: right;
    font-size: 14px;
    font-weight: 600;
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }
  .finance-row-amount-inflow { color: var(--accent); }
  .finance-row-date { display: block; font-size: 11px; font-weight: 400; color: var(--text-muted); margin-top: 2px; }

  /* Accounts within an institution card — condensed tiles (3/row web,
     2/row mobile) instead of one full-width row per account. */
  .finance-account-grid { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-top: var(--sp-2); }
  .finance-account-tile {
    flex: 1 1 calc(33.333% - var(--sp-2) * 2 / 3);
    min-width: 160px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    border: 1px solid var(--border);
    border-radius: 10px;
    text-decoration: none;
    color: inherit;
  }
  .finance-account-tile:hover { background: var(--sidebar-bg); }
  .finance-account-tile-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .finance-account-tile-amount {
    font-size: 13px;
    font-weight: 600;
    color: var(--ink);
    font-variant-numeric: tabular-nums;
    margin-top: 2px;
  }
  @media (max-width: 860px) {
    .finance-account-tile { flex: 1 1 calc(50% - var(--sp-2) / 2); min-width: 130px; }
  }

  /* --- reminders page --- */
  .reminder-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 8px;
    margin-bottom: 4px;
    border-radius: 8px;
    border-left: 3px solid var(--taupe);
    background: var(--card);
    transition: opacity 0.15s ease;
  }
  .reminder-row-completing { opacity: 0.4; }
  .reminder-row-completing .reminder-title { text-decoration: line-through; }
  @media (prefers-reduced-motion: reduce) {
    .reminder-row { transition: none; }
  }
  .reminder-row input[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--accent); flex: 0 0 auto; }
  .reminder-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .reminder-title { font-size: 14px; }
  .reminder-due {
    display: inline-block;
    align-self: flex-start;
    font-size: 11px;
    font-weight: 500;
    color: var(--accent);
    background: rgba(184, 107, 69, 0.1);
    border-radius: 4px;
    padding: 1px 6px;
  }
  .reminder-due-overdue { color: var(--danger); background: rgba(184, 68, 46, 0.1); }
  .reminder-row-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex: 0 0 auto; }
  .reminder-edit-link { font-size: 12px; color: var(--text-muted); text-decoration: none; }
  .reminder-edit-link:hover { color: var(--accent); }
  .reminder-delete-link {
    font-size: 12px;
    color: var(--text-muted);
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-family: inherit;
  }
  .reminder-delete-link:hover { color: var(--danger); }

  .reminder-add-form { display: flex; flex-direction: column; gap: 10px; margin-top: var(--sp-2); }
  .reminder-add-row2 { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .reminder-add-row2 input[type="date"],
  .reminder-add-row2 input[type="time"] { flex: 0 0 auto; }
  .btn-small { padding: 6px 10px; font-size: 12px; }
  .reminder-add-form textarea { min-height: 60px; }
  .reminder-add-form select,
  .reminder-edit-form select {
    padding: 9px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 14px;
    font-family: inherit;
    background: var(--card);
    color: var(--ink);
    align-self: flex-start;
  }

  .reminder-edit-form { display: flex; flex-direction: column; gap: var(--sp-2); }
  .reminder-edit-actions { display: flex; gap: 8px; }

  .tag-chip {
    display: inline-block;
    align-self: flex-start;
    font-size: 11px;
    font-weight: 500;
    color: var(--text-secondary);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 1px 6px;
  }

  /* --- contacts --- */
  .interactions-section { margin-top: var(--sp-3); padding-top: var(--sp-2); border-top: 1px solid var(--border); }
  .interaction-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid var(--border);
  }
  .interaction-row:last-child { border-bottom: none; }
  .interaction-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .interaction-meta { display: flex; align-items: center; gap: 8px; }
  .interaction-date { font-size: 12px; color: var(--text-muted); }
  .interaction-notes { font-size: 13px; color: var(--text-secondary); white-space: pre-wrap; }
  .interaction-add-form { display: flex; flex-direction: column; gap: 10px; margin-top: var(--sp-2); }
  .interaction-add-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .tag-other-wrap { margin-top: 6px; }

  .reminder-group { margin-bottom: var(--sp-3); }
  .reminder-group:last-child { margin-bottom: 0; }
  .reminder-group-label {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
    margin-bottom: 8px;
  }

  /* --- files --- */
  .file-library-layout { display: flex; gap: var(--sp-3); align-items: flex-start; }
  .file-library { flex: 7 1 0; min-width: 0; }
  .action-panel { flex: 3 1 0; min-width: 220px; }
  @media (max-width: 860px) {
    .file-library-layout { flex-direction: column; }
  }
  .file-table-controls { display: flex; gap: 10px; margin-bottom: var(--sp-2); flex-wrap: wrap; }
  .file-table-controls input[type="text"],
  .file-table-controls select { padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 13px; font-family: var(--sans); background: var(--card); color: var(--ink); }
  .file-table { width: 100%; border-collapse: collapse; font-size: 14px; }
  .file-table th, .file-table td { text-align: left; padding: 10px; border-bottom: 1px solid var(--border); }
  .file-table th {
    cursor: pointer;
    user-select: none;
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
  }
  .file-table th:hover { color: var(--ink); }
  .sort-indicator { font-size: 10px; margin-left: 4px; color: var(--accent); }
  .file-table a { color: var(--accent); text-decoration: none; }
  .file-table a:hover { text-decoration: underline; }
  .file-icon { margin-right: 6px; }
  /* Actions column stays hidden until "Edit Files" is toggled on — most of
     the time you're just looking for something, not managing the list. */
  .file-table-actions-cell { display: none; width: 150px; }
  .file-table-editable.file-table-editing .file-table-actions-cell { display: table-cell; }
  .file-table-actions-cell form { display: flex; gap: 4px; margin-bottom: 4px; }
  .file-table-actions-cell form:last-child { margin-bottom: 0; }
  .file-table-actions-cell select { min-width: 0; flex: 1; font-size: 12px; padding: 4px; border: 1px solid var(--border); border-radius: 6px; background: var(--card); color: var(--ink); }
  .file-table-rename-form { display: none; gap: 6px; margin-top: 6px; }
  .file-table-editable.file-table-editing .file-table-rename-form { display: flex; }
  .file-table-rename-form input[type="text"] { font-size: 13px; padding: 4px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--card); color: var(--ink); flex: 1; min-width: 0; }
  .class-block { margin-bottom: var(--sp-3); }
  .class-title { font-weight: 600; margin-bottom: 8px; }
  .class-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border); }
  .add-class-form { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
  .add-class-form input { flex: 1 1 160px; }
  .add-class-form input[type="color"] { flex: 0 0 44px; padding: 2px; height: 38px; }
  .group-swatch {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    margin-right: 8px;
    vertical-align: middle;
  }

  .upload-form {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: var(--sp-2);
    margin-bottom: var(--sp-2);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .upload-form select, .upload-form input[type="file"] { padding: 8px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px; font-family: var(--sans); background: var(--card); color: var(--ink); }
  .upload-item { border-bottom: 1px solid var(--border); padding: 10px 0; }
  .upload-item:last-child { border-bottom: none; }
  .upload-status { font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-muted); }
  .upload-notes { white-space: pre-wrap; font-size: 14px; margin-top: 6px; }

  /* --- nav progress bar --- */
  .nav-progress-bar {
    position: fixed;
    top: 0;
    left: 0;
    height: 3px;
    width: 0%;
    background: var(--accent);
    z-index: 9999;
    opacity: 0;
    transition: width 0.3s ease, opacity 0.2s ease;
  }
  .nav-progress-bar.active { opacity: 1; width: 70%; }
  @media (prefers-reduced-motion: reduce) {
    .nav-progress-bar { transition: none; }
  }

  /* --- ask popup --- */
  .ask-popup {
    position: fixed;
    max-width: 320px;
    background: var(--ink-fixed);
    color: #fff;
    padding: 12px 14px;
    border-radius: 10px;
    font-size: 14px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    z-index: 1000;
  }
  .ask-popup.hidden { display: none; }
  .ask-button {
    position: fixed;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 6px 12px;
    font-size: 13px;
    cursor: pointer;
    z-index: 1000;
  }

  /* --- forms / fields --- */
  form.settings-form { margin-bottom: var(--sp-3); }
  .field { margin-bottom: var(--sp-2); }
  .field label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
  .field input[type="text"], .field input[type="number"], .field select, .field textarea {
    padding: 9px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 14px;
    font-family: inherit;
    background: var(--card);
    color: var(--ink);
  }
  .field input[type="text"], .field select, .field textarea { width: 100%; }
  .field input.input-mono { font-family: var(--mono); }
  .field textarea { min-height: 100px; }
  .hint { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

  .widget-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid var(--border);
  }
  .widget-row:last-child { border-bottom: none; }
  .field .widget-row-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
    margin-bottom: 0;
    flex: 1;
    min-width: 0;
  }

  /* --- drag-to-reorder (Settings: Home cards, Finance widgets, Sidebar pages) --- */
  .reorder-list { display: flex; flex-direction: column; }
  .reorder-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: 6px;
    background: none;
    color: var(--text-muted);
    cursor: grab;
    touch-action: none;
  }
  .reorder-handle:hover { color: var(--ink); background: var(--sidebar-bg); }
  .reorder-handle:active { cursor: grabbing; }
  .widget-row-dragging {
    position: relative;
    z-index: 5;
    background: var(--card);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.14);
    cursor: grabbing;
  }
  .widget-row-dragging .reorder-handle { cursor: grabbing; }

  /* --- Settings section jump-nav --- */
  .settings-nav {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    background: var(--bg);
    padding: 10px 0;
    margin-bottom: 20px;
    border-bottom: 1px solid var(--border);
  }
  .settings-nav-pills {
    display: flex;
    flex-wrap: wrap;
    flex: 1 1 auto;
    min-width: 0;
    gap: 8px;
  }
  .settings-nav-pill {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 500;
    font-family: inherit;
    text-decoration: none;
    cursor: pointer;
    white-space: nowrap;
  }
  .settings-nav-pill:hover { border-color: var(--accent); color: var(--ink); }
  .settings-nav-theme-btn { margin-left: auto; flex: 0 0 auto; }
  .settings-jump-target { scroll-margin-top: 68px; }

  input:focus, select:focus, textarea:focus, button:focus-visible {
    outline: 2px solid rgba(184, 107, 69, 0.35);
    outline-offset: 1px;
    border-color: var(--accent);
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 10px 16px;
    font-family: var(--sans);
    font-weight: 500;
    font-size: 14px;
    cursor: pointer;
    text-decoration: none;
  }
  .btn:hover { background: var(--accent-hover); }
  .btn-secondary { background: var(--card); color: var(--ink); border: 1px solid var(--border); }
  .btn-secondary:hover { background: var(--sidebar-bg); }
  .btn-danger { background: var(--card); color: var(--danger); border: 1px solid var(--border); }
  .btn-danger:hover { background: #fbeeec; }
  .btn-block { width: 100%; justify-content: center; }

  /* --- chat (FAB overlay) --- */
  .chat-log { display: flex; flex-direction: column; gap: 12px; margin-bottom: var(--sp-2); min-height: 200px; }
  .chat-bubble { padding: 10px 14px; border-radius: 12px; max-width: 85%; font-size: 14px; white-space: pre-wrap; }
  .chat-bubble-user { background: var(--accent); color: #fff; align-self: flex-end; }
  .chat-bubble-assistant { background: var(--sidebar-bg); color: var(--ink); align-self: flex-start; }

  .chat-scrim { position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 1001; display: none; }
  .chat-scrim.open { display: block; }
  .chat-overlay-panel {
    position: fixed;
    top: 0;
    right: -380px;
    bottom: 0;
    width: 350px;
    max-width: 90vw;
    background: var(--bg);
    z-index: 1002;
    display: flex;
    flex-direction: column;
    transition: right 0.2s ease;
    box-shadow: -4px 0 20px rgba(0,0,0,0.15);
  }
  .chat-overlay-panel.open { right: 0; }
  /* Bottom sheet instead of a side panel on mobile — a right-side
     slide-in is basically full-screen-width on a phone anyway, and a
     modest-height bottom sheet reads more like the docked bar it opens
     from. Must come after the base rule above so its equal-specificity
     overrides actually win in the cascade on a mobile viewport. */
  @media (max-width: 860px) {
    .chat-overlay-panel {
      top: auto;
      left: 0;
      right: 0;
      bottom: 0;
      width: auto;
      max-width: none;
      /* A real height, not max-height — with no explicit height the flex
         column sizes to its content instead, so .chat-overlay-body's
         flex:1 has nothing to grow into and its own scroll region never
         actually engages (this was the "spacing/window off" bug: with a
         long chat history the sheet just kept growing instead of
         scrolling internally, and got clipped in a broken-looking way). */
      height: 70vh;
      border-radius: 16px 16px 0 0;
      transform: translateY(100%);
      transition: transform 0.25s ease;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
    }
    .chat-overlay-panel.open { transform: translateY(0); }
    .chat-overlay-footer { padding-bottom: calc(10px + env(safe-area-inset-bottom)); }
  }
  .chat-overlay-header {
    flex: 0 0 auto;
    background: var(--ink-fixed);
    color: #fff;
    padding: 14px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: var(--display);
    font-weight: 700;
  }
  .chat-overlay-close { background: none; border: none; color: #fff; font-size: 18px; cursor: pointer; }
  .chat-overlay-body { flex: 1; min-height: 0; overflow-y: auto; padding: var(--sp-2); display: flex; flex-direction: column; gap: 10px; }
  .chat-overlay-footer { flex: 0 0 auto; border-top: 1px solid var(--border); padding: 10px; display: flex; gap: 8px; }
  .chat-overlay-footer input {
    flex: 1;
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 8px 14px;
    font-size: 14px;
    font-family: var(--sans);
  }
  .chat-overlay-footer button {
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 50%;
    width: 36px;
    height: 36px;
    cursor: pointer;
    flex: 0 0 auto;
  }

  /* --- generic centered modal (reminders "add" portal, reusable elsewhere) --- */
  .modal-scrim {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.3);
    z-index: 1001;
    display: none;
    align-items: center;
    justify-content: center;
    padding: var(--sp-2);
  }
  .modal-scrim.open { display: flex; }
  .modal-panel {
    background: var(--bg);
    border-radius: 12px;
    width: 420px;
    max-width: 100%;
    max-height: 88vh;
    overflow-y: auto;
    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
  }
  .modal-header {
    background: var(--ink-fixed);
    color: #fff;
    padding: 14px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: var(--display);
    font-weight: 700;
    border-radius: 12px 12px 0 0;
    position: sticky;
    top: 0;
  }
  .modal-close { background: none; border: none; color: #fff; font-size: 18px; cursor: pointer; }
  .modal-body { padding: var(--sp-3); }

  /* --- command palette --- */
  .palette-trigger-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 10px;
    margin-bottom: var(--sp-2);
    color: var(--text-muted);
    font-size: 13px;
    font-family: var(--sans);
    cursor: pointer;
  }
  .palette-trigger-btn:hover { border-color: var(--accent); }
  .palette-trigger-kbd { margin-left: auto; font-family: var(--mono); font-size: 11px; }
  .palette-panel { width: 560px; max-width: 100%; max-height: 70vh; padding: 0; }
  .palette-input {
    width: 100%;
    box-sizing: border-box;
    border: none;
    border-bottom: 1px solid var(--border);
    padding: 16px;
    font-size: 16px;
    background: var(--card);
    color: var(--ink);
    border-radius: 12px 12px 0 0;
    font-family: var(--sans);
  }
  .palette-input:focus { outline: none; }
  .palette-results { max-height: 50vh; overflow-y: auto; padding: 8px; }
  .palette-row-active { background: var(--sidebar-bg); }

  .btn-fab-inline {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--accent);
    color: #fff;
    border: none;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
    flex: 0 0 auto;
  }
  .btn-fab-inline:hover { background: var(--accent-hover); }

  /* ============================================================
     Home widget grid — vibrant, condensed tiles. Namespaced "hw-"
     (home widget) throughout so nothing here collides with .card /
     .card-row, which other pages (Finances, etc.) still use as-is.
     ============================================================ */
  .hw-grid { display: grid; gap: 12px; margin-top: var(--sp-3); }

  .hw-tile {
    background: var(--card); border: 1px solid var(--border); border-radius: 14px;
    overflow: hidden; display: flex; flex-direction: column; min-height: 0; min-width: 0; cursor: pointer;
    background-image: linear-gradient(180deg, var(--tint) 0%, var(--card) 42%);
  }
  .hw-tile[data-tint="reminders"] { --tint: var(--hw-reminders-tint); --accent: var(--hw-reminders); }
  .hw-tile[data-tint="upcoming"]  { --tint: var(--hw-upcoming-tint);  --accent: var(--hw-upcoming); }
  .hw-tile[data-tint="activity"]  { --tint: var(--hw-activity-tint); --accent: var(--hw-activity); }
  .hw-tile[data-tint="classes"]   { --tint: var(--hw-classes-tint);  --accent: var(--hw-classes); }
  .hw-tile[data-tint="files"]     { --tint: var(--hw-files-tint);    --accent: var(--hw-files); }
  .hw-tile[data-tint="ipos"]      { --tint: var(--hw-ipos-tint);     --accent: var(--hw-ipos); }
  .hw-tile[data-tint="finance"]   { --tint: var(--hw-finance-tint);  --accent: var(--hw-finance); }
  .hw-tile[data-tint="markets"]   { --tint: var(--hw-markets-tint);  --accent: var(--hw-markets); }
  .hw-tile[data-tint="econ"]      { --tint: var(--hw-econ-tint);     --accent: var(--hw-econ); }
  .hw-tile[data-tint="contacts"]  { --tint: var(--hw-contacts-tint); --accent: var(--hw-contacts); }
  .hw-tile[data-tint="news"]      { --tint: var(--hw-news-tint);     --accent: var(--hw-news); }

  .hw-pad { padding: 11px 13px 9px; flex: 1; min-height: 0; min-width: 0; display: flex; flex-direction: column; overflow: hidden; }
  .hw-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 2px; flex: 0 0 auto; }
  .hw-head-left { display: flex; align-items: center; gap: 7px; min-width: 0; }
  .hw-icon {
    width: 21px; height: 21px; border-radius: 7px; display: flex; align-items: center; justify-content: center;
    background: var(--accent); color: #fff; flex: 0 0 auto;
  }
  .hw-icon svg { width: 12px; height: 12px; display: block; }
  .hw-title { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .hw-kpi-row { display: flex; align-items: baseline; gap: 6px; margin: 2px 0 7px; flex: 0 0 auto; }
  .hw-kpi { font-size: 19px; font-weight: 800; letter-spacing: -0.02em; color: var(--accent); font-variant-numeric: tabular-nums; }
  .hw-trend { font-size: 10px; font-weight: 700; color: var(--text-muted); }

  .hw-rows { flex: 0 0 auto; }
  .hw-row { display: flex; align-items: center; gap: 7px; padding: 3px 0; font-size: 11px; min-width: 0; text-decoration: none; color: inherit; }
  .hw-row + .hw-row { border-top: 1px dotted var(--border); }
  .hw-row-link:hover { color: var(--accent); }
  .hw-row-main { flex: 1 1 0%; min-width: 0; }
  .hw-row-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hw-row-val { flex: 0 0 auto; text-align: right; font-variant-numeric: tabular-nums; color: var(--text-secondary); white-space: nowrap; }
  .hw-row-time { flex: 0 0 auto; color: var(--text-muted); font-size: 10px; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .hw-row-divider { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-muted); margin: 5px 0 2px; }

  .hw-mini-select {
    font: inherit; font-size: 10px; font-weight: 700; color: var(--accent); background: var(--tint);
    border: 1px solid var(--border); border-radius: 999px; padding: 2px 7px; cursor: pointer; flex: 0 0 auto; max-width: 110px;
  }

  .hw-news-source { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--accent); margin-bottom: 2px; flex: 0 0 auto; text-decoration: none; }
  .hw-news-headline { display: block; font-size: 12.5px; font-weight: 800; line-height: 1.3; color: var(--ink); margin-bottom: 5px; flex: 0 0 auto; text-decoration: none; }
  .hw-news-headline:hover, .hw-news-source:hover { color: var(--accent); }

  /* ---- Finances tile: KPI + Week/Month toggle + sparkline ---- */
  .hw-fin-toggle { display: inline-flex; gap: 2px; background: var(--sidebar-bg); border: 1px solid var(--border); border-radius: 999px; padding: 2px; flex: 0 0 auto; }
  .hw-fin-toggle-btn { font: inherit; font-size: 9.5px; font-weight: 700; border: none; background: transparent; color: var(--text-secondary); padding: 2px 8px; border-radius: 999px; cursor: pointer; }
  .hw-fin-toggle-active { background: var(--hw-finance); color: #fff; }
  .hw-fin-chart { flex: 1; min-height: 0; display: flex; align-items: center; margin: 3px 0; }
  .hw-fin-chart svg { width: 100%; height: 100%; display: block; }
  .hw-fin-stat-row { display: flex; justify-content: space-between; font-size: 10.5px; padding: 2px 0; flex: 0 0 auto; }

  /* ---- Classes tile: up to 6 tiles, 3x2 ---- */
  .hw-class-grid { display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(2, 1fr); gap: 6px; flex: 1; min-height: 0; }
  .hw-class-tile {
    border: 1px solid var(--border); border-radius: 9px; background: var(--card);
    display: flex; align-items: center; justify-content: center; text-align: center; padding: 4px 3px;
    text-decoration: none; color: var(--accent); font-size: 11px; font-weight: 800; letter-spacing: -0.01em; min-height: 0;
  }
  .hw-class-tile:hover { border-color: var(--accent); }
  .hw-class-tile-code { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hw-class-tile-empty { border-style: dashed; color: var(--text-muted); font-size: 14px; font-weight: 600; }

  /* ---- Files tile: quick-action buttons ---- */
  .hw-file-actions { display: flex; gap: 7px; flex: 1; min-height: 0; }
  .hw-file-action-btn {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px;
    border: 1px solid var(--border); border-radius: 10px; padding: 6px 4px; cursor: pointer; text-decoration: none;
    font-size: 9.5px; font-weight: 700; text-align: center; line-height: 1.15;
  }
  .hw-file-action-btn svg { width: 16px; height: 16px; }
  .hw-file-action-btn[data-action-tint="markets"] { background: var(--hw-markets-tint); color: var(--hw-markets); }
  .hw-file-action-btn[data-action-tint="finance"] { background: var(--hw-finance-tint); color: var(--hw-finance); }
  .hw-file-action-btn[data-action-tint="ipos"]    { background: var(--hw-ipos-tint);    color: var(--hw-ipos); }

  /* ---- IPOs tile: stat summary ---- */
  .hw-ipo-stats { display: flex; gap: 14px; margin: 2px 0 8px; flex: 0 0 auto; }
  .hw-ipo-stat-num { font-size: 24px; font-weight: 800; color: var(--accent); line-height: 1; }
  .hw-ipo-stat-label { font-size: 9px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.03em; }
  .hw-ipo-bar { display: flex; height: 14px; border-radius: 999px; overflow: hidden; margin-bottom: 6px; flex: 0 0 auto; }
  .hw-ipo-legend { display: flex; flex-wrap: wrap; gap: 4px 8px; flex: 0 0 auto; }
  .hw-ipo-legend-item { display: flex; align-items: center; gap: 4px; font-size: 9.5px; color: var(--text-secondary); white-space: nowrap; }
  .hw-ipo-legend-dot { width: 6px; height: 6px; border-radius: 50%; flex: 0 0 auto; display: inline-block; }
  .hw-ipo-best { margin-top: auto; padding-top: 6px; border-top: 1px dashed var(--border); flex: 0 0 auto; }
  .hw-ipo-best-label { font-size: 8.5px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 2px; }
  .hw-ipo-best-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
  .hw-ipo-best-name { font-size: 11.5px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .hw-ipo-best-chip { font-size: 8px; font-weight: 800; padding: 1px 6px; border-radius: 999px; flex: 0 0 auto; text-transform: uppercase; color: #fff; background: var(--accent); }
  .hw-ipo-best-meta { font-size: 9.5px; color: var(--text-muted); margin-top: 1px; }

  /* ================= Responsive tiers =================
     Above 1200px: exact 4x3 grid that fills the space below the greeting
     with zero scroll, Reminders pinned as a double-height priority tile.
     Below that: forcing an exact-height fill starts squashing everything,
     so each narrower tier drops it and falls back to natural flow +
     scrolling (same as the rest of the app on mobile), with fewer
     columns and smaller type as it narrows. */
  @media (min-width: 1201px) {
    .hw-grid { grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(3, 1fr); height: calc(100vh - 220px); min-height: 560px; }
    .hw-gw-reminders { grid-column: 1; grid-row: 1 / span 2; }
    .hw-gw-finances  { grid-column: 2; grid-row: 1; }
    .hw-gw-markets   { grid-column: 3; grid-row: 1; }
    .hw-gw-upcoming  { grid-column: 4; grid-row: 1; }
    .hw-gw-classes   { grid-column: 2; grid-row: 2; }
    .hw-gw-ipos      { grid-column: 3; grid-row: 2; }
    .hw-gw-files     { grid-column: 4; grid-row: 2; }
    .hw-gw-activity  { grid-column: 1; grid-row: 3; }
    .hw-gw-econ      { grid-column: 2; grid-row: 3; }
    .hw-gw-contacts  { grid-column: 3; grid-row: 3; }
    .hw-gw-news      { grid-column: 4; grid-row: 3; }
  }
  @media (min-width: 821px) and (max-width: 1200px) {
    .hw-grid { grid-template-columns: repeat(3, 1fr); grid-auto-rows: minmax(160px, auto); grid-auto-flow: row dense; height: auto; }
    .hw-gw-reminders { grid-row: span 2; }
  }
  @media (min-width: 481px) and (max-width: 820px) {
    .hw-grid { grid-template-columns: repeat(2, 1fr); grid-auto-rows: minmax(150px, auto); grid-auto-flow: row dense; height: auto; gap: 9px; }
    .hw-gw-reminders { grid-row: span 2; }
    .hw-pad { padding: 9px 10px 7px; }
    .hw-kpi { font-size: 16px; }
    .hw-title { font-size: 9.5px; }
    .hw-row { font-size: 10px; }
  }
  @media (max-width: 480px) {
    .hw-grid { grid-template-columns: 1fr; grid-auto-rows: auto; grid-auto-flow: row; height: auto; gap: 8px; }
    .hw-gw-reminders { grid-row: auto; }
    .hw-pad { padding: 9px 10px 7px; }
    .hw-kpi { font-size: 16px; }
  }
`;
