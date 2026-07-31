import type { Settings } from "../config.js";
import type { ClassFolder } from "../drive/classFolders.js";
import { escapeHtml } from "../util/html.js";
import { renderLayout } from "./layout.js";

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
  const body = `
    ${saved ? `<p class="hint" style="margin-bottom:20px;">Saved.</p>` : ""}
    ${error === "invalid-link" ? `<p class="hint" style="margin-bottom:20px;color:var(--accent-ecm);">Couldn't read that Drive folder link — paste the full share link.</p>` : ""}

    <section class="section">
      <h1 class="section-title">Brief settings</h1>
      <form class="settings-form" method="POST" action="/api/donna-settings-save">
        <input type="hidden" name="action" value="save-settings" />

        <div class="field">
          <label for="timezone">Timezone</label>
          <input class="input-mono" type="text" id="timezone" name="timezone" value="${escapeHtml(settings.timezone)}" />
          <div class="hint">An IANA timezone name, e.g. America/New_York</div>
        </div>

        <div class="field">
          <label for="newsletterQuery">Newsletter search query</label>
          <input class="input-mono" type="text" id="newsletterQuery" name="newsletterQuery" value="${escapeHtml(settings.newsletterQuery)}" />
          <div class="hint">Gmail search syntax, e.g. newer_than:2d label:newsletters</div>
        </div>

        <button class="btn" type="submit">Save</button>
      </form>
      <p class="hint">Reminders now live in Google Tasks — ask Donna (Telegram or Chat) to add or check them off.</p>
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
    </section>`;

  return renderLayout({
    title: "Donna Settings",
    activeTab: "settings",
    bodyHtml: body,
    showChatFab: true,
  });
}
