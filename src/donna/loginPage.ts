import { escapeHtml } from "../util/html.js";

// Deliberately not built on renderLayout: this page renders before a
// session exists, so it skips the sidebar/nav/chat-FAB entirely rather
// than showing authenticated-only chrome to a logged-out visitor.
export function buildLoginHtml(error?: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Donna — Sign in</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #faf8f5;
  }
  .login-card {
    width: 100%;
    max-width: 320px;
    padding: 32px;
    border-radius: 12px;
    border: 1px solid #e7e0d8;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  }
  .login-logo { font-family: Georgia, serif; font-size: 22px; color: #2b2620; margin-bottom: 4px; }
  .login-sub { color: #7a736a; font-size: 14px; margin: 0 0 20px; }
  .login-error { color: #b8442e; font-size: 13px; margin: 0 0 12px; }
  input[type="password"] {
    width: 100%;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid #ddd4c8;
    font-size: 15px;
    margin-bottom: 12px;
  }
  button {
    width: 100%;
    padding: 10px 12px;
    border-radius: 8px;
    border: none;
    background: #b86b45;
    color: #fff;
    font-size: 15px;
    cursor: pointer;
  }
  button:hover { background: #a15e3a; }
</style>
</head>
<body>
  <div class="login-card">
    <div class="login-logo">Donna</div>
    <p class="login-sub">Sign in to continue</p>
    ${error ? `<p class="login-error">${escapeHtml(error)}</p>` : ""}
    <form method="POST" action="/donna/login">
      <input type="password" name="password" placeholder="Password" autofocus required />
      <button type="submit">Sign in</button>
    </form>
  </div>
</body>
</html>`;
}
