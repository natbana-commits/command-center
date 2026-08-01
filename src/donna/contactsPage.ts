import type { NavVisibility } from "../config.js";
import type { Contact } from "../contacts/store.js";
import { escapeHtml } from "../util/html.js";
import { renderLayout } from "./layout.js";

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function renderContactRow(c: Contact): string {
  const meta = [c.firm, c.lastContactedAt ? `Last contact: ${formatDate(c.lastContactedAt)}` : null]
    .filter(Boolean)
    .join(" · ");

  return `
    <div class="reminder-row">
      <div class="reminder-body">
        <span class="reminder-title">${escapeHtml(c.name)}</span>
        ${meta ? `<span class="hint" style="margin:0;">${escapeHtml(meta)}</span>` : ""}
      </div>
      <form method="POST" action="/donna/contacts" style="display:contents;">
        <input type="hidden" name="action" value="quick-follow-up" />
        <input type="hidden" name="id" value="${c.id}" />
        <button class="btn-secondary btn-small" type="submit">+ Reminder</button>
      </form>
      <a class="reminder-edit-link" href="/donna/contacts?edit=${c.id}">Edit</a>
    </div>`;
}

function renderAddForm(): string {
  return `
    <form method="POST" action="/donna/contacts" class="reminder-add-form">
      <input type="hidden" name="action" value="add" />
      <input type="text" name="name" placeholder="Name" required />
      <input type="text" name="firm" placeholder="Firm (optional)" />
      <div class="reminder-add-row2">
        <label class="hint" for="contact-last-contacted" style="margin:0;">Last contact</label>
        <input type="date" id="contact-last-contacted" name="lastContactedAt" />
      </div>
      <textarea name="notes" placeholder="Notes (optional)"></textarea>
      <button class="btn" type="submit">Add</button>
    </form>`;
}

function renderEditForm(c: Contact): string {
  return `
    <form method="POST" action="/donna/contacts" class="reminder-edit-form">
      <input type="hidden" name="action" value="update" />
      <input type="hidden" name="id" value="${c.id}" />

      <div class="field">
        <label for="edit-name">Name</label>
        <input type="text" id="edit-name" name="name" value="${escapeHtml(c.name)}" required />
      </div>

      <div class="field">
        <label for="edit-firm">Firm</label>
        <input type="text" id="edit-firm" name="firm" value="${escapeHtml(c.firm ?? "")}" />
      </div>

      <div class="field">
        <label for="edit-last-contacted">Last contact</label>
        <input type="date" id="edit-last-contacted" name="lastContactedAt" value="${escapeHtml(c.lastContactedAt ?? "")}" />
      </div>

      <div class="field">
        <label for="edit-notes">Notes</label>
        <textarea id="edit-notes" name="notes">${escapeHtml(c.notes ?? "")}</textarea>
      </div>

      <div class="reminder-edit-actions">
        <button class="btn" type="submit">Save</button>
        <a class="btn btn-secondary" href="/donna/contacts">Cancel</a>
      </div>
    </form>
    <form method="POST" action="/donna/contacts" style="margin-top: 8px;">
      <input type="hidden" name="action" value="delete" />
      <input type="hidden" name="id" value="${c.id}" />
      <button class="btn btn-danger" type="submit">Delete contact</button>
    </form>`;
}

export interface ContactsPageData {
  contacts: Contact[];
  editing?: Contact | null;
  error?: string;
  navVisibility: NavVisibility;
}

export function buildContactsHtml(data: ContactsPageData): string {
  const { contacts, editing, error, navVisibility } = data;

  let body: string;

  if (editing) {
    body = `
      <div class="section">
        <h1 class="page-title">Edit contact</h1>
      </div>
      <div class="card">
        ${renderEditForm(editing)}
      </div>`;
  } else {
    const listHtml =
      contacts.length === 0
        ? `<p class="empty">No contacts yet.</p>`
        : contacts.map(renderContactRow).join("\n");

    body = `
      <div class="section">
        <h1 class="page-title">Contacts</h1>
        <p class="page-sub">${contacts.length} tracked</p>
      </div>
      ${error ? `<p class="hint" style="color:var(--danger);margin-bottom:16px;">${escapeHtml(error)}</p>` : ""}
      <div class="card">
        ${listHtml}
        ${renderAddForm()}
      </div>`;
  }

  return renderLayout({
    title: "Donna Contacts",
    activeTab: "contacts",
    bodyHtml: body,
    showChatFab: true,
    navVisibility,
  });
}
