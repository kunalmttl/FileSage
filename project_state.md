# FileSage Project State

Last updated: 2026-06-25 (Pipeline status integrated in Vault Connection, custom favicon, and flush sidebar)

## Current Status

Full local indexing pipeline is operational with performance instrumentation, optimized retrieval, and incremental rescans:

- Vault connection card featuring an integrated, real-time indexing pipeline step track (driven dynamically by scanner, classifier, extraction, and embedding stages).
- Custom FolderOpen sage SVG favicon replacing the generic default icon.
- Full-height sidebar pinned flush to the viewport's left edge.
- Recursive file scanning with IndexedDB persistence.
- Text extraction for 35+ file types plus PDF extraction with PDF.js.
- Chunking with 1600-character chunks and overlap.
- Embeddings through `@huggingface/transformers` using `Xenova/all-MiniLM-L6-v2`.
- Local vector persistence in IndexedDB.
- File metadata browser.
- Hybrid retrieval and Search UI.
- Local `/ask` RAG chat UI using deterministic query planning, multi-mode retrieval, exact-answer bypasses, and a tiered answer-provider layer: Ollama local, WebLLM/WebGPU, Wllama/CPU, and optional OpenAI-compatible BYOK API.
- **Pipeline performance instrumentation**: scan, extraction (text/PDF), embedding, and IndexedDB writes are now timed and visible in Settings.
- **Search hot path optimized**: snippet chunk loading now fetches only top fused chunk IDs instead of loading whole vault chunk sets.
- **IndexedDB write path optimized**: chunks/vectors/files use relaxed durability; chunks and postings are sub-batched.
- **Postings schema optimized**: IndexedDB postings are stored as one record per `(vaultId, term)` with posting arrays.
- **Incremental directory rescans**: rescans classify files as new, changed, unchanged, or deleted and only re-index new/changed files.

Previously verified pipeline: 20 files -> 15 extracted -> 586 chunks -> 586 vectors embedded.

Recent performance verification:

- Search `loadChunks`: about 5450ms -> about 3-6ms after targeted chunk ID loading.
- Total search: about 5735ms -> about 338ms on the measured vault.
- Embedding batches: 48-73s batches -> 6-11s progress ticks with smaller batch size.
- Chunk writes: no current budget warnings after 50-record sub-batching.
- Incremental rescan: unchanged files are skipped instead of re-extracted and re-embedded.

Ask mode implemented:

- `src/app/api/ask/ollama/*`: local Ollama health and streaming chat route handlers. These proxy only the selected retrieved context chunks and question to `localhost:11434`.
- `src/app/api/ask/openai-compatible/*`: optional BYOK OpenAI-compatible streaming route handler for providers such as OpenRouter. This is opt-in because retrieved chunks leave the device.
- `src/workers/llm.worker.ts`: Browser-model worker with HuggingFace GGUF Wllama loading, browser caching, load progress, streaming chat completions, and interrupt support. Wllama is forced to CPU-only execution with `n_gpu_layers: 0`; WebLLM remains available only as the experimental WebGPU engine.
- `src/features/ask/llm-service.ts`: main-thread provider wrapper for Ollama, WebLLM, Wllama, and OpenAI-compatible streaming requests with debug logging.
- `src/features/ask/query-planner.ts`: deterministic planner that classifies intent and extracts keywords, entities, exact terms, document hints, and multiple retrieval queries.
- `src/features/ask/ask-retrieval.ts`: client-side retrieval orchestrator that runs keyword, hybrid, and semantic searches, dedupes by chunk ID, reranks chunks, loads full chunk text, and returns diagnostics.
- `src/features/ask/context-builder.ts`: loads full chunk text from returned search chunk IDs, packs numbered context, and builds grounded citation prompts.
- `src/features/ask/exact-answer.ts`: deterministic exact-answer bypasses for Aadhaar/UIDAI, phone/mobile, dates, and roll/application-style lookups before calling the LLM.
- `src/features/ask/citation-resolver.ts`: parses `[N]` markers and maps citations back to retrieved chunks.
- `src/components/ask/*`: chat thread, input bar, model status, source panel with retrieval mode/matched-term badges, citation chips, and suggested prompts.
- `src/components/settings/settings-workspace-shell.tsx`: local Ask settings persisted in `localStorage`, including provider, model, context, max response, temperature, and optional API endpoint/key.
- Confirmed: Ollama `gemma3:1b` is installed locally and works through the FileSage `/ask` application.

Search bug fixes applied:

