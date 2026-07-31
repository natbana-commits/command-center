export const BASE_STYLES = `
  :root {
    color-scheme: light;
    --ink: #1a1a1a;
    --paper: #fdfcf9;
    --rule: #ddd8cc;
    --accent-ecm: #8c3a2b;
    --accent-markets: #1f4e5f;
    --muted: #6b6558;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--paper);
    color: var(--ink);
    font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
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
    font-family: Georgia, "Times New Roman", serif;
    font-weight: 700;
    font-size: 32px;
    letter-spacing: 0.5px;
  }
  .date {
    color: var(--muted);
    font-size: 14px;
  }
  .nav-link {
    color: var(--accent-markets);
    text-decoration: none;
    font-size: 14px;
  }
  .nav-link:hover { text-decoration: underline; }
  .content {
    max-width: 720px;
    margin: 0 auto;
    padding: 24px 16px 80px;
  }
  .section { margin-bottom: 40px; }
  .section-title {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 20px;
    border-bottom: 1px solid var(--rule);
    padding-bottom: 8px;
    margin-bottom: 20px;
  }
  .empty { color: var(--muted); font-style: italic; }

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
    border-radius: 4px;
    margin-bottom: 14px;
  }
  .story-meta {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-bottom: 8px;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .category {
    padding: 2px 8px;
    border-radius: 3px;
    color: #fff;
    font-weight: 600;
  }
  .cat-ecm { background: var(--accent-ecm); }
  .cat-markets { background: var(--accent-markets); }
  .source { color: var(--muted); }
  .story-headline {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 24px;
    line-height: 1.25;
    margin: 0 0 12px;
  }
  .story-body p {
    margin: 0 0 12px;
    font-size: 16px;
  }
  .ecm-tag {
    background: #f2ede0;
    border-left: 3px solid var(--accent-ecm);
    padding: 10px 14px;
    font-size: 14px;
    margin: 14px 0;
  }
  .story-link {
    font-size: 14px;
    color: var(--accent-markets);
    text-decoration: none;
  }
  .story-link:hover { text-decoration: underline; }

  .newsletter {
    border: 1px solid var(--rule);
    border-radius: 6px;
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
  .file-list a { color: var(--accent-markets); text-decoration: none; }
  .file-list a:hover { text-decoration: underline; }
  .class-block { margin-bottom: 24px; }
  .class-title { font-weight: 600; margin-bottom: 8px; }

  .ask-popup {
    position: fixed;
    max-width: 320px;
    background: var(--ink);
    color: var(--paper);
    padding: 12px 14px;
    border-radius: 8px;
    font-size: 14px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.25);
    z-index: 1000;
  }
  .ask-popup.hidden { display: none; }
  .ask-button {
    position: fixed;
    background: var(--accent-markets);
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 13px;
    cursor: pointer;
    z-index: 1000;
  }

  form.settings-form { margin-bottom: 32px; }
  .field { margin-bottom: 16px; }
  .field label {
    display: block;
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
  .field textarea { min-height: 100px; }
  .hint { font-size: 12px; color: var(--muted); margin-top: 4px; }
  .btn {
    background: var(--accent-markets);
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 8px 16px;
    font-size: 14px;
    cursor: pointer;
  }
  .btn:hover { opacity: 0.9; }
  .btn-danger { background: var(--accent-ecm); }
  .class-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid var(--rule);
  }
  .add-class-form { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
  .add-class-form input { flex: 1 1 160px; padding: 8px 10px; border: 1px solid var(--rule); border-radius: 4px; font-size: 14px; }
`;
