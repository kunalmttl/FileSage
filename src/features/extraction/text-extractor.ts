/**
 * Text extraction for plain-text-like files.
 * Returns null for unsupported types — PDF is handled separately later.
 */

const TEXT_EXTENSIONS = new Set([
  // Plain text
  "txt", "md", "mdx", "markdown", "log", "text",
  // Web
  "html", "htm", "xml", "svg", "css",
  // Data
  "json", "yaml", "yml", "toml", "ini", "env",
  // Code
  "ts", "tsx", "js", "jsx", "mjs", "cjs",
  "py", "pyw",
  "java", "kt", "kts",
  "cs", "fs", "fsx",
  "c", "cpp", "cc", "cxx", "h", "hpp",
  "go", "rs", "rb", "php", "swift",
  "sh", "bash", "zsh", "fish", "ps1", "bat", "cmd",
  "r", "lua", "dart", "scala", "ex", "exs",
  "sql", "graphql", "gql",
  // Config / misc
  "gitignore", "gitattributes", "editorconfig", "prettierrc",
  "eslintrc", "babelrc", "nvmrc",
  "dockerfile", "makefile",
  "lock",
]);

export type ExtractionResult = {
  text: string;
  method: "text";
  truncated: boolean;
};

/** Max characters to extract per file (~200 KB of text). */
const MAX_CHARS = 200_000;

/**
 * Returns extracted text for supported extensions, null otherwise.
 */
export async function extractText(
  file: File,
  extension: string
): Promise<ExtractionResult | null> {
  const ext = extension.toLowerCase();

  if (!TEXT_EXTENSIONS.has(ext) && !isTextMimeType(file.type)) {
    return null;
  }

  try {
    const raw = await readFileAsText(file);
    const truncated = raw.length > MAX_CHARS;
    const text = truncated ? raw.slice(0, MAX_CHARS) : raw;
    return { text, method: "text", truncated };
  } catch {
    return null;
  }
}

export function isExtractable(extension: string): boolean {
  return TEXT_EXTENSIONS.has(extension.toLowerCase());
}

function isTextMimeType(mimeType: string): boolean {
  return mimeType.startsWith("text/");
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, "utf-8");
  });
}
