# FileSage Project Context

## Product

FileSage is a privacy-first AI files copilot for local folders. It combines two ideas:

- AI Downloads Copilot: organize messy folders with smart names, categories, tags, duplicate detection, and safe rename/move actions.
- Ask My Files: search and ask questions over local files using semantic retrieval, snippets, and citations.

Core pitch:

> Organize, search, and chat with your local files privately.

The main user story is: a user selects one or more local folders as vaults, FileSage scans and indexes them locally, suggests safer organization actions, and lets the user find or ask about files in natural language.

## Product Principles

- Strictly local-only for the initial product. Personal files, extracted text, embeddings, and answers should stay on the user's device with no paid API dependency.
- Trust before automation. MVP should not modify user files; it should show previews, confidence, explanations, and dry-run suggestions first. Later file operations need explicit approval, undo, and an audit trail.
- Search before chat. The primary flow should be folder connect, indexing, review/search, then ask mode.
- Evidence-first answers. Ask mode should cite retrieved snippets and files instead of behaving like a free-form chatbot.
- Performance is a product feature. Indexing must be incremental, parallel, resumable, and visibly measured.

## MVP Scope

The MVP should focus on:

- Folder connection through the File System Access API.
- User-selected folders as vaults from day one rather than a Downloads-only workflow.
- Recursive scanning of user-selected directories.
- Text extraction for PDFs, text/markdown, common code files, and average Windows-user document/file types. CSV is not a priority.
- Local metadata and index persistence.
- Basic semantic search over extracted chunks.
- Ask mode with retrieved snippets and file citations.
- Organize suggestions: filename, folder/category, tags, short reason, confidence.
- Safe actions: dry-run suggestions for the MVP. Real rename/move actions come later with explicit approval, action log, and undo.

Out of scope for v1:

- Cloud sync.
- Multi-user auth.
- Collaboration.
- Autonomous file operations without review.
- Support for every possible file type.
- Large local LLMs as a required dependency.

## Recommended Stack

- App: Next.js App Router with TypeScript.
- UI: Tailwind CSS plus shadcn/ui or a small local design system.
- Animation: Framer Motion for indexing and review flows.
- File access: File System Access API with upload fallback for unsupported browsers.
- Extraction: PDF.js for PDFs, Tesseract.js or Scribe.js for OCR, native parsers for text-like files.
- Embeddings: Transformers.js running in Web Workers.
- Storage: IndexedDB initially; consider RxDB with OPFS-backed storage for stronger local performance.
- Retrieval: local hybrid retrieval with metadata filters, keyword signals, normalized vector dot products, and reranking.
- Optional LLM: local WebLLM only after retrieval works. Remote API fallback is intentionally excluded for now.

## Target Architecture

Suggested source layout:

```text
src/
  app/
    page.tsx
    organize/page.tsx
    search/page.tsx
    ask/page.tsx
    settings/page.tsx
    api/
      answer/route.ts
      summarize/route.ts
  components/
    ingest/
    organize/
    search/
    ask/
    shared/
  features/
    file-access/
    indexing/
    extraction/
    embeddings/
    retrieval/
    actions/
  lib/
    db/
    parser/
    ranking/
    prompts/
    utils/
  workers/
    embedding.worker.ts
    ocr.worker.ts
    llm.worker.ts
  stores/
  types/
```

Primary pipeline:

1. User selects one or more folders as vaults.
2. Scanner gathers file handles and metadata.
3. Fingerprinter identifies unchanged files.
4. Extractor reads text and OCR output.
5. Chunker splits extracted content.
6. Embedder creates normalized vectors.
7. Indexer persists metadata, chunks, and vectors locally.
8. Retriever handles search and ask queries.
9. Organizer proposes file actions.
10. Action layer applies approved changes and records history.

## Performance Direction

The optimized design is a local-first, two-tier retrieval system:

- Hot local path: file scan -> extraction -> chunking -> embeddings -> local hybrid retrieval.
- Heavy work runs in Web Workers so the UI remains responsive.
- Indexing is incremental, resumable, and stage-based.
- Metadata filters run before vector scoring.
- Embeddings are normalized once at write time, allowing dot product scoring at query time.
- Hybrid retrieval combines keyword matching, dense vectors, and metadata boosts.
- Use flat vector scans for small/medium corpora until measurement proves ANN is needed.
- Consider OPFS/RxDB for faster persistence after the MVP baseline.
- Do not add remote vector DBs in the initial product. Revisit only if the project later expands into sync, collaboration, or very large corpora.

## UX Shape

Main tabs:

- Organize: review queue with current name, suggested name, category, tags, confidence, reason, preview, accept/edit/reject.
- Search: natural language search with filters, result clusters, snippets, and "why this result" explanations.
- Ask: chat-like interface grounded in retrieved snippets and file citations.

Visual direction:

- Clean, minimal, light-mode interface.
- Beige background with a restrained flat color palette.
- Minimal typography.
- Rounded shadcn/ui-style elements.
- Practical productivity feel rather than a loud marketing interface.

The indexing pipeline should be visible and understandable:

Scanning -> Extracting -> OCR -> Chunking -> Embedding -> Indexed -> Ready

## Interview Value

FileSage should demonstrate:

- Browser file APIs and local-first product design.
- OCR, parsing, embeddings, semantic retrieval, and grounded Q&A.
- Web Worker based ML execution.
- IndexedDB/OPFS storage and performance-aware indexing.
- Safe file operations with explainability and rollback.

The project should serve both portfolio/interview value and real daily personal use.
