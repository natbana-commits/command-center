import type { NavVisibility } from "../config.js";
import type { Contact, ContactInteraction } from "../contacts/store.js";
import { escapeHtml } from "../util/html.js";
import { formatRelativeTime, localDateKey } from "../util/time.js";
import { renderLayout } from "./layout.js";
import { tileColorForSeed } from "./tileColor.js";

export const INTERACTION_TYPES = ["Call", "Email", "Coffee Chat", "Meeting", "Event"];
export const RELATIONSHIP_TAGS = ["Recruiter", "Alum", "Mentor", "Peer", "Friend"];

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// A <select> of fixed options plus an "Other" entry that reveals a
// free-text input — used for both the relationship tag and the
// interaction type, so a value outside the fixed list (typed in
// previously via "Other") still round-trips correctly: the select lands
// on "Other" and the wrap starts open with the stored value prefilled.
function renderTagSelect(name: string, options: string[], current: string | null, wrapId: string): string {
  const isOther = Boolean(current) && !options.includes(current!);
  const optionsHtml = options
    .map((opt) => `<option value="${escapeHtml(opt)}" ${current === opt ? "selected" : ""}>${escapeHtml(opt)}</option>`)
    .join("");

  return `
    <select name="${name}" onchange="toggleOtherInput(this, '${wrapId}')">
      <option value="">None</option>
      ${optionsHtml}
      <option value="Other" ${isOther ? "selected" : ""}>Other…</option>
    </select>
    <div class="tag-other-wrap" id="${wrapId}" style="display:${isOther ? "" : "none"};">
      <input type="text" name="${name}Other" placeholder="Custom" value="${escapeHtml(isOther ? current! : "")}" />
    </div>`;
}

function renderContactRow(c: Contact): string {
  const lastContact = c.lastContactedAt ? formatRelativeTime(`${c.lastContactedAt}T12:00:00`) : "Never contacted";
  const meta = [c.firm, lastContact].filter(Boolean).join(" · ");
  const { tint } = tileColorForSeed(c.name);

  return `
    <div class="reminder-row" style="background-image: linear-gradient(135deg, ${tint} 0%, var(--card) 65%);">
      <div class="reminder-body">
        <div class="interaction-meta">
          <span class="reminder-title">${escapeHtml(c.name)}</span>
          ${c.relationshipTag ? `<span class="tag-chip">${escapeHtml(c.relationshipTag)}</span>` : ""}
        </div>
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

function renderInteractionRow(i: ContactInteraction, contactId: number): string {
  return `
    <div class="interaction-row">
      <div class="interaction-body">
        <div class="interaction-meta">
          <span class="tag-chip">${escapeHtml(i.interactionType)}</span>
          <span class="interaction-date">${escapeHtml(formatDate(i.occurredAt))}</span>
        </div>
        ${i.notes ? `<div class="interaction-notes">${escapeHtml(i.notes)}</div>` : ""}
      </div>
      <form method="POST" action="/donna/contacts">
        <input type="hidden" name="action" value="delete-interaction" />
        <input type="hidden" name="id" value="${i.id}" />
        <input type="hidden" name="contactId" value="${contactId}" />
        <button class="reminder-edit-link" type="submit" style="background:none;border:none;cursor:pointer;">Delete</button>
      </form>
    </div>`;
}

function renderInteractionsSection(
  contactId: number,
  interactions: ContactInteraction[],
  timezone: string
): string {
  const today = localDateKey(new Date(), timezone);
  const listHtml =
    interactions.length === 0
      ? `<p class="empty">No interactions logged yet.</p>`
      : interactions.map((i) => renderInteractionRow(i, contactId)).join("\n");

  return `
    <div class="interactions-section">
      <h1 class="section-title">Interactions</h1>
      ${listHtml}
      <form method="POST" action="/donna/contacts" class="interaction-add-form">
        <input type="hidden" name="action" value="add-interaction" />
        <input type="hidden" name="contactId" value="${contactId}" />
        <div class="interaction-add-row">
          ${renderTagSelect("interactionType", INTERACTION_TYPES, null, "interaction-type-other-wrap")}
          <label class="hint" style="margin:0;">Date</label>
          <input type="date" name="occurredAt" value="${today}" />
        </div>
        <textarea name="notes" placeholder="Notes (optional)"></textarea>
        <button class="btn btn-secondary btn-small" type="submit">Log interaction</button>
      </form>
    </div>`;
}

function renderEditForm(c: Contact, interactions: ContactInteraction[], timezone: string): string {
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
        <label>Relationship</label>
        ${renderTagSelect("relationshipTag", RELATIONSHIP_TAGS, c.relationshipTag, "relationship-tag-other-wrap")}
      </div>

      <div class="field">
        <label for="edit-last-contacted">Last contact</label>
        <input type="date" id="edit-last-contacted" name="lastContactedAt" value="${escapeHtml(c.lastContactedAt ?? "")}" />
      </div>

      <div class="field">
        <label for="edit-bio">Bio / info</label>
        <textarea id="edit-bio" name="bio">${escapeHtml(c.bio ?? "")}</textarea>
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
    </form>
    ${renderInteractionsSection(c.id, interactions, timezone)}`;
}

export interface ContactsPageData {
  contacts: Contact[];
  editing?: Contact | null;
  editingInteractions?: ContactInteraction[];
  error?: string;
  navVisibility: NavVisibility;
  navOrder: string[];
  timezone: string;
}

export function buildContactsHtml(data: ContactsPageData): string {
  const { contacts, editing, editingInteractions, error, navVisibility, navOrder, timezone } = data;

  let body: string;

  if (editing) {
    body = `
      <div class="section">
        <h1 class="page-title">Edit contact</h1>
      </div>
      <div class="card">
        ${renderEditForm(editing, editingInteractions ?? [], timezone)}
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
    pageScript: CLIENT_SCRIPT,
    showChatFab: true,
    navVisibility,
    navOrder,
  });
}

const CLIENT_SCRIPT = `
  function toggleOtherInput(select, wrapId) {
    const wrap = document.getElementById(wrapId);
    if (wrap) wrap.style.display = select.value === "Other" ? "" : "none";
  }
`;
