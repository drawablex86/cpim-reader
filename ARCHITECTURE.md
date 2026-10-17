# System Architecture (`ARCHITECTURE.md`)

## 1. High-Level Data Flow

```text
[https://cpim.org/documents/] (250+ canonical documents dating from 2004 to present)
       │
       ▼ (1. Scrape HTML tables & Category tabs)
[scripts/sync.py] ◄───► [data/manifest.json] (Tracks URLs, SHA256, extraction method & status)
       │
       ├──► Route A: Direct Born-Digital PDF (.pdf in row or article)
       │       │
       │       ▼
       │     [.cache/pdfs/*.pdf] (Local git-ignored raw PDF cache)
       │       │
       │       ▼ (2. Tier 1 Instant Digital Extraction)
       │     [pymupdf4llm] (Instant, 0 MB VRAM, 100+ pages/sec)
       │
       ├──► Route B: Scanned / Complex Table PDF
       │       │
       │       ▼ (2. Tier 2/3 Hybrid Vision & Structuring)
       │     ┌──────────────────────────────────────────────────────────────┐
       │     │ Page Classifier (PyMuPDF inspect text density)               │
       │     │  ├─ Option A (Local Apple Silicon):                          │
       │     │  │    Vision: Ollama `qwen2.5vl:3b` / `glm-ocr`              │
       │     │  │    Structuring: Ollama `qwen2.5:7b`                       │
       │     │  └─ Option B (Cloud Free Fallback via OpenRouter):           │
       │     │       Vision: `nvidia/nemotron-3.5-super-vl:free`            │
       │     │       Structuring: `nvidia/nemotron-3-ultra-550b-a55b:free`  │
       │     └──────────────────────────────────────────────────────────────┘
       │
       └──► Route C: HTML Article Post (40+ resolutions published on cpim.org)
               │
               ▼
             [HTML Article Parser] (Extracts .articleText, strips share widgets)
       │
       ▼ (3. Emit Verbatim Markdown + Frontmatter V2)
[src/content/documents/{date}-{slug}.md]
       │
       ├──► [scripts/classify_documents.py] ──► Deterministic Taxonomy Tagging
       ├──► [scripts/embed.py] ───────────────► EmbeddingGemma 256-dim Vectors (static/vectors.json)
       ├──► [scripts/fortify_tags.py] ────────► Centroid Cosine Similarity Topic Fortification
       └──► [scripts/translate_single.py] ────► IndicTrans2 (CT2 INT8) / Gemma 31B Multilingual Markdown
       │
       ▼ (4. SvelteKit Static Pre-render + Pagefind WASM CLI)
[build/] (Pure static HTML/CSS/JS + WASM full-text search index + EmbeddingGemma vector DB)
```

---

## 2. Source Website Structure & Canonical Archive Ingestion

- **Source Catalog**: `https://cpim.org/documents/` catalogs **250+ official documents dating from 2004 to the present day**, including 20th through 24th Party Congress documents, Central Committee reports, election reviews, and national election manifestos.
- **Category Taxonomies**:
  - `All`: `https://cpim.org/documents/`
  - `CC Documents`: `https://cpim.org/cc-documents/`
  - `Party Congress`: `https://cpim.org/party-congress-documents/`
  - `Issues`: `https://cpim.org/position-on-some-issues/`
  - `Left View`: `https://cpim.org/some-notes-submitted-to-the-upa/`
  - `24th Party Congress`: `https://cpim.org/page-24th-party-congress/`
  - `23rd Party Congress`: `https://cpim.org/page-23rd-party-congress/`

