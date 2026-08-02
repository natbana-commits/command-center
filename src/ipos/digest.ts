// Trimmed from 50000/12000/90000 — a smaller input digest means less
// prefill time per filing, which matters now that this whole check runs
// under a hard wall-clock cap (see formatBrief.ts's IPO_CHECK_TIMEOUT_MS)
// shared across up to MAX_PER_RUN concurrent filings. Still generous
// enough to reliably cover the cover page, prospectus summary, and risk
// factors on a typical S-1.
const FRONT_MATTER_CHARS = 30000;
const SECTION_WINDOW_CHARS = 8000;
const MAX_DIGEST_CHARS = 55000;

const TAIL_SECTION_ANCHORS = ["USE OF PROCEEDS", "CAPITALIZATION", "UNDERWRITING"];

// Best-effort, not a true chunk-and-recursively-summarize read of the
// full filing (a real S-1 can run over a million characters of plain
// text — far too large to send whole to Claude). A generous front-
// truncation reliably captures the cover page, prospectus summary, and
// risk factors regardless of the filing's total length (SEC Item 501-503
// requires S-1s to open in that order), then a keyword-anchored search
// grabs deal-terms-related sections that land later in the document.
// Falls back to a middle/end slice if no anchors are found at all, so
// the digest is never based on the cover page alone.
export function buildDigest(fullText: string): string {
  const frontMatter = fullText.slice(0, FRONT_MATTER_CHARS);

  // Matched case-insensitively against an uppercased copy (real filings
  // mix case in headings), using the LAST occurrence of each anchor
  // rather than skipping a fixed distance — a filing's table of contents
  // lists the section name once near the front, and the real heading is
  // virtually always the last (often only other) occurrence, which a
  // fixed skip distance can't reliably clear on every filing (confirmed
  // against live filings where the ToC entry landed past any reasonable
  // fixed cutoff).
  const upperText = fullText.toUpperCase();
  const tailSections: string[] = [];
  for (const anchor of TAIL_SECTION_ANCHORS) {
    const idx = upperText.lastIndexOf(anchor);
    if (idx !== -1) {
      tailSections.push(fullText.slice(idx, idx + SECTION_WINDOW_CHARS));
    }
  }

  const digest =
    tailSections.length > 0
      ? [frontMatter, ...tailSections].join("\n\n---\n\n")
      : [
          frontMatter,
          fullText.slice(Math.floor(fullText.length / 2), Math.floor(fullText.length / 2) + SECTION_WINDOW_CHARS),
          fullText.slice(Math.max(0, fullText.length - SECTION_WINDOW_CHARS)),
        ].join("\n\n---\n\n");

  return digest.slice(0, MAX_DIGEST_CHARS);
}
