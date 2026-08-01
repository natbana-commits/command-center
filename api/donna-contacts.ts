import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadSettings } from "../src/config.js";
import { getContacts, addContact, updateContact, deleteContact } from "../src/contacts/store.js";
import { addReminder } from "../src/google/tasks.js";
import { isGoogleConfigured } from "../src/google/auth.js";
import { buildContactsHtml } from "../src/donna/contactsPage.js";

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

  const html = buildContactsHtml({
    contacts,
    editing,
    error,
    navVisibility: settings.dashboardConfig.navVisibility,
  });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
