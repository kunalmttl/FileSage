# FileSage Project State

Last updated: 2026-05-08 (pipeline instrumentation implemented)

## Current Status

Full local indexing pipeline is operational with complete performance instrumentation:

- Vault connection through directory picker plus upload fallback.
- Recursive file scanning with IndexedDB persistence.
- Text extraction for 35+ file types plus PDF extraction with PDF.js.
- Chunking with 1600-character chunks and overlap.
- Embeddings through `@huggingface/transformers` using `Xenova/all-MiniLM-L6-v2`.
- Local vector persistence in IndexedDB.
- File metadata browser.
- Keyword retrieval and Search UI.
- **Pipeline performance instrumentation**: scan, extraction (text/PDF), embedding, and IndexedDB writes are now timed and visible in Settings.

Previously verified pipeline: 20 files -> 15 extracted -> 586 chunks -> 586 vectors embedded.

Search bug fixes applied:

- IndexedDB bumped to v5 to force lexical-store migration in existing browsers.
- DB connections now close on `versionchange`; blocked upgrades return a clear error.
- Search service resolves real vault IDs for all-vault search instead of using an empty vault id.
- Search service loads files/chunks from IndexedDB when the UI does not provide them.
- Lexical stats now accumulate across per-file indexing calls instead of overwriting vault-level BM25 stats.
- Rescan/connect flows clear the lexical index along with files, chunks, and vectors.
- Search UI reloads files per search so it does not depend on stale mount-time file state.
- Semantic mode toggle is disabled until query-vector retrieval is wired.

Pipeline instrumentation implemented:

- `src/lib/performance/metrics.ts`: Updated to support `pipeline` kind metrics with budget threshold alerts.
- `src/lib/db/filesage-db.ts`: All batch write helpers (`saveFileBatch`, `saveChunksAndUpdateFileStatus`, `saveVectorBatch`, `savePostingBatch`) now record timing.
- `src/workers/embedding.worker.ts`: Batch embedding inference is timed; `perfMs` and `batchSize` included in worker messages.
- `src/features/embeddings/embed-pipeline.ts`: Captures worker timing messages and records as `embedding:batch` and `embedding:query`.
- `src/features/indexing/scanner.ts`: Scan functions (`scanDirectoryHandleVault`, `scanUploadedFolderVault`) now record `scan:total` timing.
- `src/features/extraction/text-extractor.ts`: Text extraction timed as `extraction:text` with fileSize, charsExtracted metadata.
- `src/features/extraction/pdf-extractor.ts`: PDF extraction timed as `extraction:pdf` with fileSize, charsExtracted, pageCount metadata.
- `src/components/settings/settings-workspace-shell.tsx`: Performance debug card extended to show both Search and Pipeline timings with metadata badges.

Verified: Pipeline timings are working and visible in `/settings` Performance debug card.

## Decisions Captured

- Product name: FileSage.
- Product category: privacy-first AI files copilot.
- Platform: web-only Next.js app.
- Core flow: connect vaults -> scan -> extract -> chunk -> embed -> search/ask.
- File targets: PDFs, text, markdown, code, common Windows document/file types. CSV is deprioritized.
- AI posture: strictly local-only. No paid API and no cloud.
- Folder model: user-selected folders as vaults, indexed and vectorized locally.
- UI: clean light mode, beige background, flat palette, rounded shadcn/ui elements.
- Storage: IndexedDB DB v5 with `vaults`, `files`, `chunks`, `vectors`, `postings`, `term_stats`, `chunk_stats`, and `vault_stats`.
- Future storage candidate: RxDB plus OPFS-backed storage.
- Embedding model: `Xenova/all-MiniLM-L6-v2`, 384-dimensional vectors, cached in browser after first download.
- Retrieval strategy: keyword/BM25 retrieval works. Semantic query-vector retrieval and true hybrid fusion are pending.
- File operations: MVP is dry-run only. Real rename/move requires explicit approval, undo, and audit log.