### Dual Ingestion Handling:
1. **PDF Documents (~85% of catalog)**: Table row links to `/wp-content/uploads/YYYY/MM/<filename>.pdf` or legacy `/wp-content/uploads/old/documents/<filename>.pdf`.
2. **HTML Web Documents (~15% of catalog)**: Table row title links to an internal WordPress article page (e.g. `/stop-communal-polarisation-and-restore-peace-in-manipur/`). The official text is extracted from `<div class="articleText">` or `<div class="articleBody">`.
3. **Canonical Archive Filtering**: The discovery scraper in [scripts/sync.py](file:///Volumes/Rahuls%20T7/code/cpim-reader/scripts/sync.py) specifically excludes non-canonical regional translated reprints (e.g. legacy Hindi re-uploads that suffered from pre-Unicode font mojibake), standardizing on the canonical English master documents as the single source of truth for downstream machine translation.

---

## 3. Markdown Frontmatter Standard (Schema V2)

Every document generated in `src/content/documents/` adheres to this standardized YAML schema:

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

## 4. Multi-Tier Model & Extraction Architecture

1. **Tier 1 — Instant Digital Pass (`pymupdf4llm`)**:
   - For all modern born-digital PDFs with extractable text layers.
   - Zero VRAM, runs at 100+ pages per second.
2. **Tier 2 — Local Apple Silicon Inference (Ollama)**:
   - **Vision VLM**: `qwen2.5vl:3b` (Alibaba, ~3.2GB quantized) for native dynamic resolution and table extraction. `glm-ocr` (0.9B, ~1.2GB) supported as compact alternative.
   - **Text Structuring**: `qwen2.5:7b` (Q4_K_M, ~4.7GB) for verbatim cleanup and Roman numeral heading normalization.
3. **Tier 3 — Zero-Compute Cloud Free Fallback (NVIDIA Nemotron via OpenRouter)**:
   - When `OPENROUTER_API_KEY` is provided, requests can route to OpenRouter's free tier:
     - **`nvidia/nemotron-3-ultra-550b-a55b:free`** or **`nvidia/llama-3.1-nemotron-70b-instruct:free`** for structuring.
     - **`nvidia/nemotron-3.5-super-vl:free`** for multimodal vision OCR.
   - Eliminates local hardware and thermal stress on large backfills.

---

## 5. Dual-Engine Search Architecture

The platform combines two complementary client-side search technologies to provide instant access across 235+ historical documents without any backend server requirements:

### 5.1 Lexical & Exact Text Search (Pagefind WASM)
- **Indexing Phase**: Runs post-build via `npx pagefind --site build --output-path static/pagefind`.
- **Targeting**: Only the core reading body is indexed via `data-pagefind-body` to avoid indexing navigation or footer chrome.
- **Metadata Filters**: Ingestion categories and document types are exposed via `data-pagefind-filter="category"` and `data-pagefind-filter="doc_type"`.
- **Runtime Execution**: Dynamically loaded in the browser via `new Function('path', 'return import(path)')('/pagefind/pagefind.js')`, extracting highlighted snippet excerpts and scores.

### 5.2 Dense Semantic Vector Search (Google EmbeddingGemma 2 270M)
- **Vector Database**: A pre-computed 256-dimensional vector database stored in [static/vectors.json](file:///Volumes/Rahuls%20T7/code/cpim-reader/static/vectors.json) generated via [scripts/embed.py](file:///Volumes/Rahuls%20T7/code/cpim-reader/scripts/embed.py).
- **In-Browser Inference**: [src/lib/semantic-search.ts](file:///Volumes/Rahuls%20T7/code/cpim-reader/src/lib/semantic-search.ts) uses `@huggingface/transformers` to run `google/embeddinggemma-2-270m-it` entirely in the user's browser via WebAssembly / ONNX Runtime.
- **Natural Language Search**: Queries like *"how does the party view agrarian distress"* surface relevant resolutions even if exact keyword matches are absent.
- **Document Similarity Recommendations**: The `SimilarDocuments.svelte` component reads pre-computed document embeddings to calculate cosine similarity and recommend topically related historical resolutions directly in the reading sidebar.

---

## 6. Faceted Classification & Tag Fortification Subsystems

To transform a flat list of 235+ documents into an interconnected research archive, the system uses a two-phase taxonomy engine:

### 6.1 Deterministic Classification ([scripts/classify_documents.py](file:///Volumes/Rahuls%20T7/code/cpim-reader/scripts/classify_documents.py))
- Evaluates document titles, formal body headings (e.g., `### Resolution on...`), and topic salience frequencies.
- Assigns controlled taxonomies defined in [src/lib/taxonomy.ts](file:///Volumes/Rahuls%20T7/code/cpim-reader/src/lib/taxonomy.ts):
  - **`doc_type`**: `resolution`, `report`, `review`, `manifesto`, `speech`, `campaign`, `publication`, `policy-programme`, `legal`, `solidarity`.
  - **`topics`**: 14 controlled topics (Palestine, Labour & Workers, Agriculture & Kisan, Communalism & Secularism, Caste & Social Justice, Gender & Women's Rights, Healthcare, Education, Federalism & State Rights, Economic Crisis, Environment & Climate, Foreign Policy, Democratic Institutions, Mass Mobilization).
  - **`geography`**: `national`, `kerala`, `west-bengal`, `tripura`, `jammu-kashmir`, `andhra-pradesh`, `telangana`, `international`.
  - **`congress`**: `20th`, `21st`, `22nd`, `23rd`, `24th`.

### 6.2 Vector Cosine Tag Fortification ([scripts/fortify_tags.py](file:///Volumes/Rahuls%20T7/code/cpim-reader/scripts/fortify_tags.py))
- Solves the "omnibus resolution problem" where massive 50-page party congress political resolutions discuss gender equality, healthcare, or caste in dedicated sub-sections without mentioning them in the title.
- Computes topic centroid vectors from cornerstone anchor documents in `static/vectors.json`.
- Evaluates target documents against topic centroids using cosine similarity gated by section heading regex patterns, ensuring deep topics are accurately tagged in frontmatter without false positives.

---

## 7. Multilingual Translation Subsystem (IndicTrans2 & Gemma)

- **Dedicated Target Language**: Initial production focus is English ➔ Malayalam (`ml`), the primary regional language of the party's mass base.
- **Engines Supported**:
  1. **Quantized CTranslate2 INT8 (`ct2-200m`)**: Distilled IndicTrans2 200M model (~807 MB) running via CTranslate2. Sub-second inference (~0.4s per paragraph) with minimal unified memory footprint.
  2. **PyTorch Transformers 1B (`indictrans2:1b`)**: Full-precision Seq2Seq translation model.
  3. **Local Ollama (`qwen2.5:7b`)**: Multilingual LLM prompting fallback.
  4. **OpenRouter Cloud Free (`google/gemma-4-31b-it:free`)**: Zero-compute cloud fallback with deep linguistic comprehension.
- **Bilingual Reading Experience**:
  - [src/routes/docs/[slug]/+page.svelte](file:///Volumes/Rahuls%20T7/code/cpim-reader/src/routes/docs/%5Bslug%5D/+page.svelte) features a synchronized split-view bilingual reader.
  - Svelte 5 runes synchronize scroll positions proportionally between English master prose and the translated Malayalam text.

---

## 8. Vite Development Server Middlewares & Streaming RPC

To provide an in-browser dev environment without requiring terminal multitasking, [vite.config.ts](file:///Volumes/Rahuls%20T7/code/cpim-reader/vite.config.ts) configures dev-only HTTP middlewares (`apply: 'serve'`):

1. `GET /api/dev/sync-status`: Returns total processed count and latest document timestamp from `data/manifest.json`.
2. `POST /api/dev/sync`: Spawns `scripts/sync.py` and streams stdout/stderr chunks in real time over chunked transfer encoding.
3. `POST /api/dev/embed`: Spawns `scripts/embed.py` and streams vector generation logs.
4. `GET /api/dev/models`: Inspects availability of local Ollama models, CTranslate2 INT8 weights, PyTorch models, and OpenRouter API keys.
5. `GET /api/dev/translation-catalog`: Queries translation completion status (`pending` vs. `completed`) across all 235+ documents.
6. `POST /api/dev/translate`: Spawns `scripts/translate_single.py` and streams paragraph-by-paragraph translation progress.

These endpoints connect to the tactile Soviet Constructivist [DevPipelineModal.svelte](file:///Volumes/Rahuls%20T7/code/cpim-reader/src/lib/components/DevPipelineModal.svelte) component.

---

## 9. Static Web Application Architecture

- **Framework**: SvelteKit 2 with `@sveltejs/adapter-static` (`prerender = true`).
- **Reactivity Model**: Pure **Svelte 5 Runes** (`$props()`, `$state()`, `$derived()`, `$effect()`).
- **Markdown Pipeline**: `mdsvex` configured with `rehype-slug` and `rehype-autolink-headings`, ensuring all `h1`, `h2`, and `h3` receive deterministic anchor IDs.
- **Dynamic Entry Prerendering**: `src/routes/docs/[slug]/+page.ts` exports `entries()` reading `import.meta.glob('/src/content/documents/*.md')` to prerender every document statically at build time.
- **Design System Integration**: Strict implementation of [DESIGN_SYSTEM.md](file:///Volumes/Rahuls%20T7/code/cpim-reader/DESIGN_SYSTEM.md):
  - Soviet Constructivist shell: sharp 90° planar layout, 3px solid black borders, `#C41E3A` red accents, tactile drop-shadows.
  - Scholarly editorial reading canvas: `Newsreader` serif, `max-width: 68ch`, comfortable line height.
  - Sticky Table of Contents, split-screen original PDF verification, and one-click multi-standard academic citations.