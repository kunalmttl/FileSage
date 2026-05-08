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
import { recordPipelineTiming } from "@/lib/performance/metrics";

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
const TEXT_SAMPLE_PAGES = 3;
const MIN_CHARS_PER_PAGE = 50;
const MAX_PAGES = 100;

/**
 * Extracts text from a PDF File using PDF.js.
 * Returns null on failure so the pipeline can mark the file as skipped.
 */
export async function extractPdfText(file: File): Promise<ExtractionResult | null> {
  const t0 = performance.now();
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
    const probeTo = Math.min(TEXT_SAMPLE_PAGES, pdf.numPages);
    let probeChars = 0;

    for (let pageNum = 1; pageNum <= probeTo; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      probeChars += content.items.reduce(
        (sum, item) => sum + ("str" in item ? item.str.length : 0),
        0
      );
    }

    if (probeChars < MIN_CHARS_PER_PAGE * probeTo) {
      const perfMs = performance.now() - t0;
      recordPipelineTiming('extraction:pdf', perfMs, {
        fileSize: file.size,
        charsExtracted: 0,
        pageCount: pdf.numPages,
        sampledPages: probeTo,
        noText: 1,
        imageOnlyEarlyExit: 1,
      });
      return null;
    }

    const pagesToExtract = Math.min(pdf.numPages, MAX_PAGES);

    for (let pageNum = 1; pageNum <= pagesToExtract; pageNum++) {
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
    const perfMs = performance.now() - t0;
    
    if (!text) {
      recordPipelineTiming('extraction:pdf', perfMs, { 
        fileSize: file.size, 
        charsExtracted: 0,
        pageCount: pdf.numPages,
        noText: 1 
      });
      return null;
    }

    recordPipelineTiming('extraction:pdf', perfMs, { 
      fileSize: file.size, 
      charsExtracted: text.length,
      pageCount: pdf.numPages,
      pagesExtracted: pagesToExtract,
      pageCapped: pagesToExtract < pdf.numPages ? 1 : 0,
    });
    return { text, method: "text", truncated };
  } catch {
    const perfMs = performance.now() - t0;
    recordPipelineTiming('extraction:pdf', perfMs, { 
      fileSize: file.size, 
      failed: 1 
    });
    return null;
  }
}
