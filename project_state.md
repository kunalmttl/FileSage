# FileSage Project State

Last updated: 2026-04-26 (semantic embeddings complete — full pipeline working end-to-end)

## Current Status

Full local AI pipeline is operational:

- Vault connection (directory picker + upload fallback)
- Recursive file scanning with IndexedDB persistence
- Text extraction (35+ file types) + PDF extraction (PDF.js)
- Chunking (1600-char overlapping chunks)
- Semantic embeddings via Transformers.js (all-MiniLM-L6-v2, 384-dim, runs in browser)
- All vectors persisted locally in IndexedDB

Verified working: 20 files → 15 extracted → 586 chunks → 586 vectors embedded.

Next major milestone: local hybrid retrieval + search UI.

## Decisions Captured

- Product name: FileSage.
- Product category: privacy-first AI files copilot.
- Platform: web-only Next.js app.
- Core flow: connect vaults → scan → extract → chunk → embed → search/ask.
- File targets: PDFs, text, markdown, code, common Windows doc types. CSV deprioritized.
- AI posture: strictly local-only. No paid API, no cloud.
- Folder model: user-selected folders as vaults, indexed and vectorized locally.
- UI: clean light mode, beige background, flat palette, rounded shadcn/ui elements.
- Scaffold: Next.js 16.2.4 App Router, React 19.2.4, TypeScript, Tailwind CSS v4, shadcn/ui 4.4.0.
- Installed shadcn/ui components: button, card, tabs, badge, separator, input, label, tooltip, scroll-area, skeleton.
- App shell: persistent left sidebar — Home, Organize, Search, Ask, Settings.
- Home page: dashboard with vault connection, quick actions, pipeline status, readiness, file browser, safety status.
- Routes: /organize, /search, /ask, /settings (placeholder shells).
- Settings: long-term home for vault management, storage, indexing, privacy, debug.
- No API route handlers yet — add only when needed for local orchestration.
- Storage: IndexedDB DB v3 (vaults, files, chunks, vectors stores).
- Future storage candidate: RxDB + OPFS-backed storage.
- Embedding model: Xenova/all-MiniLM-L6-v2 via @huggingface/transformers v4. 23 MB, 384-dim, cached in browser after first download.
- Embedding execution: main thread for now. Web Worker scaffold exists but embedding currently runs synchronously via worker message protocol.
- Retrieval strategy: local hybrid retrieval (keyword + vector + metadata boosts + reranking). Not yet implemented.
- File operations: MVP is dry-run only. Real rename/move needs explicit approval + undo + audit log.
- Performance concern: app is noticeably laggy. Main thread is blocked during extraction and embedding. Web Worker migration is a known needed optimization.
- Turbopack: Next.js 16 uses Turbopack by default. next.config.ts has both turbopack: {} and webpack config (for fallback/alias). Turbopack handles transformers.js without custom config.
- @xenova/transformers installed but redundant — @huggingface/transformers v4 is the correct package.

## Components and Files Built

### DB layer — src/lib/db/

- filesage-db.ts — IndexedDB v3 wrapper. Stores: vaults, files, chunks, vectors. Helpers: saveVault, updateVaultScanStats, listVaults, deleteVault, getVault, clearFilesForVault, saveFileBatch, listFilesForVault, listAllFiles, queryFiles, listRecentFiles, countFiles, getVaultFileStats, getFileTypeSummary, saveChunkBatch, clearChunksForVault, listChunksForFile, listChunksForVault, countChunks, updateFileExtractionStatus, saveChunksAndUpdateFileStatus, saveVectorBatch, clearVectorsForVault, listAllVectors, countVectors.
- types.ts — VaultRecord, FileEntryRecord, VaultScanStats, FileMetadataQuery, FileTypeSummary, VaultFileStats, ExtractionStatus, ChunkRecord, VectorRecord.

### File access — src/features/file-access/

- picker.ts — canUseDirectoryPicker, pickDirectoryVault, createUploadFallbackVault, queryDirectoryReadPermission, requestDirectoryReadPermission.
- components/vault-connector.tsx — full vault UI: connect, upload fallback, rescan, remove. Shows scan → extraction → embedding metrics rows. Status: idle/scanning/extracting/embedding/complete/error.

### Indexing — src/features/indexing/

- scanner.ts — scanDirectoryHandleVault, scanUploadedFolderVault. Recursive walk with batch callbacks.

### Extraction — src/features/extraction/

