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

  :root {
    color-scheme: light;
    --paper: #fbf9f6;
    --ink: #000000;
    --body-text: #333333;
    --muted: #767676;
    --rule: #e0e0e0;
    --navy: #1a4d64;
    --gray-box: #f0f0f0;
    --chat-user-bg: #1d3557;
    --accent-ecm: #8c3a2b;
    --accent-markets: #1f4e5f;
    --sans: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    --serif: "Merriweather", Georgia, "Times New Roman", serif;
    --mono: SFMono-Regular, Consolas, "Liberation Mono", Menlo, Courier, monospace;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--paper);
    color: var(--body-text);
    font-family: var(--sans);
    line-height: 1.5;
  }
  .masthead {
    border-bottom: 3px solid var(--ink);
    padding: 20px 16px 14px;
  }
  .masthead-inner {
    max-width: 720px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .masthead-links { display: flex; align-items: baseline; gap: 16px; }
  .wordmark {
    font-family: var(--serif);
    font-weight: 700;
    font-size: 32px;
    color: var(--ink);
    letter-spacing: 0.5px;
  }
  .date {
    color: var(--muted);
    font-size: 14px;
  }
  .nav-link {
    color: var(--navy);
    text-decoration: none;
    font-size: 14px;
  }
  .nav-link:hover { text-decoration: underline; }

  .tab-bar {
    max-width: 720px;
    margin: 0 auto;
    display: flex;
    gap: 4px;
    padding: 0 16px;
  }
  .tab-link {
    padding: 10px 14px;
    font-size: 14px;
    color: var(--muted);
    text-decoration: none;
    border-bottom: 3px solid transparent;
  }
  .tab-link:hover { color: var(--ink); }
  .tab-link-active {
    color: var(--ink);
    font-weight: 600;
    border-bottom-color: var(--navy);
  }
  .content {
    max-width: 720px;
    margin: 0 auto;
    padding: 24px 16px 80px;
  }
  .section { margin-bottom: 40px; }
  .section-title {
    font-family: var(--serif);
    color: var(--ink);
    font-size: 20px;
    border-bottom: 1px solid var(--rule);
    padding-bottom: 8px;
    margin-bottom: 20px;
  }
  .empty { color: var(--muted); font-style: italic; font-family: var(--serif); }

  .story {
    border-bottom: 1px solid var(--rule);
    padding-bottom: 24px;
    margin-bottom: 24px;
  }
  .story:last-child { border-bottom: none; }
  .story-image {
    width: 100%;
    max-height: 320px;
    object-fit: cover;
    border-radius: 0;
    margin-bottom: 14px;
  }
  .story-meta {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-bottom: 8px;
    font-size: 12px;
  }
  .category {
    padding: 2px 8px;
    border-radius: 0;
    color: #fff;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .cat-ecm { background: var(--accent-ecm); }
  .cat-markets { background: var(--accent-markets); }
  .source { color: var(--muted); text-transform: none; letter-spacing: normal; }
  .story-headline {
    font-family: var(--serif);
    font-weight: 700;
    color: var(--ink);
    font-size: 24px;
    line-height: 1.25;
    margin: 0 0 12px;
  }
  .story-body p {
    font-family: var(--serif);
    color: var(--body-text);
    margin: 0 0 12px;
    font-size: 16px;
  }
  .ecm-tag {
    font-family: var(--serif);
    background: var(--gray-box);
    border-left: 4px solid var(--navy);
    padding: 10px 14px;
    font-size: 14px;
    margin: 14px 0;
  }
  .story-link {
    font-family: var(--sans);
    font-size: 14px;
    color: var(--navy);
    text-decoration: none;
  }
  .story-link:hover { text-decoration: underline; }

  .newsletter {
    border: 1px solid var(--rule);
    border-radius: 0;
    padding: 14px;
    margin-bottom: 16px;
  }
  .newsletter-meta {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    color: var(--muted);
    margin-bottom: 10px;
  }
  .newsletter-subject { font-weight: 600; color: var(--ink); }
  .newsletter-frame {
    width: 100%;
    height: 500px;
    border: none;
  }

  .brief-columns {
    display: flex;
    gap: 32px;
  }
  .brief-col { flex: 1 1 0; min-width: 0; }
  .brief-col h2 {
    font-family: var(--serif);
    color: var(--ink);
    font-size: 16px;
    margin: 0 0 14px;
  }
  @media (max-width: 600px) {
    .brief-columns { flex-direction: column; gap: 24px; }
  }

  .event {
    display: flex;
    gap: 16px;
    padding: 10px 0;
    border-bottom: 1px solid var(--rule);
  }
  .event:last-child { border-bottom: none; }
  .event-time {
    flex: 0 0 130px;
    font-weight: 600;
    font-size: 14px;
  }
  .event-title { font-size: 15px; }
  .event-detail { font-size: 13px; color: var(--muted); }

  .recent-item {
    padding: 10px 0;
    border-bottom: 1px solid var(--rule);
    font-size: 14px;
  }
  .recent-item:last-child { border-bottom: none; }
  .recent-item-time { color: var(--muted); font-size: 12px; }

  .reminders {
    margin: 0;
    padding-left: 20px;
  }
  .reminders li { margin-bottom: 6px; }

  .file-list { list-style: none; margin: 0; padding: 0; }
  .file-list li {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid var(--rule);
    font-size: 14px;
  }
  .file-list li:last-child { border-bottom: none; }
  .file-list a { color: var(--navy); text-decoration: none; }
  .file-list a:hover { text-decoration: underline; }
  .class-block { margin-bottom: 24px; }
  .class-title { font-weight: 600; margin-bottom: 8px; }

  .ask-popup {
    position: fixed;
    max-width: 320px;
    background: var(--navy);
    color: #fff;
    padding: 12px 14px;
    font-family: var(--serif);
    font-size: 14px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.25);
    z-index: 1000;
  }
  .ask-popup.hidden { display: none; }
  .ask-button {
    position: fixed;
    background: var(--navy);
    color: #fff;
    border: none;
    padding: 6px 12px;
    font-family: var(--sans);
    font-size: 13px;
    cursor: pointer;
    z-index: 1000;
  }

  form.settings-form { margin-bottom: 32px; }
  .field { margin-bottom: 16px; }
  .field label {
    display: block;
    font-family: var(--sans);
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 6px;
  }
  .field input[type="text"],
  .field textarea {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--rule);
    border-radius: 4px;
    font-size: 14px;
    font-family: inherit;
  }
  .field input.input-mono { font-family: var(--mono); }
  .field textarea { min-height: 100px; }
  .hint { font-family: var(--serif); font-style: italic; font-size: 13px; color: var(--muted); margin-top: 4px; }
  .btn {
    background: var(--navy);
    color: #fff;
    border: none;
    border-radius: 0;
    padding: 10px 18px;
    font-family: var(--serif);
    font-size: 14px;
    cursor: pointer;
  }
  .btn:hover { opacity: 0.9; }
  .btn-danger { background: var(--accent-ecm); }
  .btn-block { width: 100%; }
  .class-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid var(--rule);
  }
  .add-class-form { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
  .add-class-form input { flex: 1 1 160px; padding: 8px 10px; border: 1px solid var(--rule); border-radius: 4px; font-size: 14px; }

  .file-library-layout {
    display: flex;
    gap: 32px;
    align-items: flex-start;
  }
  .file-library { flex: 7 1 0; min-width: 0; }
  .action-panel { flex: 3 1 0; min-width: 220px; }
  @media (max-width: 720px) {
    .file-library-layout { flex-direction: column; }
  }
  .file-table-controls {
    display: flex;
    gap: 10px;
    margin-bottom: 14px;
    flex-wrap: wrap;
  }
  .file-table-controls input[type="text"],
  .file-table-controls select {
    padding: 6px 10px;
    border: 1px solid var(--rule);
    border-radius: 4px;
    font-size: 13px;
    font-family: var(--sans);
  }
  .file-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  .file-table th,
  .file-table td {
    text-align: left;
    padding: 8px 10px;
    border-bottom: 1px solid var(--rule);
  }
  .file-table th {
    cursor: pointer;
    user-select: none;
    font-family: var(--sans);
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--muted);
  }
  .file-table th:hover { color: var(--ink); }
  .sort-indicator { font-size: 10px; margin-left: 4px; color: var(--navy); }
  .file-table a { color: var(--navy); text-decoration: none; }
  .file-table a:hover { text-decoration: underline; }
  .file-icon { margin-right: 6px; }

  .upload-form {
    border: 1px solid var(--rule);
    padding: 14px;
    margin-bottom: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .upload-form select,
  .upload-form input[type="file"] {
    padding: 6px;
    border: 1px solid var(--rule);
    border-radius: 4px;
    font-size: 14px;
    font-family: var(--sans);
  }
  .upload-item {
    border-bottom: 1px solid var(--rule);
    padding: 10px 0;
  }
  .upload-item:last-child { border-bottom: none; }
  .upload-status {
    font-family: var(--sans);
    font-size: 12px;
    text-transform: uppercase;
    color: var(--muted);
  }
  .upload-notes {
    white-space: pre-wrap;
    font-size: 14px;
    margin-top: 6px;
  }

  .chat-log {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 16px;
    min-height: 200px;
  }
  .chat-bubble {
    font-family: var(--serif);
    padding: 10px 14px;
    max-width: 85%;
    font-size: 14px;
    white-space: pre-wrap;
  }
  .chat-bubble-user {
    background: var(--chat-user-bg);
    color: #fff;
    align-self: flex-end;
  }
  .chat-bubble-assistant {
    background: var(--gray-box);
    color: var(--ink);
    align-self: flex-start;
  }
  .chat-input-row {
    display: flex;
    gap: 8px;
    position: sticky;
    bottom: 0;
    background: var(--paper);
    padding: 12px 0;
  }
  .chat-input-row input {
    flex: 1;
    padding: 10px 12px;
    border: 1px solid var(--rule);
    border-radius: 6px;
    font-size: 14px;
    font-family: var(--sans);
  }

  .chat-fab {
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--navy);
    color: #fff;
    border: none;
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(0,0,0,0.25);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .chat-scrim {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    z-index: 1001;
    display: none;
  }
  .chat-scrim.open { display: block; }
  .chat-overlay-panel {
    position: fixed;
    top: 0;
    right: -380px;
    bottom: 0;
    width: 350px;
    max-width: 90vw;
    background: var(--paper);
    z-index: 1002;
    display: flex;
    flex-direction: column;
    transition: right 0.25s ease;
    box-shadow: -4px 0 20px rgba(0,0,0,0.2);
  }
  .chat-overlay-panel.open { right: 0; }
  .chat-overlay-header {
    background: var(--navy);
    color: #fff;
    padding: 14px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: var(--serif);
    font-weight: 700;
  }
  .chat-overlay-close {
    background: none;
    border: none;
    color: #fff;
    font-size: 18px;
    cursor: pointer;
  }
  .chat-overlay-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .chat-overlay-footer {
    border-top: 1px solid var(--rule);
    padding: 10px;
    display: flex;
    gap: 8px;
  }
  .chat-overlay-footer input {
    flex: 1;
    border: 1px solid var(--rule);
    border-radius: 20px;
    padding: 8px 14px;
    font-size: 14px;
    font-family: var(--sans);
  }
  .chat-overlay-footer button {
    background: var(--navy);
    color: #fff;
    border: none;
    border-radius: 50%;
    width: 36px;
    height: 36px;
    cursor: pointer;
    flex: 0 0 auto;
  }
`;
