import { escapeHtml } from "../util/html.js";
import { iconEdit } from "./icons.js";

// A small "manage this in Settings" affordance for widgets/pages whose
// underlying data is configured elsewhere — links straight to the owning
// section via its jump-nav anchor (see settingsPage.ts's jumpSection ids)
// rather than dropping the user at the top of a long Settings page.

// Icon-only, sized to match .card-collapse-btn — for a Home widget card's
// header, where a text label would crowd the title.
export function renderCardEditLink(anchor: string, label: string): string {
  return `<a class="card-edit-btn" href="/donna/settings#${escapeHtml(anchor)}" title="Edit ${escapeHtml(label)} in Settings" aria-label="Edit ${escapeHtml(label)} in Settings">${iconEdit}</a>`;
}

// Icon + text, for a full page's own title area, where there's room to
// say what it does rather than relying on a title-attribute tooltip.
export function renderPageEditLink(anchor: string, label: string): string {
  return `<a class="page-edit-link" href="/donna/settings#${escapeHtml(anchor)}">${iconEdit}Edit ${escapeHtml(label)}</a>`;
}
