import type { Settings } from "../config.js";
import type { ClassFolder } from "../drive/classFolders.js";
import { escapeHtml } from "../util/html.js";
import { BASE_STYLES } from "./styles.js";

function renderClassRows(classFolders: ClassFolder[]): string {
  if (classFolders.length === 0) {
    return `<p class="empty">No classes added yet.</p>`;
  }

  return classFolders
    .map(
      (cls) => `
        <div class="class-row">
          <span>${escapeHtml(cls.className)}</span>
          <form method="POST" action="/api/donna-settings-save">
            <input type="hidden" name="action" value="delete-class" />
            <input type="hidden" name="id" value="${cls.id}" />
            <button class="btn btn-danger" type="submit">Remove</button>
          </form>
        </div>`
    )
    .join("\n");
}

export function buildSettingsHtml(
  settings: Settings,
  classFolders: ClassFolder[],
  saved: boolean,
  error?: string
): string {
  const remindersText = settings.reminders.join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Donna Settings</title>
<style>
${BASE_STYLES}
</style>
</head>
<body>
  <header class="masthead">
    <div class="masthead-inner">
      <div class="wordmark">Donna</div>
      <div class="masthead-links">
        <a class="nav-link" href="/donna">Back to brief</a>
      </div>
    </div>
  </header>

  <main class="content">
    ${saved ? `<p class="hint" style="margin-bottom:20px;">Saved.</p>` : ""}
    ${error === "invalid-link" ? `<p class="hint" style="margin-bottom:20px;color:var(--accent-ecm);">Couldn't read that Drive folder link — paste the full share link.</p>` : ""}

    <section class="section">
      <h1 class="section-title">Brief settings</h1>
      <form class="settings-form" method="POST" action="/api/donna-settings-save">
        <input type="hidden" name="action" value="save-settings" />

        <div class="field">
          <label for="timezone">Timezone</label>
          <input type="text" id="timezone" name="timezone" value="${escapeHtml(settings.timezone)}" />
          <div class="hint">An IANA timezone name, e.g. America/New_York</div>
        </div>

        <div class="field">
          <label for="reminders">Reminders (one per line)</label>
          <textarea id="reminders" name="reminders">${escapeHtml(remindersText)}</textarea>
        </div>

        <div class="field">
          <label for="newsletterQuery">Newsletter search query</label>
          <input type="text" id="newsletterQuery" name="newsletterQuery" value="${escapeHtml(settings.newsletterQuery)}" />
          <div class="hint">Gmail search syntax, e.g. newer_than:2d label:newsletters</div>
        </div>

        <button class="btn" type="submit">Save</button>
      </form>
    </section>

    <section class="section">
      <h1 class="section-title">Classes</h1>
      ${renderClassRows(classFolders)}

      <form class="add-class-form" method="POST" action="/api/donna-settings-save">
        <input type="hidden" name="action" value="add-class" />
        <input type="text" name="className" placeholder="Class name, e.g. ECO 301" required />
        <input type="text" name="driveFolderLink" placeholder="Paste Drive folder link" required />
        <button class="btn" type="submit">Add</button>
      </form>
      <div class="hint">Paste a Drive folder's share link — Donna extracts the folder ID automatically.</div>
    </section>
  </main>
</body>
</html>`;
}
