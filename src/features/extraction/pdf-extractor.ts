/**
 * PDF text extraction using PDF.js (pdfjs-dist).
 *
 * PDF.js requires a worker script. In Next.js we point GlobalWorkerOptions.workerSrc
 * at the pre-built worker served from /public. The worker file is copied there via
 * next.config.ts (copyFiles plugin) or a postinstall script.
 *
 * This module lazy-initialises PDF.js once on first call so it never runs during
 * SSR (where FileReader and Worker are unavailable).
 */

import type { ExtractionResult } from "@/features/extraction/text-extractor";

let pdfjsLib: typeof import("pdfjs-dist") | null = null;

async function getPdfjs() {
  if (pdfjsLib) return pdfjsLib;

  const lib = await import("pdfjs-dist");

  // Point at the worker file we serve from /public.
  lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  pdfjsLib = lib;
  return lib;
}

/** Max characters to extract from a PDF (~200 KB). */
const MAX_CHARS = 200_000;

/**
 * Extracts text from a PDF File using PDF.js.
 * Returns null on failure so the pipeline can mark the file as skipped.
 */
export async function extractPdfText(file: File): Promise<ExtractionResult | null> {
  try {
    const pdfjs = await getPdfjs();
    const arrayBuffer = await file.arrayBuffer();

    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(arrayBuffer),
      // Disable range requests — we already have the full buffer.
      disableRange: true,
      disableStream: true,
      // Suppress password prompts and non-critical warnings.
      verbosity: 0,
    });

    const pdf = await loadingTask.promise;
    const pageTexts: string[] = [];
    let totalChars = 0;
    let truncated = false;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      if (totalChars >= MAX_CHARS) {
        truncated = true;
        break;
      }

      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();

      const pageText = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      if (!pageText) continue;

      const remaining = MAX_CHARS - totalChars;
      if (pageText.length > remaining) {
        pageTexts.push(pageText.slice(0, remaining));
        totalChars += remaining;
        truncated = true;
      } else {
        pageTexts.push(pageText);
        totalChars += pageText.length;
      }
    }

    const text = pageTexts.join("\n\n").trim();
    if (!text) return null;

    return { text, method: "text", truncated };
  } catch {
    return null;
  }
}
