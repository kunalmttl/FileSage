<div align="center">

# 🗂️ FileSage

### Your Private, Local-First AI Files Copilot

**Search, chat with, and organize your files — entirely in your browser.**\
No cloud. No API keys. No data ever leaves your device.

[![Next.js](https://img.shields.io/badge/Next.js_16-000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React_19-087EA4?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript_5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-DDE3D6?style=for-the-badge)](LICENSE)

</div>

---

## ✨ What is FileSage?

FileSage is a **privacy-first, browser-native AI copilot** for your local files. Point it at any folder on your machine, and it will scan, extract text, chunk, embed, and index everything — all client-side, using Web Workers and IndexedDB. Then search by meaning, ask questions with cited answers, or get AI-powered organization suggestions.

**Your files never leave your device.** There is no server, no cloud dependency, and no API key required to get started.

---

## 🎯 Who is this for?

| Audience | Use case |
|---|---|
| 🔒 **Privacy-conscious professionals** | Lawyers, doctors, and accountants handling sensitive documents |
| 🎓 **Researchers & academics** | Semantic search across large paper and note collections |
| 📚 **Students** | Course materials, lecture notes, and assignments across subjects |
| 💻 **Developers** | Code repositories, configs, and documentation |
| 📁 **Anyone with too many files** | If you've ever thought "I know I saved that somewhere…" |

---

## 🚀 Quickstart

```bash
# Clone the repository
git clone https://github.com/kunalmttl/FileSage.git
cd FileSage

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** and connect your first vault.

---

## 🧭 How It Works

```
📁 Connect a folder          ──→  Your folder becomes a "Vault"
    ↓
🔍 Scan & Extract            ──→  Recursive scan, text extraction (35+ formats, PDF)
    ↓
✂️  Chunk                     ──→  ~1,600-char overlapping chunks
    ↓
🧮 Embed                     ──→  384-dim vectors via MiniLM-L6-v2 (Web Worker)
    ↓
💾 Store                     ──→  Vectors, chunks, postings → IndexedDB
    ↓
🔎 Search / 💬 Ask / ✨ Organize
```

Everything happens **in your browser**. The embedding model runs in a Web Worker. LLM inference is local by default. IndexedDB is your database.

---

## 📸 Features

### 🏠 Dashboard

The home dashboard gives you a bird's-eye view of your vaults with an integrated, real-time **indexing pipeline status track** that animates through each stage as your files are processed: *Scanning → Extracting → OCR → Chunking → Embedding → Indexed → Ready*.

Quick-action cards take you directly to Search, Ask, or Organize.

---

### 🔎 Hybrid Search

Search your files by **keyword**, **semantic meaning**, or **hybrid** mode that fuses both:

- **BM25 keyword scoring** — classic information retrieval with term frequency and inverse document frequency
- **Semantic vector search** — cosine similarity against 384-dimensional embeddings
- **Reciprocal Rank Fusion (RRF)** — merges keyword and semantic rankings for the best of both worlds
- **Highlighted snippets** — matching terms are highlighted in context
- **Vault filtering** — scope searches to specific folders

---

### 💬 Ask (RAG Chat)

Chat with your files and get **cited, grounded answers**:

1. **Deterministic Query Planner** — classifies intent (factual, exploratory, comparison, listing) and extracts keywords, entities, and search queries — no LLM needed
2. **Multi-Query Retrieval** — runs multiple search strategies (keyword, hybrid, semantic) and deduplicates results
3. **Context Builder** — packs top chunks into a token-budgeted prompt with numbered citations
4. **Exact-Answer Bypasses** — structured data (Aadhaar numbers, phone numbers, dates, IDs) is extracted directly from chunks without calling the LLM
5. **Streaming LLM Response** — grounded answer with `[N]` citation markers mapped back to source files
6. **Source Panel** — shows which chunks were retrieved, relevance scores, and retrieval diagnostics

#### Supported LLM Providers

| Provider | Execution | Setup |
|---|---|---|
| **Ollama** | Local server | `ollama pull gemma3:1b` → ready |
| **Wllama** | CPU in Web Worker | Zero setup, downloads GGUF model |
| **WebLLM** | WebGPU (experimental) | Chrome 113+ with WebGPU |
| **BYOK OpenAI-compatible** | Remote API (opt-in) | Provide endpoint + key |

> **Default experience**: Ollama or Wllama. No API keys required.\
> The BYOK option is clearly labeled — data leaves your device only if you choose it.

---

### ✨ Organize *(Coming Soon)*

AI-powered file organization in **dry-run mode**:

- Smart rename suggestions
- Category and tag inference
- Duplicate detection
- Folder restructuring recommendations
- Preview-first — nothing changes until you approve

---

### ⚙️ Settings

- **LLM provider & model selection** — switch between Ollama, Wllama, WebLLM, or BYOK
- **Inference parameters** — context window, max tokens, temperature
- **Performance metrics** — pipeline and search timing instrumentation visible in a debug panel
- All settings persisted in `localStorage`

---

## 📂 Supported File Types

<details>
<summary><strong>35+ file types</strong> (click to expand)</summary>

| Category | Extensions |
|---|---|
| **Text** | `.txt` `.md` `.mdx` `.markdown` `.log` `.text` |
| **Web** | `.html` `.htm` `.xml` `.svg` `.css` |
| **Data** | `.json` `.yaml` `.yml` `.toml` `.ini` `.env` |
| **JavaScript/TypeScript** | `.ts` `.tsx` `.js` `.jsx` `.mjs` `.cjs` |
| **Python** | `.py` `.pyw` |
| **JVM** | `.java` `.kt` `.kts` `.scala` |
| **C-family** | `.c` `.cpp` `.cc` `.cxx` `.h` `.hpp` `.cs` |
| **Systems** | `.go` `.rs` `.swift` |
| **Scripting** | `.rb` `.php` `.lua` `.r` `.dart` `.ex` `.exs` |
| **Shell** | `.sh` `.bash` `.zsh` `.fish` `.ps1` `.bat` `.cmd` |
| **Query** | `.sql` `.graphql` `.gql` |
| **Config** | `.gitignore` `.editorconfig` `.prettierrc` `.dockerfile` `.makefile` |
| **PDF** | `.pdf` (via PDF.js with page-level extraction, image-only detection, 100-page cap) |

</details>

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Browser                               │
│                                                              │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │
│  │  React   │  │ Embedding│  │   LLM    │  │  IndexedDB  │  │
│  │   UI     │  │  Worker  │  │  Worker  │  │   (v7)      │  │
│  │ (Next.js)│  │ (MiniLM) │  │ (Wllama) │  │             │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬──────┘  │
│       │              │             │               │         │
│       └──────────────┴─────────────┴───────────────┘         │
│                           │                                  │
│              File System Access API                          │
│              (or upload fallback)                             │
└──────────────────────────────────────────────────────────────┘
```

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router) |
| **UI** | React 19, shadcn/ui, Tailwind CSS, Lucide icons |
| **Typography** | Lufga (headings) + Urbanist (body) |
| **Design** | Glassmorphism, sage-green palette, light mode |
| **Storage** | IndexedDB v7 (raw wrapper — no Dexie) |
| **Embeddings** | `@huggingface/transformers` — Xenova/all-MiniLM-L6-v2 (384-dim) |
| **PDF** | pdfjs-dist |
| **LLM** | Ollama / WebLLM / Wllama / BYOK OpenAI-compatible |
| **Retrieval** | BM25 + cosine similarity + Reciprocal Rank Fusion |

---

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            #   Dashboard
│   ├── search/             #   Hybrid search UI
│   ├── ask/                #   RAG chat UI
│   ├── organize/           #   Organization (coming soon)
│   ├── settings/           #   Provider & performance settings
│   └── api/ask/            #   Ollama + BYOK proxy routes
│
├── components/
│   ├── layout/             # App shell, sidebar, page header
│   ├── shared/             # Pipeline status, readiness card, quick actions
│   ├── ask/                # Chat thread, source panel, suggested prompts
│   ├── search/             # Search workspace, results, snippets
│   ├── settings/           # Settings workspace
│   └── ui/                 # shadcn/ui primitives
│
├── features/
│   ├── file-access/        # Directory picker, permissions, vault connector
│   ├── indexing/            # Recursive scanner, fingerprinting, classification
│   ├── extraction/         # Text + PDF extraction, chunking pipeline
│   ├── embeddings/         # Embedding pipeline + worker orchestration
│   ├── retrieval/          # BM25, vectors, fusion, snippets, tokenizer
│   └── ask/                # Query planner, context builder, LLM service,
│                           #   citation resolver, exact-answer bypasses
│
├── workers/                # Web Workers (embedding, LLM inference)
│
└── lib/
    ├── db/                 # IndexedDB wrapper + type definitions
    └── performance/        # Pipeline & search timing instrumentation
```

---

## ⚡ Performance

FileSage is optimized for responsiveness even on large vaults:

| Optimization | Before | After |
|---|---|---|
| Search chunk loading | ~5,450 ms | ~3–6 ms |
| Total hybrid search | ~5,735 ms | ~338 ms |
| Embedding progress ticks | 48–73 s gaps | 6–11 s ticks |
| Unchanged vault rescan | Full re-index | Instant skip |

Key optimizations:
- **Targeted chunk loading** — only top-K fused chunks are fetched, not the entire vault
- **Incremental rescans** — file fingerprinting skips unchanged files entirely
- **Sub-batched IndexedDB writes** — relaxed durability, 50-record batches
- **Image-only PDF early exit** — detected in <50 ms
- **Bounded concurrency** — 4 parallel extraction workers with throttled progress callbacks

---

## 🔐 Privacy

FileSage is **private by architecture**, not just by policy:

- ✅ **All data stays in IndexedDB** — nothing is sent to any server
- ✅ **Embeddings run in a local Web Worker** — no network calls
- ✅ **LLM inference is local by default** — Ollama, Wllama, or WebLLM
- ✅ **No telemetry, no analytics, no tracking** — zero external requests
- ✅ **File operations are dry-run only** — nothing changes without your explicit approval
- ⚠️ **BYOK OpenAI-compatible is opt-in** — clearly labeled that data leaves your device

---

## 🛣️ Roadmap

- [x] **Phase 1** — Core indexing pipeline (scan → extract → chunk → embed → search)
- [x] **Phase 2** — RAG chat with multi-provider LLM support and citation grounding
- [ ] **Phase 3** — Smart organization (rename suggestions, categories, tags, dry-run)
- [ ] **Phase 4** — Advanced features (cross-vault search, file graphs, PWA, export)

---

## 🤝 Contributing

Contributions are welcome! FileSage is a local-first application — please ensure any contributions maintain the privacy-by-architecture principle.

```bash
npm install      # Install dependencies
npm run dev      # Start dev server
npm run build    # Production build
npm run lint     # Run ESLint
```

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built with privacy in mind.** Your files, your device, your data.

*FileSage — Local AI Files Copilot*

</div>