## Components and Files Built

### Performance Instrumentation

- `src/lib/performance/metrics.ts`: Singleton perf collector with `recordPipelineTiming()`, `recordSearchTiming()`, budget threshold alerts, and filtered getters.

### DB Layer

- `src/lib/db/filesage-db.ts`: IndexedDB v5 wrapper with vault, file, chunk, vector, and lexical index helpers. All batch writes instrumented.
- `src/lib/db/types.ts`: vault/file/chunk/vector/extraction/lexical index types.

### File Access

- `src/features/file-access/picker.ts`: directory picker, upload fallback, permission helpers.
- `src/features/file-access/components/vault-connector.tsx`: connect, upload fallback, rescan, remove, scan/extract/embed metrics.

### Indexing

- `src/features/indexing/scanner.ts`: recursive directory walk with batch callbacks.

### Extraction

- `src/features/extraction/text-extractor.ts`: text-like extraction.
- `src/features/extraction/pdf-extractor.ts`: PDF extraction.
- `src/features/extraction/chunker.ts`: chunking.
- `src/features/extraction/extract-pipeline.ts`: concurrent extraction, chunk persistence, keyword index build.

### Embeddings

- `src/features/embeddings/embed-pipeline.ts`: embedding worker orchestration and vector persistence. Records `embedding:batch` and `embedding:query` timings.
- `src/workers/embedding.worker.ts`: model loading and batch embedding. Timed inference with `perfMs` in response messages.

### Retrieval

- `src/features/retrieval/tokenizer.ts`: shared indexing/query tokenizer.
- `src/features/retrieval/keyword-index.ts`: postings, term stats, chunk stats, vault stats.
- `src/features/retrieval/bm25.ts`: BM25 scoring.
- `src/features/retrieval/snippets.ts`: highlighted snippet extraction.
- `src/features/retrieval/fusion.ts`: RRF utility for later hybrid retrieval.
- `src/features/retrieval/search-service.ts`: current search orchestration.

### UI

- App shell with persistent left sidebar: Home, Organize, Search, Ask, Settings.
- Home dashboard with vault connection, pipeline status, readiness, file browser, safety status.
- `/search`: functional keyword search UI with query input, filters, results, snippets, and detail panel.
- `/settings`: Performance debug card showing both Search and Pipeline timings with metadata display.
- `/organize`, `/ask`: placeholder shells.

## Immediate Next Steps

1. ~~Add lightweight performance instrumentation before adding more heavy feature work.~~ ✅ Complete
2. Verify pipeline timings in `/settings` Performance debug card. ✅ Verified working
3. Add incremental indexing (file fingerprinting) to stop full rebuilds.
4. Add query embedding path for semantic/vector retrieval.
5. Add true hybrid fusion after semantic query vectors are available.
6. Begin worker orchestration optimization.

## Performance Issues Identified

1. Main thread lag during extraction/embedding orchestration.
2. IndexedDB write pressure from many transactions.
3. File metadata browser loads all file records on filter changes.
4. No incremental indexing; rescans clear and rewrite everything.
5. Vault connector progress updates trigger broad re-renders.
6. PDF.js reads full PDFs into memory before extraction.
7. `@xenova/transformers` is redundant if still installed; `@huggingface/transformers` v4 is the correct package.

## Current Methodologies and Optimization Map

### Local-First Architecture

Current methodology:

- Browser-only local processing.
- File System Access API and upload fallback for file intake.
- IndexedDB for durable local state.
- Browser-cached local embedding model.
- No cloud sync, server processing, or paid API dependency.

Why it works:

- Strong privacy story.
- Good portfolio value because it demonstrates local AI, browser APIs, and retrieval systems.
- Keeps the product usable without account setup or cost.

Performance risk:

- CPU, memory, storage, extraction, embedding, and retrieval all compete inside one browser tab.
- Main thread responsiveness becomes the limiting factor before raw algorithmic complexity does.

Optimization direction:

