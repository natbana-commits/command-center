export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
