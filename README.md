# FileSage

> Organize, search, and chat with your local files — privately.

FileSage is a privacy-first AI files copilot that runs entirely in your browser. No cloud, no API keys, no data ever leaves your device.

---

## What it does

- **Vault connection** — connect any local folder as a vault using the File System Access API (or upload fallback)
- **Local indexing** — recursively scans files, extracts text, chunks content, and generates semantic embeddings
- **File browser** — search and filter your indexed files by name, extension, or vault
- **Organize** *(coming soon)* — smart rename/category/tag suggestions with dry-run previews
- **Search** *(coming soon)* — natural language semantic search with snippets and file citations
- **Ask** *(coming soon)* — chat with your files, grounded in retrieved evidence

---

## Stack

LayerTechnologyAppNext.js 16 App Router + TypeScriptUITailwind CSS v4 + shadcn/uiFile accessFile System Access API + upload fallbackText extractionFileReader (UTF-8) + PDF.jsEmbeddings`@huggingface/transformers` v4 (`all-MiniLM-L6-v2`, 384-dim)StorageIndexedDB (v3 — vaults, files, chunks, vectors)RuntimeAll ML runs in the browser via WASM/WebGL — no server needed

---

## Embedding model

`Xenova/all-MiniLM-L6-v2`

- 23 MB, 384-dimensional vectors
- Downloaded once and cached in the browser
- Runs via `@huggingface/transformers` v4 (WASM backend)
- Vectors are normalized at write time for fast dot-product scoring at query time

---

## Pipeline

```
Select vault
    └─ Scan files (recursive)
        └─ Extract text (txt, md, code, PDF, ...)
            └─ Chunk (~1600 chars, 200-char overlap)
                └─ Embed (all-MiniLM-L6-v2, batch=32)
                    └─ Persist (IndexedDB — chunks + vectors)
```

---

## Getting started

```bash
git clone https://github.com/kunalmttl/FileSage.git
cd FileSage
npm install
npm run dev
```

Open <http://localhost:3000>.

> **Note:** The first time you connect a vault, the embedding model (\~23 MB) will download and cache in your browser. Subsequent runs load from cache instantly.

---

## Project structure

```
src/
  app/                  # Next.js App Router pages
  components/
    layout/             # AppShell, SidebarNav, PageHeader
    shared/             # FileMetadataBrowser, EmptyState, PipelineStatus, ...
    ui/                 # shadcn/ui primitives
  features/
    file-access/        # Vault picker, permission handling, upload fallback
    indexing/           # Recursive file scanner
    extraction/         # Text extractor, PDF extractor, chunker, pipeline
    embeddings/         # Embed pipeline (worker orchestration)
  lib/
    db/                 # IndexedDB wrapper (filesage-db.ts) + types
  workers/
    embedding.worker.ts # Transformers.js Web Worker
  types/                # File System Access API type augmentations
```

---

## Privacy

- All file content, extracted text, embeddings, and vectors stay on your device
- Nothing is sent to any server
- No analytics, no telemetry, no ads

---

## Status

PhaseStatusVault connection + scanning✅ DoneText + PDF extraction✅ DoneChunking + embedding✅ DoneFile metadata browser✅ DoneHybrid retrieval (keyword + vector)🔄 NextSearch UI🔄 NextAsk mode with citations📋 PlannedOrganize suggestions (dry-run)📋 Planned

---

## Known limitations (v0.1)

- Embedding and extraction run on the main thread — large vaults may feel slow
- No incremental indexing yet — rescanning rewrites all data
- Fallback upload vaults cannot be rescanned (no file handles)
- No OCR support yet (scanned PDFs will extract little/no text)
