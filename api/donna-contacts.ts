import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadSettings } from "../src/config.js";
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const settings = await loadSettings();

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
            lastContactedAt: body.lastContactedAt,
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
            lastContactedAt: body.lastContactedAt,
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
            occurredAt: body.occurredAt || new Date().toISOString().slice(0, 10),
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
  });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
