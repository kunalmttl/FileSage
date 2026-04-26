/**
 * Splits extracted text into overlapping chunks suitable for embedding.
 */

export type TextChunk = {
  index: number;
  text: string;
  charStart: number;
  charEnd: number;
};

/** Target chunk size in characters (~400 tokens at ~4 chars/token). */
const CHUNK_SIZE = 1_600;
/** Overlap between consecutive chunks in characters. */
const CHUNK_OVERLAP = 200;

export function chunkText(text: string): TextChunk[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();

  if (!normalized) {
    return [];
  }

  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < normalized.length) {
    const end = Math.min(start + CHUNK_SIZE, normalized.length);

    // Try to break at a newline boundary to avoid mid-sentence splits.
    let breakAt = end;
    if (end < normalized.length) {
      const newline = normalized.lastIndexOf("\n", end);
      if (newline > start + CHUNK_SIZE / 2) {
        breakAt = newline + 1;
      }
    }

    chunks.push({
      index,
      text: normalized.slice(start, breakAt).trim(),
      charStart: start,
      charEnd: breakAt,
    });

    index += 1;
    start = breakAt - CHUNK_OVERLAP;

    if (start <= chunks[chunks.length - 1]!.charStart) {
      break;
    }
  }

  return chunks.filter((c) => c.text.length > 0);
}
