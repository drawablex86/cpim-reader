# Implementation Tasklist (`TASKLIST.md`)

## Phase 1: Specifications, Design System & Real Document Scaffolding
- [x] **1.1** Audit repository logic and assertions against live `https://cpim.org/documents/` (identified 273 documents back to 2008 and dual PDF+HTML source format).
- [x] **1.2** Research and select state-of-the-art models for document extraction:
  - Local: `qwen2.5vl:3b` (Vision) + `qwen2.5:7b` (Text) via Ollama.
  - Cloud Free Fallback: `nvidia/nemotron-3-ultra-550b-a55b:free` + `nvidia/nemotron-3.5-super-vl:free` via OpenRouter.
- [x] **1.3** Author comprehensive `DESIGN_SYSTEM.md` defining Soviet Constructivist shell tokens and elegant modern editorial reader tokens.
- [x] **1.4** Update `ARCHITECTURE.md`, `LLM_SPEC.md`, and `AGENTS.md` to reflect dual-mode ingestion, multi-tier model specs, and Svelte 5 runes requirements.
- [x] **1.5** Extract real content from 3 latest official CPI(M) documents into `src/content/documents/`:
  - `2026-07-27-review-of-assembly-election-results-july-2026.md`
  - `2026-07-20-the-annihilation-of-caste-a-marxist-perspective.md`
  - `2026-07-20-perspective-action-agenda-on-health-issues.md`
- [x] **1.6** Populate `data/manifest.json` with the real documents and initial metadata.

## Phase 2: SvelteKit Static Webapp Foundation & Constructivist Shell
- [x] **2.1** Install npm dependencies (`npm install`).
- [x] **2.2** Create `src/app.html` with Google Fonts (`Space Grotesk`, `Newsreader`, `JetBrains Mono`) and CSS variables.
- [x] **2.3** Create `src/routes/+layout.svelte` with Constructivist masthead, revolutionary red accent banner, live catalog counter, and navigation.
- [x] **2.4** Create `src/lib/documents.ts` with type-safe metadata extraction, heading parser, and sorting utilities.
- [x] **2.5** Create `src/routes/+page.svelte` (Archive Research Explorer):
  - High-impact Constructivist hero banner.
  - Category filter tabs (`All`, `CC Documents`, `Party Congress`, `Issues`, `Left View`).
  - Real-time client-side search input and year breakdown.
  - Dual view toggle (Constructivist Card Grid vs. Archival Data Table).

## Phase 3: Scholarly Document Reader, Citations & PDF Verification
- [x] **3.1** Create `src/routes/docs/[slug]/+page.ts` static prerendering loader with `entries()` function.
- [x] **3.2** Update `src/routes/docs/[slug]/+page.svelte` with:
  - Distraction-free scholarly reading canvas in `Newsreader` serif (`max-width: 68ch`, line-height 1.78).
  - Sticky Table of Contents sidebar with active section tracking via `IntersectionObserver`.
  - Section deep linking with copyable anchor links.
  - "Verify with Original PDF (Split View)" side-by-side iframe toggle.
- [x] **3.3** Update `src/lib/components/CitationModal.svelte` with Constructivist styling, tabs for APA, MLA, Chicago, BibTeX, tactile copy feedback, and `.bib` file download.

## Phase 4: Static Search (Pagefind) & Production Build Verification
- [x] **4.1** Run production build (`npm run build`).
- [x] **4.2** Verify Pagefind indexes pre-rendered documents (`npx pagefind --site build`).
- [x] **4.3** Test static site build to verify client-side navigation, search indexing, and citation exports.

## Phase 5: Dual-Mode Ingestion Pipeline & Full Archive Extraction
- [x] **5.1** Update `scripts/sync.py` to support dual-mode extraction (PDF + HTML posts) and multi-provider options (`--provider ollama`, `--provider openrouter`).
- [x] **5.2** Verify local Ollama model execution (`qwen2.5vl:3b` and `qwen2.5:7b`).
- [x] **5.3** Test OpenRouter Nemotron fallback execution (`--provider openrouter`).
- [x] **5.4** Complete 100% canonical English archive ingestion across 235+ historical documents dating back to 2004.
- [x] **5.5** Filter out corrupted non-Unicode mojibake regional reprints, designating canonical English versions as single source of truth.

## Phase 6: Dense Semantic Search & Vector Embeddings
- [x] **6.1** Author `scripts/embed.py` generating 256-dimensional embeddings with Google EmbeddingGemma 2 (`static/vectors.json`).
- [x] **6.2** Build client-side semantic search engine (`src/lib/semantic-search.ts`) using `@huggingface/transformers` ONNX/WASM.
- [x] **6.3** Integrate unified search UX with mode switching (`all`, `titles`, `semantic`) and `SemanticResultsPanel.svelte`.
- [x] **6.4** Create `SimilarDocuments.svelte` recommending topically related historical documents based on vector cosine similarity.

## Phase 7: Archival Taxonomy & Tag Fortification
- [x] **7.1** Define controlled taxonomy types in `src/lib/taxonomy.ts` (`doc_type`, `topics`, `geography`, `congress`).
- [x] **7.2** Create deterministic classification engine `scripts/classify_documents.py`.
- [x] **7.3** Author vector centroid tag fortification engine `scripts/fortify_tags.py` to tag cross-cutting themes in omnibus resolutions.
- [x] **7.4** Integrate faceted filter selectors into archive explorer (`+page.svelte`).

## Phase 8: Multilingual Translation Subsystem & Bilingual Reader
- [x] **8.1** Setup IndicTrans2 CTranslate2 INT8 model support and single-document CLI (`scripts/translate_single.py`).
- [x] **8.2** Build bilingual split-screen reader in `src/routes/docs/[slug]/+page.svelte` with synchronized proportional scrolling.
- [x] **8.3** Implement `LanguageSelector.svelte` and OpenRouter Gemma 31B cloud translation fallback.

## Phase 9: In-Browser Dev Pipeline Terminal & Documentation Sync
- [x] **9.1** Implement streaming RPC dev middleware plugins in `vite.config.ts` (`/api/dev/sync`, `/api/dev/embed`, `/api/dev/translate`, `/api/dev/models`, `/api/dev/translation-catalog`).
- [x] **9.2** Build tactile Constructivist `DevPipelineModal.svelte` with real-time log streaming and heartbeat status banner.
- [x] **9.3** Author comprehensive production `README.md` with CLI reference, architecture diagram, and feature showcase.
- [x] **9.4** Update `ARCHITECTURE.md` to reflect all search, taxonomy, translation, and dev pipeline systems.