- IndexedDB bumped to v5 to force lexical-store migration in existing browsers.
- DB connections now close on `versionchange`; blocked upgrades return a clear error.
- Search service resolves real vault IDs for all-vault search instead of using an empty vault id.
- Search service loads files/chunks from IndexedDB when the UI does not provide them.
- Lexical stats now accumulate across per-file indexing calls instead of overwriting vault-level BM25 stats.
- Rescan/connect flows clear the lexical index along with files, chunks, and vectors.
- Search UI reloads files per search so it does not depend on stale mount-time file state.
- Hybrid search uses BM25 + semantic vector scoring + RRF fusion.

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

Performance optimization implemented:

- `src/features/retrieval/search-service.ts`: loads only top fused snippet chunk IDs with `getChunksByIds()`.
- `src/lib/db/filesage-db.ts`: IndexedDB bumped to v7; postings migrated to per-term records; chunk/vector/file writes use relaxed durability; chunks, postings, term stats, and chunk stats are sub-batched.
- `src/features/embeddings/embed-pipeline.ts`: embedding batch size reduced to 6 with a yield between batches for better visible progress.
- `src/features/extraction/pdf-extractor.ts`: image-only PDF early exit and 100-page extraction cap added.
- `src/features/indexing/fingerprint.ts`: cheap file fingerprint helper using `relativePath + size + lastModified`.
- `src/features/indexing/scan-classifier.ts`: classifies scanned files as new, changed, unchanged, or deleted.
- `src/features/file-access/components/vault-connector.tsx`: directory rescans now classify first, clean only changed/deleted dependents, process only new/changed files, and show classification counters.

## Decisions Captured

- Product name: FileSage.
- Product category: privacy-first AI files copilot.
- Platform: web-only Next.js app.
- Core flow: connect vaults -> scan -> extract -> chunk -> embed -> search/ask.
- File targets: PDFs, text, markdown, code, common Windows document/file types. CSV is deprioritized.
- AI posture: strictly local-only. No paid API and no cloud.
- Folder model: user-selected folders as vaults, indexed and vectorized locally.
- UI: clean light mode, beige background, flat palette, rounded shadcn/ui elements.
- Storage: IndexedDB DB v7 with `vaults`, `files`, `chunks`, `vectors`, per-term `postings`, `term_stats`, `chunk_stats`, and `vault_stats`.
- Future storage candidate: RxDB plus OPFS-backed storage.
- Embedding model: `Xenova/all-MiniLM-L6-v2`, 384-dimensional vectors, cached in browser after first download.
- Retrieval strategy: hybrid retrieval works with BM25, semantic vector scoring, and RRF fusion.
- File operations: MVP is dry-run only. Real rename/move requires explicit approval, undo, and audit log.

## Components and Files Built

### Performance Instrumentation

- `src/lib/performance/metrics.ts`: Singleton perf collector with `recordPipelineTiming()`, `recordSearchTiming()`, budget threshold alerts, and filtered getters.

### DB Layer

- `src/lib/db/filesage-db.ts`: IndexedDB v7 wrapper with vault, file, chunk, vector, and lexical index helpers. Batch writes, targeted chunk loads, posting storage, and incremental cleanup are instrumented/optimized.
- `src/lib/db/types.ts`: vault/file/chunk/vector/extraction/lexical index types.

### File Access

- `src/features/file-access/picker.ts`: directory picker, upload fallback, permission helpers.
- `src/features/file-access/components/vault-connector.tsx`: connect, upload fallback, rescan, remove, scan/extract/embed metrics.

### Indexing

- `src/features/indexing/scanner.ts`: recursive directory walk with batch callbacks.
- `src/features/indexing/fingerprint.ts`: computes cheap file fingerprints from relative path, size, and last modified time.
- `src/features/indexing/scan-classifier.ts`: compares scan results against IndexedDB records and identifies new, changed, unchanged, and deleted files.

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
- `src/features/retrieval/fusion.ts`: RRF utility used for hybrid retrieval.
- `src/features/retrieval/search-service.ts`: hybrid search orchestration with targeted snippet chunk loading.

### UI

- App shell with viewport-pinned left sidebar: Home, Organize, Search, Ask, Settings.
- Home dashboard with vault connection card (featuring the integrated, live indexing pipeline), system readiness stack, file browser, and safety status.
- `/search`: functional keyword search UI with query input, filters, results, snippets, and detail panel.
- `/ask`: local RAG chat over indexed files with retrieved source panel, streaming answers, citation chips, provider status, and vault scoping.
- `/settings`: Performance debug card showing both Search and Pipeline timings with metadata display.
- `/organize`: placeholder shell.

## Immediate Next Steps