- text-extractor.ts — extractText() for 35+ text-like extensions via FileReader UTF-8. Caps at 200k chars.
- pdf-extractor.ts — extractPdfText() via PDF.js (pdfjs-dist). Lazy-loads, page-by-page, caps at 200k chars.
- chunker.ts — chunkText(). 1600-char chunks, 200-char overlap, newline-boundary breaking.
- extract-pipeline.ts — extractAndChunkFiles(). Concurrency: 4 parallel files. Progress throttled at 120ms. Single DB tx per file (chunks + status).

### Embeddings — src/features/embeddings/

- embed-pipeline.ts — embedChunks(). Worker singleton, batch size 32, throttled progress (150ms), persists VectorRecord\[\] to IndexedDB.

### Workers — src/workers/

- embedding.worker.ts — @huggingface/transformers v4. Loads Xenova/all-MiniLM-L6-v2. Batch embeds, normalizes to unit length. Message protocol: embed/result/error/progress/ready.

### Shared components — src/components/shared/

- file-metadata-browser.tsx — vault selector, search, extension filter, quick-filter pills, paginated file table (50/page), loading skeletons, empty states.
- pipeline-status.tsx, quick-action-card.tsx, readiness-card.tsx, empty-state.tsx.

### Layout — src/components/layout/

- AppShell, SidebarNav, PageHeader.

### Types — src/types/

- file-system-access.d.ts — File System Access API permission/iterator augmentations.

### Config

- next.config.ts — reactCompiler: true, turbopack: {}, webpack aliases (sharp, onnxruntime-node, fs/path/crypto fallbacks).
- public/pdf.worker.min.mjs — PDF.js worker, copied via postinstall script.
- package.json postinstall — copies pdf.worker.min.mjs on every npm install.

## Immediate Next Steps

1. Local hybrid retrieval — keyword + vector dot-product search over IndexedDB chunks/vectors.
2. Search page UI — natural language query, result snippets, file citations, "why this result".
3. Performance optimization — main thread blocking is the biggest issue (see analysis below).

## Performance Issues Identified (needs research)

1. Main thread blocking during embedding — embedChunks() awaits worker messages on main thread via Promise chain. The worker runs off-thread but the orchestration loop still blocks React rendering between batches. Fix: move orchestration into the worker or use a SharedArrayBuffer ping-pong. Alternatively stream results back via postMessage and let React update asynchronously.

2. IndexedDB write pressure — saveVectorBatch() and saveChunksAndUpdateFileStatus() open a new IDBDatabase transaction per file/batch. For 586 chunks this is \~100+ transactions. Fix: larger batch windows or a write queue that coalesces writes.

3. File metadata browser re-renders — queryFiles() loads ALL file records from IndexedDB into memory on every filter change. No debounce on search input. Fix: debounce input (300ms), add IndexedDB cursor-based pagination instead of slice().

4. No incremental indexing — every scan/rescan clears and rewrites all files, chunks, and vectors. For large vaults this is expensive. Fix: fingerprint files (lastModified + size hash), skip unchanged files.

5. Vault connector state updates — extraction/embedding progress fires setExtractionProgress / setEmbedProgress on every throttled tick, which triggers full component re-renders including all child metric cards. Fix: use useReducer or split state into refs + only update display state at render boundaries.

6. PDF.js loads the entire file into an ArrayBuffer — file.arrayBuffer() reads the whole PDF into memory before extraction starts. For large PDFs this spikes memory. Fix: use PDF.js streaming/range request mode with a ReadableStream source.

7. @xenova/transformers is installed but unused (redundant with @huggingface/transformers v4). Should be removed to reduce node_modules size.

## Proposed Phase Plan

### Phase 1: MVP Baseline ✅

- Project scaffold ✅
- Folder picker ✅
- Recursive file scan ✅
- Metadata table/list ✅
- Text extraction ✅
- PDF extraction ✅
- IndexedDB persistence ✅
- Embeddings ✅

### Phase 2: Extraction and Indexing

- Text-like file extraction ✅
- PDF extraction ✅
- Chunking ✅
- Metadata browser and filters ✅
- Incremental scan/change detection — pending

### Phase 3: AI Retrieval

- Embedding worker ✅ (partial — worker exists, orchestration still on main thread)
- Semantic search — pending
- Keyword + hybrid retrieval — pending
- Metadata filters and reranking — pending

### Phase 4: Trust and Polish

- Ask mode with citations
- Rename/move approval flow
- Undo/action log
- Duplicate detection
- Animated indexing pipeline
- Performance instrumentation

## Open Questions For User

- Which performance issue to address first before moving to retrieval?
- Prefer to fix perf now or build search first and optimize after?
