/**
 * Snippet extraction — pulls a highlighted window from chunk text
 * centered on the best matching term position.
 */

const SNIPPET_LENGTH = 200;
const HIGHLIGHT_TAG_OPEN = "<mark>";
const HIGHLIGHT_TAG_CLOSE = "</mark>";

export type Snippet = {
  text: string;     // plain text snippet
  html: string;     // snippet with <mark> highlights
};

/**
 * Extracts a snippet from chunk text centered on the first matched term.
 * Falls back to the beginning of the text if no match is found.
 */
export function extractSnippet(chunkText: string, matchedTerms: string[]): Snippet {
  const text = chunkText.replace(/\s+/g, " ").trim();
  const lower = text.toLowerCase();

  // Find earliest position of any matched term
  let bestPos = -1;
  for (const term of matchedTerms) {
    const pos = lower.indexOf(term.toLowerCase());
    if (pos !== -1 && (bestPos === -1 || pos < bestPos)) {
      bestPos = pos;
    }
  }

  // Center window around best position
  const half = Math.floor(SNIPPET_LENGTH / 2);
  let start = Math.max(0, (bestPos === -1 ? 0 : bestPos) - half);
  const end = Math.min(text.length, start + SNIPPET_LENGTH);

  // Adjust start if we hit the end boundary
  if (end - start < SNIPPET_LENGTH) {
    start = Math.max(0, end - SNIPPET_LENGTH);
  }

  let snippet = text.slice(start, end).trim();

  // Add ellipsis
  if (start > 0) snippet = "…" + snippet;
  if (end < text.length) snippet = snippet + "…";

  // Build HTML with highlights
  const html = highlightTerms(snippet, matchedTerms);

  return { text: snippet, html };
}

function highlightTerms(text: string, terms: string[]): string {
  if (!terms.length) return escapeHtml(text);

  // Build a single regex from all terms (sorted longest first to avoid partial overlap)
  const escaped = terms
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length);

  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  const exactPattern = new RegExp(`^(?:${escaped.join("|")})$`, "i");

  return text
    .split(pattern)
    .map((part) =>
      exactPattern.test(part)
        ? `${HIGHLIGHT_TAG_OPEN}${escapeHtml(part)}${HIGHLIGHT_TAG_CLOSE}`
        : escapeHtml(part)
    )
    .join("");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