1. ~~Add lightweight performance instrumentation before adding more heavy feature work.~~ ✅ Complete
2. Verify pipeline timings in `/settings` Performance debug card. ✅ Verified working
3. ~~Add incremental indexing (file fingerprinting) to stop full rebuilds.~~ Complete
4. ~~Add query embedding path for semantic/vector retrieval.~~ Complete
5. ~~Add true hybrid fusion after semantic query vectors are available.~~ Complete
6. ~~Build grounded `/ask` on top of the now-fast hybrid retrieval path.~~ Complete
7. Verify `/ask` Ollama generation end to end after `gemma3:1b` finishes downloading locally. ✅ Verified working
8. ~~Add deterministic query planning and multi-mode ask retrieval before final answer synthesis.~~ Complete
9. Begin deeper worker orchestration optimization.

## Performance Issues Identified

1. Main thread lag during extraction/embedding orchestration.
2. IndexedDB write pressure from many transactions. Partially mitigated with relaxed durability, sub-batches, and per-term postings.
3. File metadata browser loads all file records on filter changes.
4. Incremental indexing is implemented for directory-vault rescans; upload fallback still uses full rebuild semantics.
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
- Directory-vault rescans compute file fingerprints and classify files before heavy work starts.

Performance risk:

- Upload fallback scans still rebuild because the browser cannot automatically re-open an uploaded folder.
- Changed/deleted file cleanup now prunes dependents, but large posting lists can still be expensive at bigger scale.

Optimization direction:

- Keep fingerprint-based directory rescans.
- Add better runtime verification and metrics for changed/deleted cleanup at larger vault sizes.
- Keep upload fallback as an explicit re-upload/full-rebuild path.

Priority: complete for directory-picker vaults; medium for polish.

### Recursive Scanning

Current methodology:

- Recursive async directory traversal.
- Scan collects file metadata first; rescan classification happens before persistence.
- Progress and classification counts are displayed in the vault connector.

Performance risk:

- Large folder trees create many progress events.
- Scan is currently tied to UI-triggered orchestration.

Optimization direction:

- Keep batch size explicit.
- Add richer scan timing metrics: files/sec, total scan time, skipped/changed/deleted counts.
- Add backpressure later so scanning can pause when extraction/DB queues are saturated.
- Workerize scan orchestration only after incremental indexing and write batching.

Priority: medium.

### IndexedDB Persistence

Current methodology:

- IndexedDB v7 stores vaults, files, chunks, vectors, per-term postings, term stats, chunk stats, and vault stats.
- Uses indexes and cursor deletes.
- Lexical index supports BM25.
- File records include fingerprints for incremental rescans.

Performance risk:

- Some write pressure remains during extraction and lexical indexing, but chunk/vector/posting writes are now batched.
- `getAll()` patterns will become expensive on large vaults.
- Vectors as `number[]` are easy but not compact.

Optimization direction:

- Keep write timing instrumentation.
- Consider a write queue only if measured writes remain a bottleneck after current batching.
- Replace high-risk `getAll()` paths with cursor-based pagination or bounded indexed queries.
- Add compound indexes for common filters: `vaultId + extension`, `vaultId + lastModified`, possibly `vaultId + fileId`.
- Consider packed `Float32Array` vector storage later if vector reads/writes dominate.
- Consider RxDB + OPFS only after measuring IndexedDB as the bottleneck.

Priority: medium-high.

### Extraction

Current methodology:

- Extension-based text extraction for many text-like file types.
- PDF.js extraction for PDFs.
- Bounded concurrency of 4 files.
- Extraction status stored per file.
- Extraction writes chunks and then builds lexical index.
- PDFs probe the first pages for text, skip image-only PDFs early, and cap extraction at 100 pages.

Performance risk:

- Orchestration still affects the main thread.
- PDF ArrayBuffer reads can spike memory.
- Concurrency of 4 can be too aggressive on weaker machines.

Optimization direction:

- Keep extraction timing per file and per file type.
- Tune max file size and PDF page/size guardrails from real metrics.
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
- Inverted index stored in IndexedDB as one record per `(vaultId, term)` with posting arrays.
- BM25-ready term, chunk, and vault stats.
- Stats accumulate across per-file indexing and are decremented during targeted file cleanup.

Performance risk:

- Very large per-term posting arrays can still become expensive at larger scale.
- Changed/deleted cleanup prunes posting lists for the affected file.

Optimization direction:

- Keep current per-term posting schema for correctness and write performance.
- Continue tracking posting count/index time metrics.
- Later batch postings across multiple files before writing if needed.
- If postings become too large, consider compressed posting-list records.

Priority: medium-high.

### BM25 Keyword Search

Current methodology:

