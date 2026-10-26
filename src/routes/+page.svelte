<script lang="ts">
  import { onMount } from 'svelte';
  import CitationModal from '$lib/components/CitationModal.svelte';
  import SemanticResultsPanel from '$lib/components/SemanticResultsPanel.svelte';
  import type { DocumentMeta } from '$lib/documents';
  import { DOC_TYPES, TOPICS, GEOGRAPHY, getDocTypeLabel, getTopicLabel } from '$lib/taxonomy';
  import { documentUrl } from '$lib/site';
  import {
    semanticSearch,
    loadEmbeddingModel,
    onModelProgress,
    type SearchResult
  } from '$lib/semantic-search';

  let { data } = $props();

  let selectedCategory = $state('All');
  let selectedDocType = $state('all');
  let selectedTopic = $state('all');
  let searchQuery = $state('');
  let searchMode = $state<'all' | 'titles' | 'semantic'>('all');
  let viewMode = $state<'cards' | 'table'>('cards');
  let activeCiteDoc = $state<DocumentMeta | null>(null);

  // Pagefind WASM state
  let pagefindModule: any = $state(null);
  let isWasmLoading = $state(false);
  let isWasmSearching = $state(false);
  let wasmError = $state<string | null>(null);
  let pagefindMatches = $state<Map<string, { excerpt: string; score: number }>>(new Map());

  // EmbeddingGemma 2 Semantic Search state
  let semanticResults = $state<SearchResult[]>([]);
  let isSemanticSearching = $state(false);
  let semanticProgress = $state(0);
  let semanticStatus = $state<'idle' | 'initializing' | 'downloading' | 'ready' | 'error'>('idle');
  let semanticModelError = $state<string | null>(null);

  const categories = ['All', 'CC Documents', 'Party Congress', 'Issues', 'Left View'];

  // Initialize Pagefind dynamically in the browser
  onMount(() => {
    async function loadPagefind() {
      if (typeof window === 'undefined') return;
      isWasmLoading = true;
      try {
        // Pagefind is served from static/pagefind in dev or build/pagefind in prod
        // Using new Function prevents Vite/Rollup from attempting compile-time module resolution
        const importPagefind = new Function('path', 'return import(path)');
        const pf = await importPagefind('/pagefind/pagefind.js');
        await pf.init();
        pagefindModule = pf;
        isWasmLoading = false;
      } catch (err: any) {
        console.warn('Pagefind WASM initialization notice (in-memory search active):', err?.message);
        wasmError = err?.message || 'WASM unavailable';
        isWasmLoading = false;
      }
    }

    loadPagefind();
  });

  // Debounced search effect
  let debounceTimer: any;
  $effect(() => {
    const q = searchQuery.trim();
    if (!q || searchMode === 'titles' || !pagefindModule) {
      pagefindMatches = new Map();
      isWasmSearching = false;
      return;
    }

    clearTimeout(debounceTimer);
    isWasmSearching = true;

    debounceTimer = setTimeout(async () => {
      try {
        const searchRes = await pagefindModule.search(q);
        const matches = new Map<string, { excerpt: string; score: number }>();

        if (searchRes && searchRes.results) {
          // Load fragment data for top 30 matches
          const topResults = searchRes.results.slice(0, 30);
          for (const res of topResults) {
            const docData = await res.data();
            // Extract slug from URL: e.g. /docs/2026-07-27-review-of-assembly-election-results-july-2026.html
            const match = docData.url.match(/docs\/([^/?#]+)(?:\.html)?/);
            const slug = match ? match[1].replace(/\.html$/, '') : null;
            if (slug) {
              matches.set(slug, {
                excerpt: docData.excerpt || '',
                score: res.score
              });
            }
          }
        }
        pagefindMatches = matches;
      } catch (err) {
        console.error('Pagefind search failed:', err);
      } finally {
        isWasmSearching = false;
      }
    }, 200);

    return () => clearTimeout(debounceTimer);
  });

  async function activateSemanticMode() {
    searchMode = 'semantic';
    semanticModelError = null;

    if (semanticStatus === 'idle') {
      onModelProgress((p, s) => {
        semanticProgress = p;
        semanticStatus = s as any;
      });
      try {
        await loadEmbeddingModel();
      } catch (err: any) {
        console.error('Embedding model initialization warning:', err);
        semanticModelError = err?.message || 'Failed to initialize local model';
      }
    }
  }

  // Debounced EmbeddingGemma-2 semantic search effect
  let semanticTimer: any;
  $effect(() => {
    const q = searchQuery.trim();
    if (searchMode !== 'semantic' || !q) {
      semanticResults = [];
      isSemanticSearching = false;
      return;
    }

    clearTimeout(semanticTimer);
    isSemanticSearching = true;

    semanticTimer = setTimeout(async () => {
      try {
        semanticResults = await semanticSearch(q, 15);
      } catch (err: any) {
        console.error('Semantic search error:', err);
        semanticModelError = err?.message || 'Search execution error';
      } finally {
        isSemanticSearching = false;
      }
    }, 350);

    return () => clearTimeout(semanticTimer);
  });

  // Available document types with counts based on current category
  const docTypeCounts = $derived.by(() => {
    const counts: Record<string, number> = {};
    for (const doc of data.documents as DocumentMeta[]) {
      if (selectedCategory !== 'All' && doc.category.toLowerCase() !== selectedCategory.toLowerCase()) continue;
      const t = doc.doc_type || 'report';
      counts[t] = (counts[t] || 0) + 1;
    }
    return counts;
  });

  // Available topics with counts based on current category and doc_type
  const topicCounts = $derived.by(() => {
    const counts: Record<string, number> = {};
    for (const doc of data.documents as DocumentMeta[]) {
      if (selectedCategory !== 'All' && doc.category.toLowerCase() !== selectedCategory.toLowerCase()) continue;
      if (selectedDocType !== 'all' && doc.doc_type !== selectedDocType) continue;
      if (doc.topics && Array.isArray(doc.topics)) {
        for (const top of doc.topics) {
          counts[top] = (counts[top] || 0) + 1;
        }
      }
    }
    return counts;
  });

  // Filter and sort documents based on metadata + Pagefind WASM results
  const filteredDocs = $derived.by(() => {
    const q = searchQuery.toLowerCase().trim();

    return (data.documents as DocumentMeta[])
      .filter((doc: DocumentMeta) => {
        const matchesCategory =
          selectedCategory === 'All' || doc.category.toLowerCase() === selectedCategory.toLowerCase();
        if (!matchesCategory) return false;

        const matchesDocType =
          selectedDocType === 'all' || doc.doc_type === selectedDocType;
        if (!matchesDocType) return false;

        const matchesTopic =
          selectedTopic === 'all' || (doc.topics && doc.topics.includes(selectedTopic));
        if (!matchesTopic) return false;

        if (!q) return true;

        const matchesMeta =
          doc.title.toLowerCase().includes(q) ||
          (doc.author && doc.author.toLowerCase().includes(q)) ||
          doc.date.includes(q);

        const matchesWasm = pagefindMatches.has(doc.slug);

        return searchMode === 'titles' ? matchesMeta : matchesMeta || matchesWasm;
      })
      .sort((a: DocumentMeta, b: DocumentMeta) => {
        if (!q || searchMode === 'titles') return 0;
        const scoreA = pagefindMatches.get(a.slug)?.score || 0;
        const scoreB = pagefindMatches.get(b.slug)?.score || 0;
        return scoreB - scoreA;
      });
  });

  function openCite(doc: DocumentMeta) {
    activeCiteDoc = doc;
  }

  function closeCite() {
    activeCiteDoc = null;
  }

  // Every active constraint, surfaced as a removable chip so the user can see
  // *why* a result set is narrow.
  const activeFilters = $derived.by(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];

    if (selectedCategory !== 'All') {
      chips.push({
        key: 'category',
        label: selectedCategory.toUpperCase(),
        clear: () => (selectedCategory = 'All')
      });
    }
    if (selectedDocType !== 'all') {
      chips.push({
        key: 'docType',
        label: getDocTypeLabel(selectedDocType).toUpperCase(),
        clear: () => (selectedDocType = 'all')
      });
    }
    if (selectedTopic !== 'all') {
      chips.push({
        key: 'topic',
        label: `#${getTopicLabel(selectedTopic)}`,
        clear: () => (selectedTopic = 'all')
      });
    }
    if (searchQuery.trim()) {
      chips.push({
        key: 'query',
        label: `"${searchQuery.trim()}"`,
        clear: () => (searchQuery = '')
      });
    }

    return chips;
  });

  function resetAllFilters() {
    selectedCategory = 'All';
    selectedDocType = 'all';
    selectedTopic = 'all';
    searchQuery = '';
  }
</script>

<svelte:head>
  <title>CPI(M) Documents Archive // Research Catalog</title>
</svelte:head>

<div class="archive-explorer">
  <!-- Constructivist Hero Banner -->
  <section class="hero-banner">
    <div class="hero-inner">
      <div class="hero-stamp">OFFICIAL HISTORICAL RECORDS • 2008 – 2026</div>
      <h1 class="hero-title">CPI(M) DOCUMENT ARCHIVE</h1>
      <p class="hero-deck">
        An open research repository preserving unabridged Central Committee resolutions,
        Party Congress declarations, and ideological publications issued by the Communist Party of India (Marxist).
      </p>

      <div class="hero-stats-strip">
        <div class="stat-pill">
          <span class="stat-num">{data.documents.length}</span>
          <span class="stat-txt">DOCUMENTS PRESERVED</span>
        </div>
        <div class="stat-pill">
          <span class="stat-num">2008 – 2026</span>
          <span class="stat-txt">HISTORICAL TIMELINE</span>
        </div>
        <div class="stat-pill accent">
          <span class="stat-num">FULL TEXT</span>
          <span class="stat-txt">INSTANT ARCHIVE SEARCH</span>
        </div>
        <div class="stat-pill">
          <span class="stat-num">VERIFIED</span>
          <span class="stat-txt">ORIGINAL PRESS RECORDS</span>
        </div>
      </div>
    </div>
  </section>

  <!-- Filter & Controls Toolbar -->
  <section class="controls-toolbar">
    <div class="toolbar-inner">
      <!-- Category Tabs & Language Toggle -->
      <div class="category-tabs" role="group" aria-label="Document Category Filter">
        {#each categories as cat}
          <button
            type="button"
            aria-pressed={selectedCategory === cat}
            class="cat-tab"
            class:active={selectedCategory === cat}
            onclick={() => (selectedCategory = cat)}
          >
            {cat.toUpperCase()}
          </button>
        {/each}
      </div>

      <!-- Search Field & View Switcher -->
      <div class="search-and-views">
        <div class="search-box">
          <span class="search-icon" aria-hidden="true">{searchMode === 'semantic' ? '⬡' : '⌕'}</span>
          <input
            type="search"
            bind:value={searchQuery}
            placeholder={searchMode === 'semantic' ? "Search by concept: e.g. agrarian crisis, secularism, labour rights..." : searchMode === 'all' ? "Search across titles, resolutions & full document text..." : "Search by title, author, or year..."}
            class="search-input"
            aria-label="Search documents"
          />
          {#if isWasmSearching || isSemanticSearching}
            <span class="search-spinner" title="Searching index...">●</span>
          {/if}
          {#if searchQuery}
            <button
              type="button"
              class="clear-btn"
              onclick={() => (searchQuery = '')}
              aria-label="Clear search"
            >
              ✕
            </button>
          {/if}

          <!-- Integrated Search Scope Toggle (Inside Unified Search Box) -->
          <div class="search-mode-pill" role="group" aria-label="Search scope">
            <button
              type="button"
              class="mode-toggle-btn"
              class:active={searchMode === 'all'}
              aria-pressed={searchMode === 'all'}
              onclick={() => (searchMode = 'all')}
              title="Search entire unabridged document text"
            >
              ★ FULL TEXT
            </button>
            <button
              type="button"
              class="mode-toggle-btn"
              class:active={searchMode === 'titles'}
              aria-pressed={searchMode === 'titles'}
              onclick={() => (searchMode = 'titles')}
              title="Filter by document titles, authors, and dates"
            >
              TITLES & DATES
            </button>
            <button
              type="button"
              class="mode-toggle-btn semantic-toggle"
              class:active={searchMode === 'semantic'}
              aria-pressed={searchMode === 'semantic'}
              onclick={activateSemanticMode}
              title="Semantic topic search: find documents by concept and meaning"
            >
              ⬡ TOPIC CONCEPTS
            </button>
          </div>
        </div>

        <div class="view-toggles" role="group" aria-label="Catalog Layout View">
          <button
            type="button"
            class="view-btn"
            class:active={viewMode === 'cards'}
            onclick={() => (viewMode = 'cards')}
            title="Card Grid View"
          >
            CARDS
          </button>
          <button
            type="button"
            class="view-btn"
            class:active={viewMode === 'table'}
            onclick={() => (viewMode = 'table')}
            title="Archival Ledger Table View"
          >
            TABLE
          </button>
        </div>
      </div>
    </div>

    <!-- Faceted Discovery Strip (Document Types & Topic Badges) -->
    <div class="facet-strip-container">
      <!-- Doc Types Row -->
      <div class="facet-row">
        <span class="facet-label">FORMAT:</span>
        <div class="facet-scroll">
          <button
            type="button"
            class="facet-chip"
            class:active={selectedDocType === 'all'}
            aria-pressed={selectedDocType === 'all'}
            onclick={() => (selectedDocType = 'all')}
          >
            ALL FORMATS ({data.documents.length})
          </button>
          {#each Object.entries(DOC_TYPES) as [typeKey, typeObj]}
            {#if (docTypeCounts[typeKey] || 0) > 0}
              <button
                type="button"
                class="facet-chip"
                class:active={selectedDocType === typeKey}
                aria-pressed={selectedDocType === typeKey}
                onclick={() => (selectedDocType = selectedDocType === typeKey ? 'all' : typeKey)}
              >
                {typeObj.label.toUpperCase()} <span class="chip-count">({docTypeCounts[typeKey] || 0})</span>
              </button>
            {/if}
          {/each}
        </div>
      </div>

      <!-- Topics Row -->
      <div class="facet-row">
        <span class="facet-label">TOPIC:</span>
        <div class="facet-scroll">
          <button
            type="button"
            class="facet-chip topic-chip"
            class:active={selectedTopic === 'all'}
            aria-pressed={selectedTopic === 'all'}
            onclick={() => (selectedTopic = 'all')}
          >
            ALL TOPICS
          </button>
          {#each Object.entries(TOPICS) as [topicKey, topicObj]}
            {#if (topicCounts[topicKey] || 0) > 0}
              <button
                type="button"
                class="facet-chip topic-chip"
                class:active={selectedTopic === topicKey}
                aria-pressed={selectedTopic === topicKey}
                onclick={() => (selectedTopic = selectedTopic === topicKey ? 'all' : topicKey)}
              >
                #{topicObj.label} <span class="chip-count">({topicCounts[topicKey] || 0})</span>
              </button>
            {/if}
          {/each}
        </div>
      </div>
    </div>
  </section>

  <!-- Model Loading Banner (Semantic Search Initialization) -->
  {#if searchMode === 'semantic' && (semanticStatus === 'downloading' || semanticStatus === 'initializing')}
    <div class="model-loading-strip">
      <div class="loading-info">
        <span class="loading-stamp">⬡ TOPIC SEARCH ENGINE // PREPARING IN-BROWSER MODEL</span>
        <span class="loading-pct">{semanticProgress}%</span>
      </div>
      <div class="loading-track">
        <div class="loading-fill" style={`width: ${Math.max(6, semanticProgress)}%`}></div>
      </div>
      <div class="loading-hint">Initializing topic similarity model. Runs locally in your browser for private, offline search.</div>
    </div>
  {/if}

  <!-- Results Count Strip -->
  <div class="results-meta-bar">
    <div class="results-inner">
      <div class="results-left">
        <span class="results-count" aria-live="polite">
          {#if searchMode === 'semantic' && searchQuery.trim()}
            CONCEPT MATCHES // <strong>{semanticResults.length}</strong> DOCUMENTS
          {:else}
            SHOWING <strong>{filteredDocs.length}</strong> OF <strong>{data.documents.length}</strong> DOCUMENTS
          {/if}
        </span>
        {#if searchQuery && searchMode === 'all'}
          <span class="wasm-status-badge">
            {#if isWasmSearching}
              SEARCHING COMPLETE TEXT...
            {:else if pagefindMatches.size > 0}
              ⚡ {pagefindMatches.size} FULL-TEXT MATCH{pagefindMatches.size === 1 ? '' : 'ES'}
            {:else if pagefindModule}
              FULL-TEXT READY
            {:else if wasmError}
              TITLES ONLY
            {/if}
          </span>
        {:else if searchMode === 'semantic'}
          <span class="wasm-status-badge semantic-badge">
            {#if isSemanticSearching}
              FINDING RELATED RESOLUTIONS...
            {:else if semanticStatus === 'ready'}
              CONCEPT ENGINE READY
            {:else if semanticModelError}
              INITIALIZING...
            {/if}
          </span>
        {/if}
      </div>

      {#if activeFilters.length > 0}
        <div class="active-filters" aria-label="Active filters">
          {#each activeFilters as filter (filter.key)}
            <button
              type="button"
              class="active-filter-chip"
              onclick={filter.clear}
              aria-label={`Remove filter: ${filter.label}`}
              title={`Remove filter: ${filter.label}`}
            >
              <span class="chip-text">{filter.label}</span>
              <span class="chip-x" aria-hidden="true">✕</span>
            </button>
          {/each}
          <button type="button" class="reset-filters" onclick={resetAllFilters}>
            RESET ALL
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- Document Explorer Results -->
  <div class="catalog-viewport">
    {#if searchMode === 'semantic'}
      <SemanticResultsPanel
        results={semanticResults}
        query={searchQuery}
        loading={isSemanticSearching}
        oncite={openCite}
      />
    {/if}
    {#if filteredDocs.length === 0}
      <div class="empty-state">
        <div class="empty-box">
          <h3>NO DOCUMENTS FOUND</h3>
          <p>No resolutions match category <strong>{selectedCategory}</strong> and query "<em>{searchQuery}</em>".</p>
          <button type="button" class="btn-reset" onclick={resetAllFilters}>
            SHOW ALL DOCUMENTS
          </button>
        </div>
      </div>
    {:else if viewMode === 'cards'}
      <!-- Card Grid View -->
      <div class="card-grid">
        {#each filteredDocs as doc}
          <article class="doc-card">
            <div class="card-top-rule"></div>
            <div class="card-header">
              <div class="card-header-left">
                <span class="card-category">{doc.category}</span>
                {#if doc.doc_type}
                  <span class="card-type-stamp">{getDocTypeLabel(doc.doc_type)}</span>
                {/if}
              </div>
              <time class="card-date" datetime={doc.date}>{doc.date}</time>
            </div>

            <h2 class="card-title">
              <a href={`/docs/${doc.slug}`}>{doc.title}</a>
            </h2>

            {#if doc.topics && doc.topics.length > 0}
              <div class="card-topics">
                {#each doc.topics.slice(0, 3) as t}
                  <button
                    type="button"
                    class="topic-tag"
                    onclick={(e) => {
                      e.preventDefault();
                      selectedTopic = t;
                    }}
                    title={`Filter by topic: ${getTopicLabel(t)}`}
                  >
                    #{getTopicLabel(t)}
                  </button>
                {/each}
                {#if doc.topics.length > 3}
                  <span class="topic-tag-more" title={doc.topics.slice(3).map((t) => getTopicLabel(t)).join(', ')}>
                    +{doc.topics.length - 3} more
                  </span>
                {/if}
              </div>
            {/if}

            {#if doc.author}
              <div class="card-author">
                <span class="author-label">ISSUANCE:</span> {doc.author}
              </div>
            {/if}

            <!-- Search Match Excerpt Display (if term was matched in resolution body) -->
            {#if searchQuery && pagefindMatches.has(doc.slug)}
              <div class="search-excerpt">
                <div class="excerpt-badge">MATCH IN DOCUMENT TEXT:</div>
                <div class="excerpt-text">{@html pagefindMatches.get(doc.slug)?.excerpt}</div>
              </div>
            {/if}

            <div class="card-footer">
              <div class="card-meta-info">
                {#if doc.page_count}
                  <span class="doc-page-count">{doc.page_count} PAGES</span>
                {:else}
                  <span class="doc-page-count">OFFICIAL RECORD</span>
                {/if}
              </div>

              <div class="card-actions">
                <button
                  type="button"
                  class="action-btn cite-btn"
                  onclick={() => openCite(doc)}
                  aria-label={`Cite ${doc.title}`}
                >
                  CITE
                </button>
                <a href={`/docs/${doc.slug}`} class="action-btn read-btn">
                  READ ➔
                </a>
              </div>
            </div>
          </article>
        {/each}
      </div>
    {:else}
      <!-- Archival Ledger Table View -->
      <div class="table-container">
        <table class="archival-table">
          <thead>
            <tr>
              <th scope="col" style="width: 130px;">DATE</th>
              <th scope="col" style="width: 150px;">CATEGORY</th>
              <th scope="col">OFFICIAL TITLE & AUTHOR</th>
              <th scope="col" style="width: 90px;">PAGES</th>
              <th scope="col" style="width: 180px;">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredDocs as doc}
              <tr>
                <td class="mono-cell">{doc.date}</td>
                <td>
                  <span class="category-stamp">{doc.category}</span>
                  {#if doc.doc_type}
                    <span class="category-stamp type-stamp">{getDocTypeLabel(doc.doc_type)}</span>
                  {/if}
                </td>
                <td>
                  <a href={`/docs/${doc.slug}`} class="table-title-link">
                    {doc.title}
                  </a>
                  {#if doc.topics && doc.topics.length > 0}
                    <div class="table-topics">
                      {#each doc.topics as t}
                        <span class="table-topic-pill">#{getTopicLabel(t)}</span>
                      {/each}
                    </div>
                  {/if}
                  {#if doc.author}
                    <div class="table-author">{doc.author}</div>
                  {/if}
                  {#if searchQuery && pagefindMatches.has(doc.slug)}
                    <div class="table-excerpt">
                      {@html pagefindMatches.get(doc.slug)?.excerpt}
                    </div>
                  {/if}
                </td>
                <td class="mono-cell">{doc.page_count || '—'}</td>
                <td class="actions-cell">
                  <a href={`/docs/${doc.slug}`} class="table-btn read">READ</a>
                  <button type="button" class="table-btn cite" onclick={() => openCite(doc)}>CITE</button>
                  {#if doc.source_pdf_url}
                    <a
                      href={doc.source_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="table-btn pdf"
                      title="Direct PDF Link"
                    >
                      PDF
                    </a>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

  <!-- Citation Modal Triggered Globally -->
  {#if activeCiteDoc}
    <CitationModal
      doc={activeCiteDoc}
      currentUrl={documentUrl(activeCiteDoc.slug)}
      onclose={closeCite}
    />
  {/if}
</div>

<style>
  .archive-explorer {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 1.5rem 3rem;
  }

  /* Hero Banner */
  .hero-banner {
    background-color: var(--color-black);
    color: var(--color-paper-light);
    border: var(--border-heavy);
    margin: 2rem 0;
    padding: 2.5rem 2rem 2rem;
    position: relative;
    box-shadow: var(--shadow-hard-md);
  }

  .hero-stamp {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--color-gold);
    letter-spacing: 0.1em;
    margin-bottom: 0.75rem;
  }

  .hero-title {
    font-size: clamp(2rem, 5vw, 3.25rem);
    font-weight: 700;
    letter-spacing: 0.05em;
    line-height: 1.1;
    color: #FFFFFF;
    margin: 0 0 1rem;
  }

  .hero-deck {
    font-size: 1.1rem;
    line-height: 1.6;
    color: #D5D5D5;
    max-width: 800px;
    margin: 0 0 2rem;
  }

  .hero-stats-strip {
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
    border-top: 2px solid #333333;
    padding-top: 1.5rem;
  }

  .stat-pill {
    display: flex;
    flex-direction: column;
    padding: 0.5rem 1rem;
    background-color: #1E1E1E;
    border: 1px solid #444444;
  }

  .stat-pill.accent {
    background-color: var(--color-red-primary);
    border-color: var(--color-red-dark);
  }

  .stat-num {
    font-size: 1.5rem;
    font-weight: 700;
    color: #FFFFFF;
    font-family: var(--font-mono);
  }

  .stat-txt {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #CCCCCC;
  }

  /* Controls Toolbar */
  .controls-toolbar {
    background-color: var(--color-paper-dark);
    border: var(--border-heavy);
    padding: 1.25rem;
    margin-bottom: 1rem;
    box-shadow: var(--shadow-hard-sm);
  }

  .toolbar-inner {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .category-tabs {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .cat-tab {
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 0.5rem 1rem;
    border: 2px solid var(--color-black);
    background-color: var(--color-paper-light);
    color: var(--color-black);
    cursor: pointer;
    box-shadow: var(--shadow-hard-sm);
    transition: all 0.1s ease;
  }

  .cat-tab:hover {
    background-color: var(--color-red-primary);
    color: #FFFFFF;
    transform: translate(-1px, -1px);
    box-shadow: var(--shadow-hard-md);
  }

  .cat-tab.active {
    background-color: var(--color-black);
    color: #FFFFFF;
    border-color: var(--color-black);
    box-shadow: none;
    transform: translate(1px, 1px);
  }

  .lang-toggle-group {
    display: inline-flex;
    margin-left: auto;
    border: 2px solid var(--color-black);
    background-color: var(--color-paper-light);
    box-shadow: var(--shadow-hard-sm);
  }

  .lang-pill-btn {
    font-size: 0.75rem;
    font-weight: 700;
    font-family: var(--font-mono);
    padding: 0.45rem 0.75rem;
    background: transparent;
    border: none;
    border-right: 1px solid var(--color-black);
    color: var(--color-black);
    cursor: pointer;
    transition: all 0.1s ease;
  }

  .lang-pill-btn:last-child {
    border-right: none;
  }

  .lang-pill-btn:hover {
    background-color: var(--color-red-light);
    color: var(--color-red-primary);
  }

  .lang-pill-btn.active {
    background-color: var(--color-red-primary);
    color: #FFFFFF;
  }

  .badge-tag.lang-hi {
    background-color: var(--color-red-light);
    color: var(--color-red-primary);
    font-weight: 700;
    border-color: var(--color-red-primary);
  }

  .search-and-views {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .search-box {
    flex: 1;
    min-width: 320px;
    display: flex;
    align-items: center;
    background-color: #FFFFFF;
    border: 2px solid var(--color-black);
    box-shadow: var(--shadow-hard-sm);
    padding: 0 0.5rem 0 0.75rem;
    gap: 0.5rem;
  }

  .search-icon {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-gray-dark);
  }

  .search-input {
    flex: 1;
    min-width: 120px;
    border: none;
    outline: none;
    font-family: inherit;
    font-size: 0.95rem;
    padding: 0.65rem 0;
    background: transparent;
  }

  .search-spinner {
    font-size: 0.75rem;
    color: var(--color-red-primary);
    animation: pulse 0.8s infinite alternate;
  }

  @keyframes pulse {
    0% { opacity: 0.2; transform: scale(0.85); }
    100% { opacity: 1; transform: scale(1.15); }
  }

  .clear-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    font-weight: 700;
    color: var(--color-gray-dark);
    padding: 0.25rem 0.5rem;
  }

  /* Integrated Search Scope Toggle Pill */
  .search-mode-pill {
    display: inline-flex;
    background-color: var(--color-paper-dark);
    border: 1.5px solid var(--color-black);
    padding: 2px;
    gap: 2px;
  }

  .mode-toggle-btn {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 0.25rem 0.55rem;
    border: none;
    background: transparent;
    color: var(--color-gray-dark);
    cursor: pointer;
    transition: all 0.1s ease;
    white-space: nowrap;
  }

  .mode-toggle-btn.active {
    background-color: var(--color-black);
    color: #FFFFFF;
  }

  .mode-toggle-btn.semantic-toggle {
    color: var(--color-red-primary);
  }

  .mode-toggle-btn.semantic-toggle.active {
    background-color: var(--color-red-primary);
    color: #FFFFFF;
  }

  /* Model Loading Strip */
  .model-loading-strip {
    background-color: #FFFDF9;
    border: 2px solid var(--color-black);
    padding: 0.85rem 1.25rem;
    margin-bottom: 1.25rem;
    box-shadow: var(--shadow-hard-sm);
  }

  .loading-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 700;
    margin-bottom: 0.4rem;
  }

  .loading-stamp {
    color: var(--color-red-primary);
    letter-spacing: 0.05em;
  }

  .loading-pct {
    color: var(--color-black);
  }

  .loading-track {
    height: 8px;
    background-color: var(--color-paper-dark);
    border: 1.5px solid var(--color-black);
    overflow: hidden;
    margin-bottom: 0.35rem;
  }

  .loading-fill {
    height: 100%;
    background-color: var(--color-red-primary);
    transition: width 0.2s ease;
  }

  .loading-hint {
    font-size: 0.75rem;
    color: var(--color-gray-dark);
    font-family: var(--font-mono);
  }

  .wasm-status-badge.semantic-badge {
    background-color: #121212;
    color: var(--color-gold);
    border-color: var(--color-gold);
  }

  .view-toggles {
    display: flex;
  }

  .view-btn {
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 0.6rem 1rem;
    border: 2px solid var(--color-black);
    background-color: var(--color-paper-light);
    color: var(--color-black);
    cursor: pointer;
    box-shadow: var(--shadow-hard-sm);
  }

  .view-btn:first-child {
    border-right: none;
  }

  .view-btn.active {
    background-color: var(--color-black);
    color: #FFFFFF;
    box-shadow: none;
  }

  /* Results Meta Bar */
  .results-meta-bar {
    padding: 0.5rem 0.25rem;
    margin-bottom: 1.25rem;
    font-family: var(--font-mono);
    font-size: 0.8rem;
  }

  .results-inner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .results-left {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .wasm-status-badge {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 0.2rem 0.55rem;
    background-color: var(--color-red-primary);
    color: #FFFFFF;
    border: 1px solid var(--color-red-dark);
  }

  .reset-filters {
    background: transparent;
    border: none;
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--color-red-primary);
    cursor: pointer;
    text-decoration: underline;
  }

  /* Active filter summary */
  .active-filters {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .active-filter-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    max-width: 22rem;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 0.28rem 0.55rem;
    background-color: var(--color-black);
    color: #ffffff;
    border: 1px solid var(--color-black);
    cursor: pointer;
    transition: all 0.1s ease;
  }

  .active-filter-chip:hover,
  .active-filter-chip:focus-visible {
    background-color: var(--color-red-primary);
    border-color: var(--color-red-dark);
  }

  .chip-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chip-x {
    font-size: 0.7rem;
    opacity: 0.8;
  }

  /* Card Grid */
  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 1.75rem;
  }

  .doc-card {
    background-color: var(--color-paper-light);
    border: var(--border-heavy);
    box-shadow: var(--shadow-hard-md);
    display: flex;
    flex-direction: column;
    padding: 1.75rem;
    position: relative;
    transition: transform 0.12s ease, box-shadow 0.12s ease;
  }

  .doc-card:hover {
    transform: translate(-2px, -2px);
    box-shadow: var(--shadow-hard-lg);
  }

  .card-top-rule {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background-color: var(--color-red-primary);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.85rem;
    font-family: var(--font-mono);
  }

  .card-category {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    background-color: var(--color-black);
    color: #FFFFFF;
    padding: 0.2rem 0.5rem;
  }

  .card-date {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-gray-dark);
  }

  .card-title {
    font-size: 1.35rem;
    font-weight: 700;
    line-height: 1.35;
    margin: 0 0 0.85rem;
    flex: 1;
  }

  .card-title a {
    color: var(--color-black);
    text-decoration: none;
    transition: color 0.1s ease;
  }

  .card-title a:hover {
    color: var(--color-red-primary);
    text-decoration: underline;
  }

  .card-author {
    font-size: 0.82rem;
    color: var(--color-gray-dark);
    margin-bottom: 1.25rem;
    line-height: 1.45;
  }

  .author-label {
    font-weight: 700;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--color-black);
    letter-spacing: 0.04em;
  }

  /* Deep Full-Text Search Excerpt */
  .search-excerpt {
    margin: 0.25rem 0 1.25rem;
    padding: 0.75rem 0.9rem;
    background-color: var(--color-paper);
    border-left: 3px solid var(--color-red-primary);
    border-top: 1px solid var(--color-gray-light);
    border-right: 1px solid var(--color-gray-light);
    border-bottom: 1px solid var(--color-gray-light);
  }

  .excerpt-badge {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 700;
    color: var(--color-red-primary);
    letter-spacing: 0.06em;
    margin-bottom: 0.35rem;
  }

  .excerpt-text {
    font-family: var(--font-prose);
    font-size: 0.92rem;
    line-height: 1.5;
    color: var(--reader-ink);
    font-style: italic;
  }

  :global(.excerpt-text mark),
  :global(.table-excerpt mark) {
    background-color: var(--color-gold-muted);
    color: var(--color-black);
    font-weight: 700;
    padding: 0 0.25rem;
  }

  .table-excerpt {
    margin-top: 0.4rem;
    font-family: var(--font-prose);
    font-size: 0.85rem;
    font-style: italic;
    color: var(--reader-ink-secondary);
    padding: 0.3rem 0.6rem;
    background-color: var(--color-paper);
    border-left: 2px solid var(--color-red-primary);
  }

  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid var(--color-gray-light);
    padding-top: 1rem;
    margin-top: auto;
    gap: 0.75rem;
  }

  .card-meta-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .doc-page-count {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: var(--color-gray-dark);
    padding: 0.2rem 0.45rem;
    background-color: var(--color-paper);
    border: 1px solid var(--color-gray-light);
  }

  .card-actions {
    display: flex;
    gap: 0.5rem;
  }

  .action-btn {
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 0.45rem 0.85rem;
    border: 2px solid var(--color-black);
    cursor: pointer;
    box-shadow: var(--shadow-hard-sm);
    transition: all 0.1s ease;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .action-btn:hover {
    transform: translate(-1px, -1px);
    box-shadow: var(--shadow-hard-md);
  }

  .cite-btn {
    background-color: var(--color-paper);
    color: var(--color-black);
  }

  .cite-btn:hover {
    background-color: var(--color-black);
    color: #FFFFFF;
  }

  .read-btn {
    background-color: var(--color-red-primary);
    color: #FFFFFF;
  }

  .read-btn:hover {
    background-color: var(--color-red-dark);
  }

  /* Archival Ledger Table */
  .table-container {
    background-color: var(--color-paper-light);
    border: var(--border-heavy);
    box-shadow: var(--shadow-hard-md);
    overflow-x: auto;
  }

  .archival-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
  }

  .archival-table th {
    background-color: var(--color-black);
    color: #FFFFFF;
    font-family: var(--font-display);
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    padding: 0.75rem 1rem;
    border-right: 1px solid #333333;
  }

  .archival-table td {
    padding: 0.85rem 1rem;
    border-bottom: 1px solid var(--color-gray-light);
    border-right: 1px solid var(--color-gray-light);
    font-size: 0.95rem;
    vertical-align: middle;
  }

  .archival-table tr:hover td {
    background-color: rgba(196, 30, 58, 0.04);
  }

  .mono-cell {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    font-weight: 600;
  }

  .category-stamp {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 700;
    border: 1px solid var(--color-black);
    padding: 0.2rem 0.5rem;
    background-color: var(--color-paper);
    display: inline-block;
  }

  .table-title-link {
    font-weight: 700;
    color: var(--color-black);
  }

  .table-title-link:hover {
    color: var(--color-red-primary);
    text-decoration: underline;
  }

  .table-author {
    font-size: 0.8rem;
    color: var(--color-gray-dark);
    margin-top: 0.2rem;
  }

  .actions-cell {
    white-space: nowrap;
  }

  .table-btn {
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.3rem 0.55rem;
    border: 1.5px solid var(--color-black);
    margin-right: 0.35rem;
    cursor: pointer;
    box-shadow: 1px 1px 0px var(--color-black);
  }

  .table-btn.read {
    background-color: var(--color-red-primary);
    color: #FFFFFF;
  }

  .table-btn.cite {
    background-color: var(--color-paper);
    color: var(--color-black);
  }

  .table-btn.pdf {
    background-color: var(--color-black);
    color: #FFFFFF;
  }

  /* Empty State */
  .empty-state {
    padding: 4rem 1rem;
    text-align: center;
  }

  .empty-box {
    display: inline-block;
    background-color: var(--color-paper-light);
    border: var(--border-heavy);
    padding: 2.5rem 3rem;
    box-shadow: var(--shadow-hard-md);
  }

  .empty-box h3 {
    margin: 0 0 0.5rem;
    font-size: 1.5rem;
    color: var(--color-red-primary);
  }

  .btn-reset {
    margin-top: 1rem;
    font-size: 0.85rem;
    font-weight: 700;
    padding: 0.5rem 1rem;
    border: 2px solid var(--color-black);
    background-color: var(--color-black);
    color: #FFFFFF;
    cursor: pointer;
  }

  /* Faceted Discovery Strip Styles */
  .facet-strip-container {
    border-top: 2px solid var(--color-black);
    padding-top: 1rem;
    margin-top: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .facet-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    overflow-x: auto;
    padding-bottom: 2px;
  }

  .facet-label {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: var(--color-gray-dark);
    min-width: 65px;
    text-transform: uppercase;
  }

  .facet-scroll {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .facet-chip {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 0.3rem 0.65rem;
    border: 1.5px solid var(--color-black);
    background-color: var(--color-paper-light);
    color: var(--color-black);
    cursor: pointer;
    box-shadow: 1px 1px 0px var(--color-black);
    transition: all 0.1s ease;
    white-space: nowrap;
  }

  .facet-chip:hover {
    background-color: var(--color-red-light);
    transform: translate(-1px, -1px);
    box-shadow: 2px 2px 0px var(--color-black);
  }

  .facet-chip.active {
    background-color: var(--color-black);
    color: #FFFFFF;
    box-shadow: none;
  }

  .facet-chip.topic-chip {
    background-color: #FAF5EB;
    border-color: #4A4A4A;
  }

  .facet-chip.topic-chip:hover {
    background-color: var(--color-gold-muted);
  }

  .facet-chip.topic-chip.active {
    background-color: var(--color-red-primary);
    border-color: var(--color-black);
    color: #FFFFFF;
  }

  .chip-count {
    opacity: 0.75;
    font-size: 0.65rem;
    margin-left: 2px;
  }

  /* Card and Table Facet Tags */
  .card-header-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .card-type-stamp {
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    background-color: var(--color-red-primary);
    color: #FFFFFF;
    padding: 0.15rem 0.45rem;
    border: 1px solid var(--color-black);
  }

  .card-topics {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-bottom: 0.85rem;
  }

  .topic-tag {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 700;
    padding: 0.2rem 0.5rem;
    background-color: var(--color-paper-dark);
    border: 1px solid var(--color-black);
    color: var(--color-black);
    cursor: pointer;
    transition: all 0.1s ease;
  }

  .topic-tag:hover {
    background-color: var(--color-gold);
    color: #000000;
  }

  .topic-tag-more {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 600;
    padding: 0.2rem 0.45rem;
    background-color: transparent;
    border: 1px dashed var(--color-gray-dark);
    color: var(--color-gray-dark);
    display: inline-flex;
    align-items: center;
  }

  .table-topics {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-top: 0.3rem;
  }

  .table-topic-pill {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 700;
    padding: 0.1rem 0.4rem;
    background-color: var(--color-paper-dark);
    border: 1px solid #777;
    color: #222;
  }

  .category-stamp.type-stamp {
    background-color: var(--color-red-primary);
    color: #FFFFFF;
    margin-top: 0.25rem;
    display: inline-block;
  }
</style>
