/**
 * Tokenizer — shared between indexing and query time.
 * Must produce identical tokens in both paths for BM25 to work correctly.
 */

const STOP_WORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with",
  "by","from","is","it","its","this","that","these","those","be","are",
  "was","were","been","being","have","has","had","do","does","did","will",
  "would","could","should","may","might","can","not","no","nor","so","yet",
  "as","if","then","than","also","just","more","into","about","up","out",
  "when","what","which","who","how","all","any","each","both","here","there",
]);

const MIN_TOKEN_LENGTH = 2;
const MAX_TOKEN_LENGTH = 64;

/**
 * Tokenize text into normalized terms for indexing and querying.
 * - Lowercases and Unicode-normalizes
 * - Splits on non-alphanumeric characters
 * - Drops stop words and very short/long tokens
 * - Preserves file-extension-like tokens (e.g. "tsx", "json")
 */
export function tokenize(text: string): string[] {
  const normalized = text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, ""); // strip diacritics

  const tokens: string[] = [];
  // Split on anything that's not alphanumeric or underscore/hyphen
  const parts = normalized.split(/[^a-z0-9_\-]+/);

  for (const part of parts) {
    if (!part) continue;
    // Further split camelCase and snake_case variants
    const subTokens = part
      .replace(/_+/g, " ")
      .replace(/([a-z])([0-9])/g, "$1 $2")
      .replace(/([0-9])([a-z])/g, "$1 $2")
      .split(/\s+/);

    for (const token of subTokens) {
      if (
        token.length >= MIN_TOKEN_LENGTH &&
        token.length <= MAX_TOKEN_LENGTH &&
        !STOP_WORDS.has(token) &&
        !/^\d+$/.test(token) // skip pure numbers
      ) {
        tokens.push(token);
      }
    }
  }

  return tokens;
}

/**
 * Count term frequencies in a token list.
 */
export function termFrequencies(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1);
  }
  return tf;
}
