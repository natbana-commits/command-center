const FRONT_MATTER_CHARS = 50000;
const SECTION_WINDOW_CHARS = 12000;
const SKIP_TOC_CHARS = 3000;
const MAX_DIGEST_CHARS = 90000;

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

  const tailSections: string[] = [];
  for (const anchor of TAIL_SECTION_ANCHORS) {
    const idx = fullText.indexOf(anchor, SKIP_TOC_CHARS);
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
