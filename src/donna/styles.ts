export const BASE_STYLES = `
  @font-face {
    font-family: "Merriweather";
    font-style: normal;
    font-weight: 400;
    font-display: swap;
    src: url("/fonts/merriweather-400.woff2") format("woff2");
  }
  @font-face {
    font-family: "Merriweather";
    font-style: normal;
    font-weight: 700;
    font-display: swap;
    src: url("/fonts/merriweather-700.woff2") format("woff2");
  }
  @font-face {
    font-family: "Merriweather";
    font-style: italic;
    font-weight: 400;
    font-display: swap;
    src: url("/fonts/merriweather-400italic.woff2") format("woff2");
  }
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
    --sans: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    --display: "Merriweather", Georgia, "Times New Roman", serif;
    --mono: SFMono-Regular, Consolas, "Liberation Mono", Menlo, Courier, monospace;
    --sp-1: 8px;
    --sp-2: 16px;
    --sp-3: 24px;
    --sp-4: 32px;
    --sp-6: 48px;
    --sp-8: 64px;
  }
  * { box-sizing: border-box; }
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
    background: var(--ink);
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
    background: #fff;
    color: var(--ink);
    border: 1px solid var(--border);
  }
  .sidebar-user {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: var(--sp-2) 8px 0;
    margin-top: auto;
    border-top: 1px solid var(--border);
  }
  .sidebar-user-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--taupe);
    flex: 0 0 auto;
  }
  .sidebar-user-name { font-size: 14px; font-weight: 500; color: var(--ink); }

  .main-content {
    flex: 1;
    min-width: 0;
    max-width: 1200px;
    padding: var(--sp-6) var(--sp-4) var(--sp-8);
  }

  .bottom-nav { display: none; }

  @media (max-width: 860px) {
    .sidebar { display: none; }
    .main-content { padding: var(--sp-3) var(--sp-2) 90px; max-width: 100%; }
    .bottom-nav {
      display: flex;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #fff;
      border-top: 1px solid var(--border);
      justify-content: space-around;
      padding: 8px 4px calc(8px + env(safe-area-inset-bottom));
      z-index: 900;
    }
    .bottom-nav-link {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      color: var(--text-muted);
      text-decoration: none;
      font-size: 10px;
      flex: 1;
    }
    .bottom-nav-link svg { width: 20px; height: 20px; }
    .bottom-nav-link-active { color: var(--accent); }
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
  .card-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--sp-2);
    margin-bottom: var(--sp-4);
  }
  @media (max-width: 860px) {
    .card-row { grid-template-columns: 1fr; }
  }
  .card-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    margin: 0 0 var(--sp-2);
  }
  .card-icon { color: var(--text-muted); margin-bottom: 6px; }

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
    gap: 8px;
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
  .newsletter-frame { width: 100%; height: 500px; border: none; }

  /* --- agenda (calendar page) --- */
  .agenda-day-group {
    margin-bottom: var(--sp-3);
    border-left: 3px solid var(--border);
    padding-left: var(--sp-2);
  }
  .agenda-day-group-today { border-left-color: var(--accent); }
  .agenda-day-header {
    font-weight: 600;
    font-size: 13px;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 8px;
  }
  .agenda-day-header-today { color: var(--accent); }
  .agenda-today-badge {
    display: inline-block;
    background: var(--accent);
    color: #fff;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.03em;
    border-radius: 4px;
    padding: 1px 6px;
    margin-left: 8px;
    text-transform: none;
  }
  .agenda-event-row { display: flex; gap: var(--sp-2); padding: 8px 0; }
  .agenda-event-time { flex: 0 0 90px; font-weight: 500; font-size: 13px; color: var(--text-secondary); }
  .agenda-event-title { font-size: 14px; color: var(--ink); }
  .agenda-event-detail { font-size: 12px; color: var(--text-muted); }

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
  }
  .reminder-row-overdue { border-left-color: var(--danger); }
  .reminder-row-today { border-left-color: var(--accent); }
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
  .reminder-edit-link { font-size: 12px; color: var(--text-muted); text-decoration: none; flex: 0 0 auto; }
  .reminder-edit-link:hover { color: var(--accent); }

  .reminder-add-form { display: flex; flex-direction: column; gap: 10px; margin-top: var(--sp-2); }
  .reminder-add-row2 { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .reminder-add-row2 input[type="date"],
  .reminder-add-row2 input[type="time"] { flex: 0 0 auto; }
  .btn-small { padding: 6px 10px; font-size: 12px; }
  .reminder-add-form textarea { min-height: 60px; }

  .reminder-edit-form { display: flex; flex-direction: column; gap: var(--sp-2); }
  .reminder-edit-actions { display: flex; gap: 8px; }

  /* --- files --- */
  .file-library-layout { display: flex; gap: var(--sp-3); align-items: flex-start; }
  .file-library { flex: 7 1 0; min-width: 0; }
  .action-panel { flex: 3 1 0; min-width: 220px; }
  @media (max-width: 860px) {
    .file-library-layout { flex-direction: column; }
  }
  .file-table-controls { display: flex; gap: 10px; margin-bottom: var(--sp-2); flex-wrap: wrap; }
  .file-table-controls input[type="text"],
  .file-table-controls select { padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 13px; font-family: var(--sans); background: #fff; }
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
  .class-block { margin-bottom: var(--sp-3); }
  .class-title { font-weight: 600; margin-bottom: 8px; }
  .class-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border); }
  .add-class-form { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
  .add-class-form input { flex: 1 1 160px; }

  .upload-form {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: var(--sp-2);
    margin-bottom: var(--sp-2);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .upload-form select, .upload-form input[type="file"] { padding: 8px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px; font-family: var(--sans); background: #fff; }
  .upload-item { border-bottom: 1px solid var(--border); padding: 10px 0; }
  .upload-item:last-child { border-bottom: none; }
  .upload-status { font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-muted); }
  .upload-notes { white-space: pre-wrap; font-size: 14px; margin-top: 6px; }

  /* --- ask popup --- */
  .ask-popup {
    position: fixed;
    max-width: 320px;
    background: var(--ink);
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
  .field input[type="text"], .field textarea {
    width: 100%;
    padding: 9px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 14px;
    font-family: inherit;
    background: #fff;
  }
  .field input.input-mono { font-family: var(--mono); }
  .field textarea { min-height: 100px; }
  .hint { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

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
  .btn-secondary { background: #fff; color: var(--ink); border: 1px solid var(--border); }
  .btn-secondary:hover { background: var(--sidebar-bg); }
  .btn-danger { background: #fff; color: var(--danger); border: 1px solid var(--border); }
  .btn-danger:hover { background: #fbeeec; }
  .btn-block { width: 100%; justify-content: center; }

  /* --- chat (FAB overlay) --- */
  .chat-log { display: flex; flex-direction: column; gap: 12px; margin-bottom: var(--sp-2); min-height: 200px; }
  .chat-bubble { padding: 10px 14px; border-radius: 12px; max-width: 85%; font-size: 14px; white-space: pre-wrap; }
  .chat-bubble-user { background: var(--accent); color: #fff; align-self: flex-end; }
  .chat-bubble-assistant { background: var(--sidebar-bg); color: var(--ink); align-self: flex-start; }

  .chat-fab {
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--accent);
    color: #fff;
    border: none;
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  @media (max-width: 860px) {
    .chat-fab { bottom: calc(76px + env(safe-area-inset-bottom)); }
  }
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
  .chat-overlay-header {
    background: var(--ink);
    color: #fff;
    padding: 14px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: var(--display);
    font-weight: 700;
  }
  .chat-overlay-close { background: none; border: none; color: #fff; font-size: 18px; cursor: pointer; }
  .chat-overlay-body { flex: 1; overflow-y: auto; padding: var(--sp-2); display: flex; flex-direction: column; gap: 10px; }
  .chat-overlay-footer { border-top: 1px solid var(--border); padding: 10px; display: flex; gap: 8px; }
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
`;
