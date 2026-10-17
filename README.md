# CPI(M) Official Documents Archive (`cpim-reader`)

[![Svelte 5](https://img.shields.io/badge/Svelte-5-FF3E00.svg)](https://svelte.dev)
[![SvelteKit Static](https://img.shields.io/badge/Adapter-Static-FF3E00.svg)](https://kit.svelte.dev)
[![Pagefind WASM](https://img.shields.io/badge/Search-Pagefind%20WASM-000000.svg)](https://pagefind.app)
[![EmbeddingGemma 2](https://img.shields.io/badge/Vector%20Search-EmbeddingGemma%202-4285F4.svg)](https://huggingface.co/google/embeddinggemma-2-270m-it)
[![IndicTrans2](https://img.shields.io/badge/Translation-IndicTrans2%20CT2-E53935.svg)](https://github.com/AI4Bharat/IndicTrans2)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An offline-capable, static, and richly navigable archival research portal for official resolutions, party congress reports, Central Committee statements, and election manifestos published by the **Communist Party of India (Marxist)** at [cpim.org/documents](https://cpim.org/documents/).

The repository unites **100% canonical archive coverage** (235+ historical documents dating back to 2004) with an experimental **Soviet Constructivist exterior shell** and a scholarly, distraction-free modern editorial reading environment.

---

## Key Features

- **Soviet Constructivist Research Shell**:
  - Sharp 90° planar geometry, heavy black rules (`3px solid #000`), tactile offset drop-shadows (`4px 4px 0px #000`), bold industrial type (`Space Grotesk`, `JetBrains Mono`), and revolutionary red accents (`#C41E3A`).
- **Scholarly Reading Canvas**:
  - Calibrated editorial typography (`Newsreader` serif, `max-width: 68ch`, comfortable line height 1.78) designed for sustained archival study.
  - Sticky Table of Contents sidebar with active section tracking via `IntersectionObserver`.
  - Heading anchor deep-linking with one-click URL copying.
  - **Split-Screen Original PDF Verification**: Compare transcribed Markdown against official scanned PDFs side-by-side with synchronized iframe inspection.
  - **Academic Citation Generator**: One-click citation formatting for APA, MLA, Chicago, and BibTeX, complete with instant clipboard copying and `.bib` file downloads.
- **Dual-Engine Search Architecture**:
  - **Keyword & Full-Text Excerpts (Pagefind WASM)**: Instant client-side indexing with highlighted keyword snippets, zero backend server requirements, and offline capability.
  - **Dense Semantic Vector Search (Google EmbeddingGemma 2 270M)**: In-browser vector inference using `@huggingface/transformers` ONNX/WASM combined with a pre-computed 256-dimensional vector database (`static/vectors.json`), supporting natural-language concept matching and cross-document recommendations (`SimilarDocuments`).
- **Faceted Archival Classification & Tag Fortification**:
  - Multi-axis taxonomy categorizing documents by **Document Type** (`resolution`, `report`, `review`, `manifesto`, `speech`, `campaign`, `publication`, etc.), **Topics** (Palestine, Labour & Workers, Agriculture & Kisan, Communalism & Secularism, Caste & Social Justice, Gender & Women's Rights, Healthcare, Environment & Climate, Foreign Policy & Anti-Imperialism, etc.), **Geography** (National, Kerala, West Bengal, Tripura, International, etc.), and **Party Congress Milestones** (20th through 24th Congress).
  - Hybrid vector centroid fortification detecting cross-cutting themes inside massive omnibus reports and manifestos via cosine similarity.
- **Bilingual & Multilingual Reading Canvas**:
  - Synchronized bilingual split-view reader with linked side-by-side scrolling between original English documents and verified Malayalam translations.
  - Multi-engine translation pipeline supporting fast local CTranslate2 INT8 models (`IndicTrans2 200M`), PyTorch 1B models, local Ollama (`qwen2.5:7b`), and OpenRouter Cloud API (`google/gemma-4-31b-it:free`).
- **In-Browser Constructivist Dev Pipeline Terminal**:
  - Live modal in the web app connecting to Vite development server streaming middlewares.
  - Trigger and stream live scraping, vector embedding generation, and single-document translation runs directly from the browser UI with real-time heartbeat status.

---

## Architecture at a Glance

```text
[cpim.org/documents/] (250+ official resolutions & reports)
       │
       ▼ (1. Python Scraper & Deduplication)
[scripts/sync.py] ◄───► [data/manifest.json] (Tracks URLs, SHA256, extraction method)
       │
       ├──► Route A: Born-Digital PDF ────► pymupdf4llm (Instant, 0 MB VRAM)
       ├──► Route B: Scanned / Table PDF ─► Ollama Qwen2.5-VL 3B / OpenRouter Nemotron
       └──► Route C: HTML Article Post ───► Article Text Parser (Clean HTML to MD)
       │
       ▼ (2. Verbatim Markdown + Frontmatter V2 Schema)
[src/content/documents/{date}-{slug}.md]
       │
       ├──► [scripts/classify_documents.py] ──► Deterministic Taxonomy Tagging
       ├──► [scripts/embed.py] ───────────────► EmbeddingGemma 256-dim Vectors (static/vectors.json)
       ├──► [scripts/fortify_tags.py] ────────► Centroid Cosine Similarity Topic Fortification
       └──► [scripts/translate_single.py] ────► IndicTrans2 / Gemma Multilingual Markdown
       │
       ▼ (3. Static Build & Client Search Compilation)
[SvelteKit Static Build] + [Pagefind WASM CLI]
       │
       ▼
[build/] (100% Offline Static Site: HTML, CSS, JS, WASM Search Index & Vector DB)
```

For comprehensive architectural specifications, refer to [ARCHITECTURE.md](file:///Volumes/Rahuls%20T7/code/cpim-reader/ARCHITECTURE.md) and [DESIGN_SYSTEM.md](file:///Volumes/Rahuls%20T7/code/cpim-reader/DESIGN_SYSTEM.md).

---

## Directory Structure

```text
cpim-reader/
├── data/
│   └── manifest.json             # Canonical ingestion manifest (status, SHA256, dates, URLs)
├── scripts/
│   ├── sync.py                   # Catalog scraper & tiered PDF/HTML extraction pipeline
│   ├── embed.py                  # EmbeddingGemma 2 vector embedding generator
│   ├── classify_documents.py     # Deterministic archival taxonomy classifier
│   ├── fortify_tags.py           # Cosine similarity tag fortification engine
│   ├── translate.py              # Batch translation engine
│   ├── translate_single.py       # Single-document translation CLI (CT2, Ollama, OpenRouter)
│   ├── download_model.py         # CTranslate2 / HuggingFace model downloader
│   ├── glossary/                 # Marxist-Leninist terminology translation glossaries
│   └── requirements.txt          # Python dependencies
├── src/
│   ├── content/
│   │   ├── documents/            # 235+ Canonical English Markdown documents
│   │   └── translations/         # Verified translations (e.g. Malayalam in `ml/`)
│   ├── lib/
│   │   ├── components/
│   │   │   ├── CitationModal.svelte        # Multi-standard citation exporter
│   │   │   ├── DevPipelineModal.svelte     # In-browser streaming dev console
│   │   │   ├── LanguageSelector.svelte     # Bilingual selector & toggle
│   │   │   ├── SemanticResultsPanel.svelte # EmbeddingGemma search UI
│   │   │   └── SimilarDocuments.svelte     # Related document recommendations
│   │   ├── documents.ts          # Document metadata typing & mdsvex loaders
│   │   ├── semantic-search.ts    # In-browser ONNX/WASM vector search client
│   │   └── taxonomy.ts           # Controlled taxonomies, topics, and translations
│   └── routes/
│       ├── +layout.svelte        # Constructivist masthead, banner & global shell
│       ├── +page.svelte          # Archive explorer, faceted filters & search
│       └── docs/[slug]/          # Scholarly reader, TOC, split PDF & bilingual panes
├── static/
│   ├── vectors.json              # Pre-computed 256-dimensional document embeddings
│   └── pagefind/                 # Client-side WASM search bundle (post-build)
├── AGENTS.md                     # Operational instructions for AI coding assistants
├── ARCHITECTURE.md               # Technical system architecture and contracts
├── DESIGN_SYSTEM.md              # Constructivist design tokens and component specs
├── LLM_SPEC.md                   # Model specs, hardware constraints and prompts
└── package.json                  # Node scripts and dependencies
```

---

## Getting Started

### Prerequisites

- **Node.js**: `v18.0.0` or later
- **Python**: `3.10` or later
- *(Optional)* **Ollama**: For running local vision (`qwen2.5vl:3b`) or text structuring (`qwen2.5:7b`) models
- *(Optional)* **OpenRouter API Key**: For zero-compute cloud extraction or translation fallbacks

### 1. Installation

Clone the repository and install both web and Python dependencies:

```bash
# Clone the repository
git clone https://github.com/rahulrajeeeev/cpim-reader.git
cd cpim-reader

# Install Node dependencies (SvelteKit, mdsvex, Pagefind, @huggingface/transformers)
npm install

# Setup Python virtual environment
python3 -m venv .venv
source .venv/bin/activate
pip install -r scripts/requirements.txt
```

### 2. Running the Development Server

Start the Vite development server:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. The development server includes active Vite streaming middlewares for running sync, embedding, and translation routines from the in-browser Dev Pipeline Modal.

### 3. Production Build & Static Search Indexing

To build the static site and compile the client-side Pagefind WASM search index:

```bash
npm run build
```

Preview the static distribution locally:

```bash
npm run preview
```

The resulting `build/` folder is 100% self-contained and ready to deploy on any static hosting provider (GitHub Pages, Cloudflare Pages, Netlify, Vercel, or an offline static server).

---

## Operational Pipelines & CLI Reference

All data preparation and extraction tasks are executed via standalone Python scripts and npm script aliases.

### 1. Catalog Ingestion & Extraction (`scripts/sync.py`)

Scrapes `cpim.org/documents/`, checks `data/manifest.json` to prevent re-processing existing documents, and runs tiered extraction:

```bash
# Preview what would be downloaded or extracted
python scripts/sync.py --dry-run

# Run incremental sync (process up to 5 pending documents)
python scripts/sync.py --limit 5

# Force re-ingestion using local Ollama models
python scripts/sync.py --provider ollama --force --limit 2

# Run extraction using OpenRouter Nemotron cloud fallback
OPENROUTER_API_KEY="sk-or-..." python scripts/sync.py --provider openrouter --limit 3
```

### 2. Semantic Vector Embeddings (`scripts/embed.py`)

Generates normalized vector embeddings for all documents in `src/content/documents/*.md` using Google's `embeddinggemma-2:270m` (or local Ollama / sentence-transformers) and outputs to `static/vectors.json`:

```bash
# Generate 256-dimensional embeddings for newly added documents
npm run embed
# or:
python scripts/embed.py --dim 256

# Force regeneration of all vector embeddings
python scripts/embed.py --dim 256 --force
```

### 3. Archival Taxonomy Classification (`scripts/classify_documents.py`)

Applies controlled metadata taxonomies (`doc_type`, `topics`, `geography`, `congress`) to document frontmatter using deterministic rules and heading analysis:

```bash
# Preview classification changes
python scripts/classify_documents.py --dry-run

# Apply classification to all Markdown documents and translations
npm run classify
# or:
python scripts/classify_documents.py
```

### 4. Vector Cosine Tag Fortification (`scripts/fortify_tags.py`)

Scans omnibus party congress reports and election manifestos to discover buried cross-cutting topics (gender equality, caste annihilation, healthcare, labor rights) using topic centroid cosine similarity against `static/vectors.json`:

```bash
# Preview fortified tags
python scripts/fortify_tags.py --dry-run

# Apply fortified tags across all documents
npm run fortify
# or:
python scripts/fortify_tags.py
```

### 5. Multilingual Translation CLI (`scripts/translate_single.py`)

Translates canonical English documents into Indic languages (primary focus: Malayalam) and saves clean Markdown into `src/content/translations/`:

```bash
# Download quantized CTranslate2 INT8 IndicTrans2 model (807 MB)
python scripts/download_model.py

# Translate a document using quantized CTranslate2 INT8 (sub-second per paragraph)
python scripts/translate_single.py --slug 2025-04-04-resolution-to-condemn-israels-genocidal-attacks-on-gaza --engine ct2 --lang ml --save

# Translate using OpenRouter Free Gemma 31B Cloud API
OPENROUTER_API_KEY="sk-or-..." python scripts/translate_single.py --slug 2025-04-04-resolution-to-condemn-israels-genocidal-attacks-on-gaza --engine openrouter --lang ml --save
```

---

## Archival Frontmatter Standard (V2 Schema)

All Markdown files in `src/content/documents/*.md` strictly adhere to the following YAML schema:

```yaml
---
title: "Draft Political Resolution for the 24th Congress"
slug: "2025-02-18-draft-political-resolution-for-24th-congress"
date: "2025-02-18"
category: "Party Congress"
author: "Central Committee, Communist Party of India (Marxist)"
publisher: "Communist Party of India (Marxist)"
source_pdf_url: "https://cpim.org/wp-content/uploads/2025/02/Draft-Political-Resolution-24th-Congress.pdf"
source_post_url: "https://cpim.org/draft-political-resolution-for-24th-congress/"
page_count: 52
extraction_method: "pymupdf4llm"
sha256: "d5a8b792194cf3a56cf99878ce6a678438b4d812fa480b2a752be351b6dc36b4"
doc_type: "resolution"
topics:
  - "international-situation"
  - "economic-crisis"
  - "communalism-secularism"
  - "caste-social-justice"
  - "labour-workers"
geography: "national"
congress: "24th"
translations:
  ml:
    title: "24-ാം പാർട്ടി കോൺഗ്രസിനായുള്ള കരട് രാഷ്ട്രീയ പ്രമേയം"
    file: "src/content/translations/ml/2025-02-18-draft-political-resolution-for-24th-congress.md"
    engine: "ct2"
    updated_at: "2026-10-16T23:30:00"
---
```

---

## Hardware & Thermal Profile (Apple Silicon / M1 16GB)

The local pipeline has been carefully configured for fanless Apple Silicon hardware (e.g. M1 MacBook Air 16GB RAM):
- **Serial Concurrency**: Local Ollama and vision models run with `concurrency = 1`.
- **Memory Hygiene**: Ollama requests pass `keep_alive = "5m"` to release unified RAM promptly after extraction passes.
- **Raster Resolution Cap**: PDF page rasterization is capped at `max_dim = 1024px` at 140 DPI.
- **Quantized Translation**: IndicTrans2 runs in INT8 via CTranslate2, consuming only ~800MB of RAM and executing in ~0.4s per paragraph.
- **Zero-Compute Cloud Fallback**: Full support for OpenRouter free models (`nvidia/nemotron-3-ultra-550b-a55b:free` and `google/gemma-4-31b-it:free`) when zero battery/GPU draw is preferred.

---

## License

This software and web reader implementation are licensed under the [MIT License](LICENSE). Official CPI(M) resolutions, reports, and political documents remain the property of the Communist Party of India (Marxist) and are curated here for non-commercial educational, scholarly, and archival research purposes.
