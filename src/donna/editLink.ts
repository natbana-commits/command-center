import { escapeHtml } from "../util/html.js";
import { iconEdit } from "./icons.js";

// A small "manage this in Settings" affordance for a page's own title
// area — links straight to the owning section via its jump-nav anchor
// (see settingsPage.ts's jumpSection ids) rather than dropping the user
// at the top of a long Settings page.
export function renderPageEditLink(anchor: string, label: string): string {
  return `<a class="page-edit-link" href="/donna/settings#${escapeHtml(anchor)}">${iconEdit}Edit ${escapeHtml(label)}</a>`;
}
