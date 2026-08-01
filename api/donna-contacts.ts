import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadSettings } from "../src/config.js";
import { resolveTimezone, localDateKey } from "../src/util/time.js";
import {
  getContacts,
  addContact,
  updateContact,
  deleteContact,
  getInteractionsForContact,
  addInteraction,
  deleteInteraction,
} from "../src/contacts/store.js";
import { addReminder } from "../src/google/tasks.js";
import { isGoogleConfigured } from "../src/google/auth.js";
import { buildContactsHtml } from "../src/donna/contactsPage.js";
import { requireAuth } from "../src/auth/session.js";

// The relationship-tag and interaction-type <select> elements submit
// "Other" plus a companion "<name>Other" text field when the fixed list
// doesn't fit — this resolves either shape down to the actual value to
// store.
function resolveTagField(body: Record<string, string>, name: string): string | undefined {
  const value = body[name]?.trim();
  if (!value) return undefined;
  if (value === "Other") return body[`${name}Other`]?.trim() || undefined;
  return value;
}

// Both date fields below only ever come from <input type="date"> in the
// real UI (always well-formed YYYY-MM-DD), but the forward-only bump in
// addInteraction compares these as plain strings — reject anything else
// rather than risk a malformed value comparing incorrectly.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function resolveIsoDate(raw: string | undefined): string | undefined {
  return raw && ISO_DATE_RE.test(raw) ? raw : undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAuth(req, res)) return;

  const settings = await loadSettings();
  const timezone = resolveTimezone(settings.timezone);

  if (req.method === "POST") {
    const body = (req.body ?? {}) as Record<string, string>;
    const action = body.action;

    try {
      if (action === "add") {
        const name = body.name?.trim();
        if (name) {
          await addContact({
            name,
            firm: body.firm?.trim(),
            notes: body.notes?.trim(),
            lastContactedAt: resolveIsoDate(body.lastContactedAt),
          });
        }
        res.redirect(303, "/donna/contacts");
        return;
      }

      if (action === "update") {
        const id = Number(body.id);
        const name = body.name?.trim();
        if (Number.isFinite(id) && name) {
          await updateContact(id, {
            name,
            firm: body.firm?.trim(),
            notes: body.notes?.trim(),
            lastContactedAt: resolveIsoDate(body.lastContactedAt),
            bio: body.bio?.trim(),
            relationshipTag: resolveTagField(body, "relationshipTag"),
          });
        }
        res.redirect(303, "/donna/contacts");
        return;
      }

      if (action === "delete") {
        const id = Number(body.id);
        if (Number.isFinite(id)) {
          await deleteContact(id);
        }
        res.redirect(303, "/donna/contacts");
        return;
      }

      if (action === "quick-follow-up") {
        const id = Number(body.id);
        if (Number.isFinite(id) && isGoogleConfigured()) {
          const contacts = await getContacts();
          const contact = contacts.find((c) => c.id === id);
          if (contact) {
            const title = contact.firm ? `Follow up with ${contact.name} (${contact.firm})` : `Follow up with ${contact.name}`;
            await addReminder(title);
          }
        }
        res.redirect(303, "/donna/contacts");
        return;
      }

      if (action === "add-interaction") {
        const contactId = Number(body.contactId);
        const interactionType = resolveTagField(body, "interactionType");
        if (Number.isFinite(contactId) && interactionType) {
          await addInteraction(contactId, {
            interactionType,
            notes: body.notes?.trim(),
            occurredAt: resolveIsoDate(body.occurredAt) ?? localDateKey(new Date(), timezone),
          });
        }
        res.redirect(303, `/donna/contacts?edit=${contactId}`);
        return;
      }

      if (action === "delete-interaction") {
        const id = Number(body.id);
        const contactId = Number(body.contactId);
        if (Number.isFinite(id)) {
          await deleteInteraction(id);
        }
        res.redirect(303, `/donna/contacts?edit=${contactId}`);
        return;
      }

      res.status(400).send("Unknown action");
    } catch (err) {
      console.error("Contact action failed:", err);
      res.redirect(303, "/donna/contacts?error=1");
    }
    return;
  }

  const error = req.query.error === "1" ? "Something went wrong — try again." : undefined;
  const editId = typeof req.query.edit === "string" ? Number(req.query.edit) : undefined;

  const contacts = await getContacts();
  const editing = editId ? contacts.find((c) => c.id === editId) ?? null : null;
  const editingInteractions = editing ? await getInteractionsForContact(editing.id) : undefined;

  const html = buildContactsHtml({
    contacts,
    editing,
    editingInteractions,
    error,
    navVisibility: settings.dashboardConfig.navVisibility,
    navOrder: settings.dashboardConfig.navOrder,
    timezone,
  });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
