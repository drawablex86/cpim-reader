# Agent Instructions (`AGENTS.md`)

## Project Objective
Build a static, offline-capable, richly navigable web archive of official documents published at `https://cpim.org/documents/`. The system consists of two decoupled halves:
1. **Local Python Sync & Extraction Pipeline (`scripts/`)**: Scrapes the catalog pages on `cpim.org/documents/` (273+ documents dating back to 2008), tracks processed URLs in `data/manifest.json`, downloads new PDFs or extracts official HTML articles, and converts them to clean Markdown with YAML frontmatter using a multi-tier pipeline:
   - Fast Tier: `pymupdf4llm` for instant born-digital PDFs.
   - Local Inference: Ollama `qwen2.5vl:3b` / `glm-ocr` (Vision) and `qwen2.5:7b` (Text Structuring) tuned for M1 MacBook Air (16GB RAM).
   - Cloud Free Fallback: OpenRouter Free tier with `nvidia/nemotron-3-ultra-550b-a55b:free` / `nvidia/nemotron-3.5-super-vl:free`.
2. **SvelteKit Static Webapp (`src/`)**: Renders `src/content/documents/*.md` into a fast static site using `@sveltejs/adapter-static`, built upon a **Soviet Constructivist exterior shell** (sharp 90° geometry, 3px solid black borders, `#C41E3A` red accents, newsprint background, tactile stamps) and an **elegant modern editorial reading area** (`Newsreader` serif, 68ch measure, sticky Table of Contents, split-screen original PDF verification, one-click academic citations, and client-side full-text search via Pagefind).

## Operational Rules for Coding Agents
1. **Strict Separation of Concerns**: Never run Python scraping or PDF parsing at SvelteKit build time. SvelteKit (`npm run build`) must only read static `.md` files already committed in `src/content/documents/` and `data/manifest.json`.
2. **Scaffolding-First Execution**: Develop and verify the SvelteKit frontend, design system, search, and reading environment using real sample documents committed in `src/content/documents/` before running mass local model extractions.
3. **Idempotent Incremental Sync**: `scripts/sync.py` must check `data/manifest.json` before downloading any PDF or scraping any HTML article. Never re-process a URL whose status is `"completed"` unless `--force` is passed.
4. **Dual Ingestion Awareness**:
   - For PDF documents: download to `.cache/pdfs/`, calculate SHA256, extract via `pymupdf4llm` / VLM.
   - For HTML articles on `cpim.org` without PDFs: extract `<div class="articleText">`, strip social share buttons (Heateor) and newsletter widgets, and generate clean Markdown with `extraction_method: "html-archive"`.
5. **Hardware & Thermal Awareness (M1 Air 16GB)**:
   - When running local Ollama, enforce `concurrency = 1`.
   - Cap rasterized PDF page images at `max_dim = 1024px` (for Qwen2.5-VL) or `768px` (for GLM-OCR).
   - Pass `keep_alive: "5m"` so unified memory is promptly released.
   - Support `OPENROUTER_API_KEY` for zero-compute cloud fallback using NVIDIA Nemotron models.
6. **Svelte 5 Runes Syntax**: Write all Svelte components strictly using Svelte 5 runes (`$props()`, `$state()`, `$derived()`, `$effect()`). Do not use legacy `export let` or `$:` reactive statements.
7. **Design System Fidelity**: Strictly adhere to tokens in `DESIGN_SYSTEM.md`. Maintain the dual aesthetic: Constructivist shell vs. scholarly editorial reading canvas.
8. **Archival Fidelity**:
   - Every Markdown file must preserve `source_pdf_url` (and/or `source_post_url`) in its YAML frontmatter.
   - Never hallucinate, summarize, or alter political resolutions; models must transcribe verbatim.
   - Strip recurring publisher letterhead noise (e.g., A.K. Gopalan Bhawan address headers, phone numbers, standalone page numbers) without altering document text.

## Standard Commands
- **Setup Python env**: `python3 -m venv .venv && source .venv/bin/activate && pip install -r scripts/requirements.txt`
- **Pull local models (Ollama)**: `ollama pull qwen2.5vl:3b && ollama pull qwen2.5:7b`
- **Run incremental sync with local Ollama**: `python scripts/sync.py --limit 3`
- **Run sync with OpenRouter Nemotron fallback**: `OPENROUTER_API_KEY="sk-or-..." python scripts/sync.py --provider openrouter --limit 3`
- **Install web deps**: `npm install`
- **Run dev server**: `npm run dev`
- **Build static site + Pagefind index**: `npm run build`