- Keep local-first architecture.
- Do not pivot to a server or desktop wrapper yet.
- Optimize pipeline execution with instrumentation, workers, batching, and incremental indexing.

### Vault-Based File Access

Current methodology:

- User-selected folders are stored as vaults.
- Directory handles persist where supported.
- Permissions are checked before reuse.
- Fallback uploads support browsers without persistent folder handles.

Performance risk:

- Current rescans are full rebuilds.
- Full rebuild means files, chunks, vectors, postings, and stats are cleared and regenerated.

Optimization direction:

- Add file fingerprints using `relativePath + size + lastModified`.
- Compare new scan metadata against prior metadata.
- Only extract/embed/reindex new or changed files.
- Delete records only for files that no longer exist.

Priority: high.

### Recursive Scanning

Current methodology:

- Recursive async directory traversal.
- Batch callbacks for file metadata persistence.
- Progress displayed in the vault connector.

Performance risk:

- Large folder trees create many progress events and DB writes.
- Scan is currently tied to UI-triggered orchestration.

Optimization direction:

- Keep batch size explicit.
- Add scan timing metrics: files/sec, total scan time, skipped/changed/deleted counts.
- Add backpressure later so scanning can pause when extraction/DB queues are saturated.
- Workerize scan orchestration only after incremental indexing and write batching.

Priority: medium-high.

### IndexedDB Persistence

Current methodology:

- IndexedDB v5 stores vaults, files, chunks, vectors, postings, term stats, chunk stats, and vault stats.
- Uses indexes and cursor deletes.
- Lexical index supports BM25.

Performance risk:

- Many small transactions during extraction, embeddings, vectors, and postings.
- `getAll()` patterns will become expensive on large vaults.
- Vectors as `number[]` are easy but not compact.

Optimization direction:

- Add write timing instrumentation first.
- Add a write queue that coalesces writes into larger transactions.
- Replace high-risk `getAll()` paths with cursor-based pagination or bounded indexed queries.
- Add compound indexes for common filters: `vaultId + extension`, `vaultId + lastModified`, possibly `vaultId + fileId`.
- Consider packed `Float32Array` vector storage later if vector reads/writes dominate.
- Consider RxDB + OPFS only after measuring IndexedDB as the bottleneck.

Priority: high.

### Extraction

Current methodology:

- Extension-based text extraction for many text-like file types.
- PDF.js extraction for PDFs.
- Bounded concurrency of 4 files.
- Extraction status stored per file.
- Extraction writes chunks and then builds lexical index.

Performance risk:

- Orchestration still affects the main thread.
- PDF ArrayBuffer reads can spike memory.
- Concurrency of 4 can be too aggressive on weaker machines.

Optimization direction:

- Add extraction timing per file and per file type.
- Add max file size and PDF page/size guardrails.
- Add dynamic concurrency later.
- Move extraction orchestration into a worker after instrumentation and incremental indexing.
- Keep PDF streaming/range extraction as later advanced work.

Priority: medium-high.

### Chunking

Current methodology:

- Fixed overlapping chunks: roughly 1600 chars with 200 chars overlap.
- Newline-aware boundaries.
- Chunks feed both lexical and vector indexes.

Performance risk:

- Chunking multiplies downstream cost.
- Large files can create many chunks, postings, vectors, and DB writes.

Optimization direction:

- Add per-file chunk count metrics.
- Add soft cap for very large files.
- Later use content-aware chunking for markdown/code/PDF pages.
- Keep current chunking for now because it is adequate for MVP correctness.

Priority: medium.

### Keyword Indexing

Current methodology:

- Tokenizer shared between indexing and query time.
- Inverted index stored in IndexedDB.
- BM25-ready term, chunk, and vault stats.
- Current v5 fix accumulates stats across per-file indexing.

Performance risk:

- One posting per `term + chunk` can create many records.
- Rebuilding lexical index on every rescan is expensive.

Optimization direction:

- Keep current posting schema for correctness.
- Add posting count/index time metrics.
- Later batch postings across multiple files before writing.
- If postings become too large, consider per-term compressed posting-list records.

Priority: medium-high.

### BM25 Keyword Search

Current methodology:

- Query tokenization.
- Posting lookup by `vaultId + term`.
- BM25 scoring.
- File grouping.
- Snippet extraction and reasons.

Performance risk:

- Common terms can fetch large postings lists.
- Scoring currently runs on the main thread.

Optimization direction:

- Add search timing metrics: tokenization, DB reads, BM25, snippet generation, render.
- Add posting caps for very common terms if needed.
- Move retrieval scoring into a retrieval worker after semantic query embeddings are wired.

Priority: high after search correctness is verified.

### Embeddings

Current methodology:

- `@huggingface/transformers` v4.
- `Xenova/all-MiniLM-L6-v2`.
- Embedding worker does model execution.
- Main thread orchestrates batches and IndexedDB vector writes.
- Vectors are normalized and persisted.

Performance risk:

- Main thread still coordinates each batch and progress update.
- Vector writes are many small records.
- No pause/cancel support.

Optimization direction:

- Add embedding timing per batch.
- Move more orchestration into the worker.
- Reduce progress update frequency.
- Add cancel/pause later.
- Consider packed vector storage later.

Priority: high.

### Vector Search and Hybrid Retrieval

Current methodology:

- Vector records exist.
- Semantic query embedding is not wired yet.
- RRF fusion utility exists.
- Semantic UI toggle is disabled until query-vector search is available.

Performance risk:

- Flat scan is O(number of vectors), acceptable now but not indefinitely.
- Query embeddings and vector scan can block if not workerized.

Optimization direction:

- Implement query embedding with the existing embedding worker or a retrieval worker.
- Start with flat dot-product scan.
- Pre-filter by vault and metadata.
- Fuse BM25 and vector rankings with RRF.
- Workerize retrieval before large-vault testing.

Priority: high for product value, medium for performance until vector count grows.

### Search UI

Current methodology:

- Debounced query input.
- Mode toggles.
- File result cards.
- Snippets and detail panel.
- Search UI reloads files per search to avoid stale mount state.

Performance risk:

- Search still depends on main-thread retrieval work.
- Result rendering may get heavy at larger `topK`.

Optimization direction:

- Keep result count bounded.
- Add stale-while-search behavior so current results stay visible while new query runs.
- Later virtualize large result lists.
- Move retrieval work to worker.

Priority: medium.

### File Metadata Browser

Current methodology:

- Vault selector.
- Search input.
- Extension filter.
- Quick filter pills.
- Paginated display.

Performance risk:

- `queryFiles()` can load all file records into memory.
- Filtering after `getAll()` will degrade on large vaults.

Optimization direction:

- Debounce metadata search.
- Add cursor-based pagination.
- Add index-backed filtering by vault and extension.
- Avoid loading all records on every keystroke.

Priority: medium.

### React/UI State

Current methodology:

- Progress stored in React state.
- Progress callbacks are throttled.
- Vault connector owns scan/extract/embed progress.

Performance risk:

- Progress updates still re-render broad component sections.
- State objects are recreated frequently.

Optimization direction:

- Split progress displays into memoized components.
- Store high-frequency progress in refs.
- Commit UI progress snapshots every 250-500ms.
- Use reducer/state machine for pipeline status.

Priority: medium-high because jank is user-visible.

## Phase-Wise Performance Plan

### Performance Phase 0: Instrumentation First

Goal: know where time is actually spent before optimizing.

Tasks:

- ✅ Add timing helper around scan, extraction, chunking, keyword indexing, embedding, vector writes, and search.
- ✅ Persist lightweight job logs in localStorage with `recordPipelineTiming()` and `recordSearchTiming()`.
- ✅ Show job durations and throughput in Settings/debug Performance card.
- ✅ Track counts: files scanned, files changed, chunks created, postings written, vectors written.

Why first:

- Without metrics, optimization work risks targeting the wrong bottleneck.
- This is small and will guide every later phase.

Priority: ✅ Complete

### Performance Phase 1: Incremental Indexing

Goal: stop rebuilding entire vaults unnecessarily.

Tasks:

- Add file fingerprint fields to file metadata.
- During scan, classify files as unchanged, changed, new, or deleted.
- Skip extraction/chunking/embedding/indexing for unchanged files.
- Clear dependent records only for changed/deleted files.
- Update vault stats incrementally where possible.

Expected impact:

- Biggest improvement for repeated rescans.
- Makes real personal usage practical.

Priority: high.

### Performance Phase 2: IndexedDB Write Queue and Batching

Goal: reduce transaction overhead.

Tasks:

- Introduce a DB write queue for chunks, vectors, postings, and stats.
- Flush records in larger transactions.
- Audit helpers that are called in loops.
- Replace broad `getAll()` paths in hot UI/search paths.

Expected impact:

- Lower UI lag during indexing.
- Better scalability with larger vaults.

Priority: high.

### Performance Phase 3: Workerized Pipeline Orchestration

Goal: move heavy orchestration out of React/main thread.

Tasks:

- Move extraction orchestration into a dedicated worker.
- Move embedding batch orchestration deeper into the embedding worker.
- Reduce progress message frequency.
- Add cancellation/pause protocol.

Expected impact:

- Better UI responsiveness during long indexing jobs.

Priority: high after instrumentation and incremental indexing.

### Performance Phase 4: Retrieval Worker

Goal: keep search responsive as corpus grows.

Tasks:

- Move BM25 lookup/scoring, vector scan, and RRF fusion into a retrieval worker.
- Return only top-K file-grouped results to UI.
- Add query timing diagnostics.
- Wire semantic query embeddings and hybrid search.

Expected impact:

- Search UI remains responsive.
- Enables semantic/hybrid retrieval without blocking rendering.

Priority: high for search scale and product feel.

### Performance Phase 5: Data Shape Improvements

Goal: optimize storage formats after measured bottlenecks appear.

Tasks:

- Cursor-based metadata browser pagination.
- Compound indexes for common filters.
- Optional packed `Float32Array` vector storage.
- Optional compressed posting lists per term.
- Investigate RxDB + OPFS only if IndexedDB remains limiting after batching.

Expected impact:

- Better large-corpus behavior.
- More complex, so defer until metrics justify it.

Priority: medium/advanced.

## Optimization Priorities Summary

Immediate:

1. Rescan vault and verify keyword search.
2. Add instrumentation.
3. Add incremental indexing.

Next:

4. Add DB write queue/batching.
5. Move extraction/embedding orchestration further into workers.
6. Add semantic query embedding and hybrid retrieval.

Later:

7. Retrieval worker.
8. Cursor-based metadata browser.
9. Packed vector storage or compressed postings if measured as necessary.
10. OPFS/RxDB evaluation only after IndexedDB is proven insufficient.

## Proposed Phase Plan

### Phase 1: MVP Baseline

- Project scaffold: complete.
- Folder picker: complete.
- Recursive file scan: complete.
- Metadata table/list: complete.
- Text extraction: complete.
- PDF extraction: complete.
- IndexedDB persistence: complete.
- Embeddings: complete.

### Phase 2: Extraction and Indexing

- Text-like file extraction: complete.
- PDF extraction: complete.
- Chunking: complete.
- Metadata browser and filters: complete.
- Lexical index: complete.
- Incremental scan/change detection: pending.

### Phase 3: AI Retrieval

- Keyword search: complete.
- Search UI: complete.
- Semantic query embeddings: pending.
- Hybrid retrieval: pending.
- Metadata filters and reranking: partial.

### Phase 4: Trust and Polish

- Ask mode with citations.
- Rename/move approval flow.
- Undo/action log.
- Duplicate detection.
- Animated indexing pipeline.
- ✅ Performance instrumentation.
