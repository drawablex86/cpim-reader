# System Architecture (`ARCHITECTURE.md`)

## 1. High-Level Data Flow

```text
[https://cpim.org/documents/] (273+ documents from 2008 to present)
       │
       ▼ (1. Scrape HTML tables & Category tabs)
[scripts/sync.py] ◄───► [data/manifest.json] (Tracks seen URLs, SHA256 & extraction method)
       │
       ├──► Route A: Direct PDF Download (.pdf in row or article)
       │       │
       │       ▼
       │     [.cache/pdfs/*.pdf] (Local git-ignored raw PDF cache)
       │       │
       │       ▼ (2. Tiered Hybrid Extraction)
       │     ┌──────────────────────────────────────────────────────────────┐
       │     │ Page Classifier (PyMuPDF inspect per page)                   │
       │     │  ├─ Digital Text Page (born-digital text layer)              │
       │     │  │    └──► pymupdf4llm (Instant, 0 MB VRAM)                  │
       │     │  └─ Scanned / Image Page OR Complex Data Table               │
       │     │       ├──► Option A (Local): Ollama `qwen2.5vl:3b` / `glm-ocr`│
       │     │       └──► Option B (Cloud Free): OpenRouter                 │
       │     │            `nvidia/nemotron-3.5-super-vl:free`               │
       │     │                                                              │
       │     │ Structural Hierarchy & Letterhead Normalization:             │
       │     │  ├──► Option A (Local): Ollama `qwen2.5:7b` (Q4_K_M)         │
       │     │  └──► Option B (Cloud Free): OpenRouter                      │
       │     │       `nvidia/nemotron-3-ultra-550b-a55b:free`               │
       │     └──────────────────────────────────────────────────────────────┘
       │
       └──► Route B: HTML Article Post (40+ resolutions published on cpim.org)
               │
               ▼
             [HTML Article Parser] (Extracts .articleText, strips share widgets)
       │
       ▼ (3. Emit clean Markdown + YAML Frontmatter)
[src/content/documents/{date}-{slug}.md]
       │
       ▼ (4. SvelteKit Static Pre-render + Pagefind CLI)
[build/] (Pure static HTML/CSS/JS + WASM full-text search index)
```

---

## 2. Source Website Structure (`cpim.org/documents/`)

- The official documents repository at `https://cpim.org/documents/` catalogs **273+ documents dating from June 2008 to the present day**.
- Documents span multiple official category taxonomies exposed via tabbed navigation:
  - `All`: `https://cpim.org/documents/`
  - `CC Documents`: `https://cpim.org/cc-documents/`
  - `Party Congress`: `https://cpim.org/party-congress-documents/`
  - `Others`: `https://cpim.org/others-documents/`
  - `Issues`: `https://cpim.org/position-on-some-issues/`
  - `Left View`: `https://cpim.org/some-notes-submitted-to-the-upa/`
  - `24th Party Congress`: `https://cpim.org/page-24th-party-congress/`
  - `23rd Party Congress`: `https://cpim.org/page-23rd-party-congress/`

### Dual Document Ingestion Reality:
1. **PDF Documents (~85% of catalog)**: Table row contains direct link to `/wp-content/uploads/YYYY/MM/<filename>.pdf` or legacy `/wp-content/uploads/old/documents/<filename>.pdf`.
2. **HTML Web Documents (~15% of catalog)**: Table row title links to an internal WordPress article page (e.g., `/stop-communal-polarisation-and-restore-peace-in-manipur/`). The official text is contained within `<div class="articleText">` or `<div class="articleBody">`.

---

## 3. Markdown Frontmatter Contract

Every generated file in `src/content/documents/` adheres strictly to this YAML schema:

```yaml
---
title: "Review of Assembly Election Results – July 2026"
slug: "2026-07-27-review-of-assembly-election-results-july-2026"
date: "2026-07-27"
category: "CC Documents"
author: "Central Committee, Communist Party of India (Marxist)"
publisher: "Communist Party of India (Marxist)"
source_pdf_url: "https://cpim.org/wp-content/uploads/2026/07/20260725_Assembly-Election-Review-Adopted.pdf"
source_post_url: "https://cpim.org/review-of-assembly-election-results-july-2026/"
page_count: 14
extraction_method: "hybrid-vlm" # or "pymupdf4llm", "html-archive", "nemotron-ultra"
sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
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

## 5. Static Web Application Architecture

- **Framework**: SvelteKit 2 with `@sveltejs/adapter-static` (`prerender = true`).
- **Reactivity Model**: Pure **Svelte 5 Runes** (`$props()`, `$state()`, `$derived()`, `$effect()`).
- **Markdown Pipeline**: `mdsvex` configured with `rehype-slug` and `rehype-autolink-headings` ensuring all `h2` and `h3` receive deterministic anchor IDs for deep-linking and citation.
- **Dynamic Entry Prerendering**: `src/routes/docs/[slug]/+page.ts` exports `entries()` reading `import.meta.glob('/src/content/documents/*.md')` to prerender every document statically at build time.
- **Search Engine**: **Pagefind** runs post-build (`npx pagefind --site build`):
  - Document body wrapped in `data-pagefind-body`.
  - Metadata facets (`category`, `date`) tagged via `data-pagefind-filter="category"`.
  - WASM search executes entirely in the user's browser with zero backend requirements.
- **Design System Integration**: Strict implementation of [DESIGN_SYSTEM.md](file:///Volumes/Rahuls%20T7/code/cpim-reader/DESIGN_SYSTEM.md):
  - Soviet Constructivist shell (sharp 90° angles, 3px solid black borders, `#C41E3A` red accents, hard drop-shadows).
  - Elegant editorial reading canvas (`Newsreader` serif, `max-width: 68ch`, comfortable line height).
  - Sticky Table of Contents and split-screen original PDF verification pane.