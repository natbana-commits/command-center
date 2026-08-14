export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// For text embedded inside a single-quoted JS string literal that itself
// sits inside a double-quoted HTML attribute (e.g. onsubmit="return
// confirm('...')"). escapeHtml alone isn't enough here: the browser HTML-
// decodes the attribute (turning &#39; back into ') before the JS parser
// ever sees it, so a plain escapeHtml'd value can still terminate the JS
// string early. Backslash-escaping the JS-meaningful characters first,
// THEN HTML-escaping the result, survives both decode steps intact.
export function escapeHtmlJsString(text: string): string {
  return escapeHtml(text.replace(/\\/g, "\\\\").replace(/'/g, "\\'"));
}

// Crude tag-stripping for a plain-text preview/digest, not a clean
// extraction. <style>/<script> blocks are stripped along with their
// contents first — raw HTML (newsletter emails, SEC filings) routinely
// leads with a large inline <style> block, and a plain tag-strip alone
// would leave that raw CSS as the first "text" in the document.
export function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