- Query tokenization.
- Posting lookup by `[vaultId, term]`.
- BM25 scoring.
- File grouping.
- Snippet extraction and reasons.
- Search loads only top fused snippet chunk IDs for result snippets.

Performance risk:

- Common terms can fetch large posting lists.
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
- Main thread orchestrates smaller embedding batches and IndexedDB vector writes.
- Vectors are normalized and persisted.

Performance risk:

- Main thread still coordinates each batch and progress update.
- CPU-only WASM inference remains the dominant embedding cost.
- No pause/cancel support.

Optimization direction:

- Keep embedding timing per batch.
- Move more orchestration into the worker.
- Add pause/cancel protocol.
- Add cancel/pause later.
- Consider packed vector storage later.

Priority: high.

### Vector Search and Hybrid Retrieval

Current methodology:

- Vector records exist.
- Semantic query embedding is wired.
- BM25 and vector hits are fused with RRF.
- Search can run keyword, semantic, or hybrid retrieval.

Performance risk:

- Flat scan is O(number of vectors), acceptable now but not indefinitely.
- Query embeddings and vector scan can still block if not workerized deeply enough for large vaults.

Optimization direction:

- Keep query embedding through the existing embedding worker.
- Continue with flat dot-product scan until measurement says otherwise.
- Pre-filter by vault and metadata.
- Workerize retrieval before large-vault testing.

Priority: complete for MVP retrieval; medium for scale.

### Search UI

Current methodology:

- Debounced query input.
- Mode toggles.
- File result cards.
- Snippets and detail panel.
- Search UI reloads files per search to avoid stale mount state.
- Snippet text is loaded through targeted chunk ID reads.

Performance risk:

- Search is now fast on the measured vault but still depends on main-thread retrieval work.
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

- Complete: add file fingerprint fields to file metadata.
- Complete: during scan, classify files as unchanged, changed, new, or deleted.
- Complete: skip extraction/chunking/embedding/indexing for unchanged files.
- Complete: clear dependent records only for changed/deleted files.
- Partial: vault/file stats are updated from the scan result; BM25 vault stats are decremented during targeted cleanup.

Expected impact:

- Biggest improvement for repeated rescans.
- Makes real personal usage practical.

Priority: complete for directory-picker rescans.

### Performance Phase 2: IndexedDB Write Queue and Batching

Goal: reduce transaction overhead.

Tasks:

- Complete: chunk writes are split into 50-record transactions.
- Complete: postings are stored as per-term records and written in 200-term sub-batches.
- Complete: term stats and chunk stats are sub-batched.
- Complete: file/vector/chunk/posting writes use relaxed durability where appropriate.
- Complete: search no longer loads all chunks for snippets.
- Pending: replace broad metadata-browser `getAll()` paths with cursor/index-backed pagination.

Expected impact:

- Lower UI lag during indexing.
- Better scalability with larger vaults.

Priority: mostly complete for pipeline/search hot paths; medium for metadata browser.

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
- Complete: semantic query embeddings and hybrid search are wired.
- Pending: move retrieval scoring and vector scan into a dedicated retrieval worker for larger vaults.

Expected impact:

- Search UI remains responsive.
- Enables semantic/hybrid retrieval without blocking rendering.

Priority: medium for search scale.

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

1. Continue testing `/ask` against real indexed-vault questions and inspect `[ask:retrieval]` diagnostics for poor matches.
2. Tune Ask prompt/context packing and reranking weights against real vault questions.
3. Add richer markdown rendering only if plain rendering proves insufficient.

Next:

4. Move extraction/embedding orchestration further into workers.
5. Add pause/cancel/resume for long indexing jobs.
6. Replace metadata browser `getAll()` filtering with cursor/index-backed pagination.

Later:

7. Retrieval worker.
8. Cursor-based metadata browser refinements.
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
- Incremental scan/change detection: complete for directory-picker vaults.

### Phase 3: AI Retrieval

- Keyword search: complete.
- Search UI: complete.
- Semantic query embeddings: complete.
- Hybrid retrieval: complete.
- Ask query planning: complete for deterministic keyword/entity/exact-term planning.
- Ask multi-mode retrieval: complete for keyword, hybrid, and semantic search runs with chunk dedupe/reranking.
- Metadata filters and reranking: partial outside Ask mode.

### Phase 4: Trust and Polish

- Ask mode with citations: implemented with local Ollama synthesis, source panel evidence, and exact-answer bypasses for identifier lookups.
- Rename/move approval flow.
- Undo/action log.
- Duplicate detection.
- Animated indexing pipeline.
- ✅ Performance instrumentation.
