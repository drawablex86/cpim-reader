<script lang="ts">
  import { onMount } from 'svelte';
  import CitationModal from '$lib/components/CitationModal.svelte';
  import SemanticResultsPanel from '$lib/components/SemanticResultsPanel.svelte';
  import type { DocumentMeta } from '$lib/documents';
  import {
    DOC_TYPES,
    TOPICS,
    PERIODS,
    GEOGRAPHY,
    getDocTypeLabel,
    getTopicLabel,
    getPeriodLabel,
    getGeoLabel
  } from '$lib/taxonomy';
  import { documentUrl } from '$lib/site';
  import {
    readAllProgress,
    recentProgress,
    formatRelativeTime,
    type ReadingProgressEntry
  } from '$lib/reading-progress';
  import {
    semanticSearch,
    loadEmbeddingModel,
    onModelProgress,
    type SearchResult
  } from '$lib/semantic-search';

  let { data } = $props();

  let selectedCategory = $state('All');
  // Facets are multi-select: the four groups combine with AND, values within a
  // group combine with OR.
  let selectedDocTypes = $state<string[]>([]);
  let selectedTopics = $state<string[]>([]);
  let selectedPeriods = $state<string[]>([]);
  let selectedGeos = $state<string[]>([]);
  let searchQuery = $state('');
  let searchMode = $state<'all' | 'titles' | 'semantic'>('all');
  let viewMode = $state<'cards' | 'table'>('cards');
  let activeCiteDoc = $state<DocumentMeta | null>(null);

  // Filter panel disclosure — every group stays collapsed until requested
  let filtersOpen = $state(false);
  let formatGroupOpen = $state(false);
  let topicGroupOpen = $state(false);
  let congressGroupOpen = $state(false);
  let regionGroupOpen = $state(false);
  let topicSearch = $state('');
  let filtersButtonEl = $state<HTMLButtonElement | null>(null);
  let filterPanelEl = $state<HTMLDivElement | null>(null);
  let searchOptionsEl = $state<HTMLDetailsElement | null>(null);

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

  const searchModes = [
    { value: 'all' as const, label: 'Full text', hint: 'Search every word of every document' },
    { value: 'titles' as const, label: 'Titles & dates', hint: 'Match titles, authors and dates only' },
    {
      value: 'semantic' as const,
      label: 'Topic concepts',
      hint: 'Find documents by meaning (loads a local model)'
    }
  ];

  const searchModeLabel = $derived(
    searchModes.find((mode) => mode.value === searchMode)?.label ?? 'Full text'
  );

  function chooseSearchMode(mode: 'all' | 'titles' | 'semantic') {
    if (mode === 'semantic') activateSemanticMode();
    else searchMode = mode;
    if (searchOptionsEl) searchOptionsEl.open = false;
  }

  // Facet params are comma-separated so links can carry a multi-select state.
  function parseFacetParam(raw: string | null, table: Record<string, unknown>): string[] {
    if (!raw) return [];
    return raw
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value !== '' && value !== 'all' && value in table);
  }

  /**
   * The catalog is deep-linkable: every facet, the query and the layout live in
   * the query string so a filtered view can be shared, bookmarked, or reached
   * from a document breadcrumb.
   */
  let urlReady = false;

  function applyFiltersFromUrl() {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);

    const cat = params.get('cat');
    if (cat && categories.some((c) => c.toLowerCase() === cat.toLowerCase())) {
      selectedCategory = categories.find((c) => c.toLowerCase() === cat.toLowerCase())!;
    }

    selectedDocTypes = parseFacetParam(params.get('type'), DOC_TYPES);
    selectedTopics = parseFacetParam(params.get('topic'), TOPICS);
    selectedPeriods = parseFacetParam(params.get('period'), PERIODS);
    selectedGeos = parseFacetParam(params.get('geo'), GEOGRAPHY);

    const view = params.get('view');
    if (view === 'cards' || view === 'table') viewMode = view;

    // Semantic mode is opt-in only: it downloads a model, so never restore it
    // from a link.
    const mode = params.get('mode');
    if (mode === 'titles' || mode === 'all') searchMode = mode;

    const q = params.get('q');
    if (q) searchQuery = q;
  }

  function syncFiltersToUrl() {
    if (typeof window === 'undefined' || !urlReady) return;

    const params = new URLSearchParams();
    if (selectedCategory !== 'All') params.set('cat', selectedCategory);
    if (selectedDocTypes.length > 0) params.set('type', selectedDocTypes.join(','));
    if (selectedTopics.length > 0) params.set('topic', selectedTopics.join(','));
    if (selectedPeriods.length > 0) params.set('period', selectedPeriods.join(','));
    if (selectedGeos.length > 0) params.set('geo', selectedGeos.join(','));
    if (viewMode !== 'cards') params.set('view', viewMode);
    if (searchMode !== 'all') params.set('mode', searchMode);
    if (searchQuery.trim()) params.set('q', searchQuery.trim());

    const query = params.toString();
    const next = `${window.location.pathname}${query ? `?${query}` : ''}`;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      // replaceState keeps filter tweaks out of the back-button history
      window.history.replaceState({}, '', next);
    }
  }

  $effect(() => {
    // Touch every filter so the effect re-runs when any of them change
    void [
      selectedCategory,
      selectedDocTypes,
      selectedTopics,
      selectedPeriods,
      selectedGeos,
      viewMode,
      searchMode,
      searchQuery
    ];
    syncFiltersToUrl();
  });

  // Locally stored reading progress (offline-first; no account, no server)
  let recentReads = $state<ReadingProgressEntry[]>([]);
  let progressBySlug = $state<Record<string, ReadingProgressEntry>>({});

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

    progressBySlug = readAllProgress();
    recentReads = recentProgress(4);

    applyFiltersFromUrl();
    urlReady = true;

    const onPopState = () => applyFiltersFromUrl();
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
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

  type FacetGroup = 'format' | 'topic' | 'period' | 'region';

  function matchesCategory(doc: DocumentMeta): boolean {
    return (
      selectedCategory === 'All' ||
      doc.category.toLowerCase() === selectedCategory.toLowerCase()
    );
  }

  /**
   * `skip` leaves one group out of the predicate so that its own counts are
   * measured against the other active groups (the standard facet behaviour).
   */
  function docMatchesFilters(doc: DocumentMeta, skip?: FacetGroup): boolean {
    if (!matchesCategory(doc)) return false;

    if (skip !== 'format' && selectedDocTypes.length > 0) {
      if (!doc.doc_type || !selectedDocTypes.includes(doc.doc_type)) return false;
    }

    if (skip !== 'topic' && selectedTopics.length > 0) {
      if (!doc.topics || !selectedTopics.some((topic) => doc.topics!.includes(topic))) return false;
    }

    if (skip !== 'period' && selectedPeriods.length > 0) {
      if (!doc.period || !selectedPeriods.includes(doc.period)) return false;
    }

    if (skip !== 'region' && selectedGeos.length > 0) {
      if (!doc.geo || !selectedGeos.some((geo) => doc.geo!.includes(geo))) return false;
    }

    return true;
  }

  // Facet counts against the current category and the other active groups.
  const facetCounts = $derived.by(() => {
    const docs = data.documents as DocumentMeta[];

    const docType: Record<string, number> = {};
    for (const doc of docs.filter((doc) => docMatchesFilters(doc, 'format'))) {
      const key = doc.doc_type || 'report';
      docType[key] = (docType[key] || 0) + 1;
    }

    const topic: Record<string, number> = {};
    for (const doc of docs.filter((doc) => docMatchesFilters(doc, 'topic'))) {
      for (const key of doc.topics || []) topic[key] = (topic[key] || 0) + 1;
    }

    const period: Record<string, number> = {};
    for (const doc of docs.filter((doc) => docMatchesFilters(doc, 'period'))) {
      if (doc.period) period[doc.period] = (period[doc.period] || 0) + 1;
    }

    const geo: Record<string, number> = {};
    for (const doc of docs.filter((doc) => docMatchesFilters(doc, 'region'))) {
      for (const key of doc.geo || []) geo[key] = (geo[key] || 0) + 1;
    }

    return { docType, topic, period, geo };
  });

  function toggleValue(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  }

  function toggleDocType(value: string) {
    selectedDocTypes = toggleValue(selectedDocTypes, value);
  }

  function toggleTopic(value: string) {
    selectedTopics = toggleValue(selectedTopics, value);
  }

  function togglePeriod(value: string) {
    selectedPeriods = toggleValue(selectedPeriods, value);
  }

  function toggleGeo(value: string) {
    selectedGeos = toggleValue(selectedGeos, value);
  }

  // Only the option sets a request away, never the whole taxonomy.
  const visibleDocTypes = $derived(
    Object.entries(DOC_TYPES).filter(
      ([key]) => (facetCounts.docType[key] || 0) > 0 || selectedDocTypes.includes(key)
    )
  );

  const visibleTopics = $derived.by(() => {
    const needle = topicSearch.trim().toLowerCase();
    return Object.entries(TOPICS).filter(([key, item]) => {
      if ((facetCounts.topic[key] || 0) === 0 && !selectedTopics.includes(key)) return false;
      if (!needle) return true;
      return item.label.toLowerCase().includes(needle) || key.includes(needle);
    });
  });

  const congressGroups = $derived.by(() => {
    const entries = Object.entries(PERIODS);
    const groups = [
      {
        key: 'congress',
        label: 'Party Congresses',
        items: entries.filter(([key]) => key.endsWith('-congress'))
      },
      {
        key: 'current',
        label: 'National — Current Period',
        items: entries.filter(([key]) => key === 'national-current')
      },
      {
        key: 'elections',
        label: 'General Elections',
        items: entries.filter(([key]) => key.endsWith('-elections'))
      }
    ];

    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          ([key]) => (facetCounts.period[key] || 0) > 0 || selectedPeriods.includes(key)
        )
      }))
      .filter((group) => group.items.length > 0);
  });

  const visibleGeos = $derived(
    Object.entries(GEOGRAPHY).filter(
      ([key]) => (facetCounts.geo[key] || 0) > 0 || selectedGeos.includes(key)
    )
  );

  function toggleFiltersPanel() {
    if (filtersOpen) closeFiltersPanel(false);
    else filtersOpen = true;
  }

  function closeFiltersPanel(restoreFocus = true) {
    if (!filtersOpen) return;
    filtersOpen = false;
    if (restoreFocus) filtersButtonEl?.focus();
  }

  function handleGlobalKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && filtersOpen) {
      event.stopPropagation();
      closeFiltersPanel();
    }
  }

  // Dismiss the panel on an outside click (desktop); the mobile backdrop covers
  // the same job for touch.
  $effect(() => {
    if (!filtersOpen || typeof document === 'undefined') return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (filterPanelEl?.contains(target) || filtersButtonEl?.contains(target)) return;
      filtersOpen = false;
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  });

  // Filter and sort documents based on metadata + Pagefind WASM results
  const filteredDocs = $derived.by(() => {
    const q = searchQuery.toLowerCase().trim();

    return (data.documents as DocumentMeta[])
      .filter((doc: DocumentMeta) => {
        if (!docMatchesFilters(doc)) return false;

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

  interface FilterChip {
    id: string;
    facet: FacetGroup;
    value: string;
    label: string;
  }

  // One chip per selected value, so a filter can be removed individually.
  const activeFilterChips = $derived.by(() => {
    const chips: FilterChip[] = [];

    for (const value of selectedDocTypes) {
      chips.push({
        id: `format:${value}`,
        facet: 'format',
        value,
        label: getDocTypeLabel(value).toUpperCase()
      });
    }
    for (const value of selectedTopics) {
      chips.push({ id: `topic:${value}`, facet: 'topic', value, label: `#${getTopicLabel(value)}` });
    }
    for (const value of selectedPeriods) {
      chips.push({
        id: `period:${value}`,
        facet: 'period',
        value,
        label: getPeriodLabel(value).toUpperCase()
      });
    }
    for (const value of selectedGeos) {
      chips.push({
        id: `region:${value}`,
        facet: 'region',
        value,
        label: getGeoLabel(value).toUpperCase()
      });
    }

    return chips;
  });

  function removeFilterChip(chip: FilterChip) {
    if (chip.facet === 'format') {
      selectedDocTypes = selectedDocTypes.filter((value) => value !== chip.value);
    } else if (chip.facet === 'topic') {
      selectedTopics = selectedTopics.filter((value) => value !== chip.value);
    } else if (chip.facet === 'period') {
      selectedPeriods = selectedPeriods.filter((value) => value !== chip.value);
    } else {
      selectedGeos = selectedGeos.filter((value) => value !== chip.value);
    }
  }

  // Clear all resets the filters only; category and query are the user's
  // navigation and search context, not filters.
  function clearFilters() {
    selectedDocTypes = [];
    selectedTopics = [];
    selectedPeriods = [];
    selectedGeos = [];
  }

  function resetSearchAndFilters() {
    selectedCategory = 'All';
    searchQuery = '';
    clearFilters();
  }
</script>

<svelte:head>
  <title>CPI(M) Documents Archive // Research Catalog</title>
</svelte:head>

<svelte:window onkeydown={handleGlobalKeydown} />

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

  {#if recentReads.length > 0}
    <section class="continue-strip" aria-label="Continue reading">
      <div class="continue-head">
        <span class="continue-stamp">◷ CONTINUE READING</span>
        <span class="continue-hint">Saved in this browser</span>
      </div>
      <div class="continue-items">
        {#each recentReads as entry (entry.slug)}
          <a class="continue-item" href={`/docs/${entry.slug}`}>
            <div class="continue-top">
              <span class="continue-pct">{entry.percent}%</span>
              <span class="continue-when">{formatRelativeTime(entry.updatedAt)}</span>
            </div>
            <span class="continue-title">{entry.title}</span>
            {#if entry.headingText}
              <span class="continue-section">↳ {entry.headingText}</span>
            {/if}
          </a>
        {/each}
      </div>
    </section>
  {/if}

  <!-- Catalog controls: navigation, search, then results -->
  <section class="catalog-controls" aria-label="Catalog controls">
    <!-- Archive navigation -->
    <nav class="archive-nav" aria-label="Document category">
      {#each categories as cat}
        <button
          type="button"
          class="cat-tab"
          class:active={selectedCategory === cat}
          aria-pressed={selectedCategory === cat}
          onclick={() => (selectedCategory = cat)}
        >
          {cat.toUpperCase()}
        </button>
      {/each}
    </nav>

    <!-- Search -->
    <div class="search-row">
      <div class="search-box">
        <span class="search-icon" aria-hidden="true">{searchMode === 'semantic' ? '⬡' : '⌕'}</span>
        <input
          type="search"
          bind:value={searchQuery}
          placeholder={searchMode === 'semantic'
            ? 'Search by concept: e.g. agrarian crisis, secularism, labour rights...'
            : searchMode === 'all'
              ? 'Search across titles, resolutions & full document text...'
              : 'Search by title, author, or year...'}
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
      </div>

      <!-- Secondary search modes stay one click away -->
      <details class="search-options" bind:this={searchOptionsEl}>
        <summary class="search-options-trigger">
          <span class="search-options-label">SCOPE: {searchModeLabel}</span>
          <span class="search-options-caret" aria-hidden="true">▾</span>
        </summary>
        <div class="search-options-menu">
          <p class="search-options-heading">SEARCH SCOPE</p>
          {#each searchModes as mode}
            <button
              type="button"
              class="search-option"
              class:active={searchMode === mode.value}
              aria-pressed={searchMode === mode.value}
              onclick={() => chooseSearchMode(mode.value)}
            >
              <span class="search-option-name">{mode.label}</span>
              <span class="search-option-hint">{mode.hint}</span>
            </button>
          {/each}
        </div>
      </details>
    </div>

    <!-- Results toolbar -->
    <div class="results-toolbar">
      <div class="toolbar-left">
        <button
          type="button"
          class="filters-toggle"
          class:active={filtersOpen}
          aria-expanded={filtersOpen}
          aria-controls="filter-panel"
          aria-label={activeFilterChips.length > 0
            ? `Filters, ${activeFilterChips.length} active`
            : 'Filters'}
          bind:this={filtersButtonEl}
          onclick={toggleFiltersPanel}
        >
          FILTERS
          {#if activeFilterChips.length > 0}
            <span class="filters-count" aria-hidden="true">{activeFilterChips.length}</span>
          {/if}
        </button>

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

      <div class="view-toggles" role="group" aria-label="Catalog layout">
        <button
          type="button"
          class="view-btn"
          class:active={viewMode === 'cards'}
          aria-pressed={viewMode === 'cards'}
          onclick={() => (viewMode = 'cards')}
          title="Card grid view"
        >
          CARDS
        </button>
        <button
          type="button"
          class="view-btn"
          class:active={viewMode === 'table'}
          aria-pressed={viewMode === 'table'}
          onclick={() => (viewMode = 'table')}
          title="Archival ledger table view"
        >
          TABLE
        </button>
      </div>
    </div>

    <!-- Active filters -->
    {#if activeFilterChips.length > 0}
      <div class="active-filters" aria-label="Active filters">
        {#each activeFilterChips as chip (chip.id)}
          <button
            type="button"
            class="active-filter-chip"
            onclick={() => removeFilterChip(chip)}
            aria-label={`Remove filter: ${chip.label}`}
            title={`Remove filter: ${chip.label}`}
          >
            <span class="chip-text">{chip.label}</span>
            <span class="chip-x" aria-hidden="true">✕</span>
          </button>
        {/each}
        <button type="button" class="reset-filters" onclick={clearFilters}>CLEAR ALL</button>
      </div>
    {/if}

    <!-- Filter panel, opened on request -->
    {#if filtersOpen}
      <div
        class="filter-backdrop"
        role="presentation"
        onclick={() => closeFiltersPanel(false)}
      ></div>
      <div
        class="filter-panel"
        id="filter-panel"
        role="region"
        aria-label="Filter documents"
        bind:this={filterPanelEl}
      >
        <div class="filter-panel-head">
          <span class="filter-panel-title">FILTER DOCUMENTS</span>
          <button
            type="button"
            class="filter-panel-close"
            onclick={() => closeFiltersPanel()}
            aria-label="Close filters"
          >
            ✕
          </button>
        </div>

        <div class="filter-panel-body">
          <details class="filter-group" bind:open={formatGroupOpen}>
            <summary class="filter-group-summary">
              <span class="filter-group-name">FORMAT</span>
              {#if selectedDocTypes.length > 0}
                <span class="filter-group-active">{selectedDocTypes.length}</span>
              {/if}
              <span class="filter-group-caret" aria-hidden="true">▾</span>
            </summary>
            <div class="filter-options">
              {#each visibleDocTypes as [key, item] (key)}
                <button
                  type="button"
                  class="filter-option"
                  class:selected={selectedDocTypes.includes(key)}
                  aria-pressed={selectedDocTypes.includes(key)}
                  onclick={() => toggleDocType(key)}
                  title={item.description || item.label}
                >
                  <span class="filter-option-label">{item.label}</span>
                  <span class="filter-option-count">{facetCounts.docType[key] || 0}</span>
                </button>
              {:else}
                <p class="filter-empty">No formats in this category.</p>
              {/each}
            </div>
          </details>

          <details class="filter-group" bind:open={topicGroupOpen}>
            <summary class="filter-group-summary">
              <span class="filter-group-name">TOPIC</span>
              {#if selectedTopics.length > 0}
                <span class="filter-group-active">{selectedTopics.length}</span>
              {/if}
              <span class="filter-group-caret" aria-hidden="true">▾</span>
            </summary>
            <div class="filter-options">
              <input
                type="search"
                class="topic-search"
                bind:value={topicSearch}
                placeholder="Find a topic…"
                aria-label="Find a topic"
              />
              {#each visibleTopics as [key, item] (key)}
                <button
                  type="button"
                  class="filter-option"
                  class:selected={selectedTopics.includes(key)}
                  aria-pressed={selectedTopics.includes(key)}
                  onclick={() => toggleTopic(key)}
                  title={item.description || item.label}
                >
                  <span class="filter-option-label">#{item.label}</span>
                  <span class="filter-option-count">{facetCounts.topic[key] || 0}</span>
                </button>
              {:else}
                <p class="filter-empty">
                  {topicSearch.trim()
                    ? `No topics match “${topicSearch.trim()}”.`
                    : 'No topics in this selection.'}
                </p>
              {/each}
            </div>
          </details>

          <details class="filter-group" bind:open={congressGroupOpen}>
            <summary class="filter-group-summary">
              <span class="filter-group-name">CONGRESS &amp; ELECTIONS</span>
              {#if selectedPeriods.length > 0}
                <span class="filter-group-active">{selectedPeriods.length}</span>
              {/if}
              <span class="filter-group-caret" aria-hidden="true">▾</span>
            </summary>
            <div class="filter-options">
              {#each congressGroups as group (group.key)}
                <div class="filter-subgroup">
                  <p class="filter-subgroup-label">{group.label}</p>
                  <div class="filter-subgroup-options">
                    {#each group.items as [key, item] (key)}
                      <button
                        type="button"
                        class="filter-option"
                        class:selected={selectedPeriods.includes(key)}
                        aria-pressed={selectedPeriods.includes(key)}
                        onclick={() => togglePeriod(key)}
                        title={item.description || item.label}
                      >
                        <span class="filter-option-label">{item.label}</span>
                        <span class="filter-option-count">{facetCounts.period[key] || 0}</span>
                      </button>
                    {/each}
                  </div>
                </div>
              {:else}
                <p class="filter-empty">No Congress or election documents in this selection.</p>
              {/each}
            </div>
          </details>

          <details class="filter-group" bind:open={regionGroupOpen}>
            <summary class="filter-group-summary">
              <span class="filter-group-name">REGION</span>
              {#if selectedGeos.length > 0}
                <span class="filter-group-active">{selectedGeos.length}</span>
              {/if}
              <span class="filter-group-caret" aria-hidden="true">▾</span>
            </summary>
            <div class="filter-options">
              {#each visibleGeos as [key, item] (key)}
                <button
                  type="button"
                  class="filter-option"
                  class:selected={selectedGeos.includes(key)}
                  aria-pressed={selectedGeos.includes(key)}
                  onclick={() => toggleGeo(key)}
                  title={item.description || item.label}
                >
                  <span class="filter-option-label">{item.label}</span>
                  <span class="filter-option-count">{facetCounts.geo[key] || 0}</span>
                </button>
              {:else}
                <p class="filter-empty">No regions in this selection.</p>
              {/each}
            </div>
          </details>
        </div>

        <div class="filter-panel-foot">
          <span class="filter-result-count">
            {filteredDocs.length} OF {data.documents.length} DOCUMENTS
          </span>
          <div class="filter-panel-actions">
            <button
              type="button"
              class="panel-clear"
              onclick={clearFilters}
              disabled={activeFilterChips.length === 0}
            >
              CLEAR ALL
            </button>
            <button type="button" class="panel-apply" onclick={() => closeFiltersPanel()}>
              SHOW {filteredDocs.length} RESULTS
            </button>
          </div>
        </div>
      </div>
    {/if}
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
          <p>
            Nothing in <strong>{selectedCategory}</strong> matches the current
            {searchQuery.trim() ? 'query and ' : ''}filters.
          </p>
          <button type="button" class="btn-reset" onclick={resetSearchAndFilters}>
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
                    class:selected={selectedTopics.includes(t)}
                    aria-pressed={selectedTopics.includes(t)}
                    onclick={(e) => {
                      e.preventDefault();
                      toggleTopic(t);
                    }}
                    title={`${selectedTopics.includes(t) ? 'Remove' : 'Add'} topic filter: ${getTopicLabel(t)}`}
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
                {#if progressBySlug[doc.slug]}
                  <span class="doc-progress-chip" title="Reading progress in this browser">
                    {progressBySlug[doc.slug].percent}% READ
                  </span>
                {/if}
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
                <td class="mono-cell">
                  {doc.page_count || '—'}
                  {#if progressBySlug[doc.slug]}
                    <div class="table-progress">{progressBySlug[doc.slug].percent}%</div>
                  {/if}
                </td>
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
    margin: 1.25rem 0;
    padding: 1.6rem 1.5rem 1.35rem;
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
    font-size: clamp(1.75rem, 4.2vw, 2.6rem);
    font-weight: 700;
    letter-spacing: 0.05em;
    line-height: 1.1;
    color: #FFFFFF;
    margin: 0 0 0.6rem;
  }

  .hero-deck {
    font-size: 1rem;
    line-height: 1.55;
    color: #D5D5D5;
    max-width: 800px;
    margin: 0 0 1.15rem;
  }

  .hero-stats-strip {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
    border-top: 2px solid #333333;
    padding-top: 1rem;
  }

  .stat-pill {
    display: flex;
    flex-direction: column;
    padding: 0.4rem 0.8rem;
    background-color: #1E1E1E;
    border: 1px solid #444444;
  }

  .stat-pill.accent {
    background-color: var(--color-red-primary);
    border-color: var(--color-red-dark);
  }

  .stat-num {
    font-size: 1.1rem;
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

  /* On small screens the hero yields space to the catalog controls */
  @media (max-width: 720px) {
    .hero-banner {
      margin: 0.75rem 0;
      padding: 1.1rem 1rem 1rem;
    }

    .hero-title {
      font-size: 1.55rem;
    }

    .hero-deck {
      font-size: 0.85rem;
      line-height: 1.45;
      margin-bottom: 0.8rem;
    }

    .hero-stats-strip {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.4rem;
      padding-top: 0.7rem;
    }

    .stat-pill {
      padding: 0.35rem 0.6rem;
    }

    .stat-num {
      font-size: 0.95rem;
    }

    .stat-txt {
      font-size: 0.58rem;
    }
  }

  /* Continue reading strip */
  .continue-strip {
    border: var(--border-medium);
    background-color: var(--color-paper-light);
    box-shadow: var(--shadow-hard-sm);
    padding: 1rem 1.15rem;
    margin-bottom: 1rem;
  }

  .continue-head {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    border-bottom: 1px solid var(--color-gray-light);
    padding-bottom: 0.55rem;
    margin-bottom: 0.75rem;
  }

  .continue-stamp {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.09em;
    color: var(--color-red-primary);
  }

  .continue-hint {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    color: var(--color-gray-dark);
  }

  .continue-items {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 0.6rem;
  }

  .continue-item {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.55rem 0.7rem;
    border: 1px solid var(--color-gray-dark);
    background-color: var(--color-paper);
    transition: all 0.1s ease;
  }

  .continue-item:hover {
    background-color: #ffffff;
    border-color: var(--color-red-primary);
    transform: translate(-1px, -1px);
    box-shadow: 2px 2px 0px var(--color-black);
  }

  .continue-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .continue-pct {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 800;
    color: #ffffff;
    background-color: var(--color-red-primary);
    padding: 0.1rem 0.35rem;
  }

  .continue-when {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    color: var(--color-gray-dark);
  }

  .continue-title {
    font-size: 0.9rem;
    font-weight: 700;
    line-height: 1.3;
    color: var(--color-black);
  }

  .continue-section {
    font-family: var(--font-prose);
    font-size: 0.78rem;
    font-style: italic;
    color: var(--color-gray-dark);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .doc-progress-chip {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    color: #ffffff;
    background-color: var(--color-red-primary);
    padding: 0.2rem 0.45rem;
  }

  .table-progress {
    font-family: var(--font-mono);
    font-size: 0.6rem;
    font-weight: 800;
    color: var(--color-red-primary);
    margin-top: 0.15rem;
  }

  /* Catalog controls */
  .catalog-controls {
    position: relative;
    margin-bottom: 1.25rem;
  }

  .archive-nav {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
    border-bottom: var(--border-heavy);
    padding-bottom: 0.6rem;
    margin-bottom: 0.9rem;
  }

  .cat-tab {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    padding: 0.45rem 0.7rem;
    border: 2px solid transparent;
    background: transparent;
    color: var(--color-gray-dark);
    cursor: pointer;
    transition: color 0.1s ease, background-color 0.1s ease;
  }

  .cat-tab:hover {
    color: var(--color-black);
    background-color: var(--color-paper-dark);
  }

  .cat-tab.active {
    background-color: var(--color-black);
    border-color: var(--color-black);
    color: #FFFFFF;
  }

  /* Search */
  .search-row {
    display: flex;
    align-items: stretch;
    gap: 0.5rem;
    margin-bottom: 0.65rem;
  }

  .search-box {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0 0.5rem 0 0.75rem;
    background-color: #FFFFFF;
    border: 2px solid var(--color-black);
  }

  .search-box:focus-within {
    outline: 2px solid var(--color-red-primary);
    outline-offset: 1px;
  }

  .search-icon {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--color-gray-medium);
  }

  .search-input {
    flex: 1;
    min-width: 0;
    padding: 0.7rem 0;
    border: none;
    outline: none;
    background: transparent;
    font-family: inherit;
    font-size: 0.95rem;
  }

  .search-spinner {
    font-size: 0.7rem;
    color: var(--color-red-primary);
    animation: pulse 0.8s infinite alternate;
  }

  @keyframes pulse {
    0% { opacity: 0.2; transform: scale(0.85); }
    100% { opacity: 1; transform: scale(1.15); }
  }

  .clear-btn {
    padding: 0.25rem 0.5rem;
    border: none;
    background: transparent;
    color: var(--color-gray-medium);
    font-weight: 700;
    cursor: pointer;
  }

  .clear-btn:hover {
    color: var(--color-red-primary);
  }

  /* Search scope disclosure */
  .search-options {
    position: relative;
    flex: 0 0 auto;
  }

  .search-options-trigger {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    height: 100%;
    padding: 0 0.9rem;
    border: 2px solid var(--color-black);
    background-color: var(--color-paper-light);
    color: var(--color-gray-dark);
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    white-space: nowrap;
    cursor: pointer;
    list-style: none;
  }

  .search-options-trigger::-webkit-details-marker {
    display: none;
  }

  .search-options-trigger:hover {
    color: var(--color-black);
    background-color: var(--color-paper-dark);
  }

  .search-options[open] .search-options-trigger {
    background-color: var(--color-black);
    color: #FFFFFF;
  }

  .search-options[open] .search-options-caret {
    transform: rotate(180deg);
  }

  .search-options-menu {
    position: absolute;
    top: calc(100% + 0.4rem);
    right: 0;
    z-index: 320;
    width: 17.5rem;
    max-width: calc(100vw - 3rem);
    padding: 0.45rem;
    background-color: var(--color-paper-light);
    border: var(--border-medium);
    box-shadow: var(--shadow-hard-md);
  }

  .search-options-heading {
    margin: 0 0 0.35rem;
    padding: 0 0.5rem;
    font-family: var(--font-mono);
    font-size: 0.6rem;
    letter-spacing: 0.1em;
    color: var(--color-gray-medium);
  }

  .search-option {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    width: 100%;
    padding: 0.45rem 0.5rem;
    border: none;
    border-left: 3px solid transparent;
    background: transparent;
    text-align: left;
    cursor: pointer;
  }

  .search-option:hover {
    background-color: var(--color-paper-dark);
  }

  .search-option.active {
    border-left-color: var(--color-red-primary);
    background-color: var(--color-paper-dark);
  }

  .search-option-name {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--color-black);
  }

  .search-option.active .search-option-name {
    color: var(--color-red-primary);
  }

  .search-option-hint {
    font-family: var(--font-mono);
    font-size: 0.58rem;
    line-height: 1.4;
    color: var(--color-gray-medium);
  }

  /* Results toolbar */
  .results-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
    padding-top: 0.35rem;
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
    min-width: 0;
  }

  .filters-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 0.7rem;
    border: 2px solid var(--color-black);
    background-color: var(--color-paper-light);
    color: var(--color-black);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    cursor: pointer;
    transition: background-color 0.1s ease, color 0.1s ease;
  }

  .filters-toggle:hover,
  .filters-toggle.active {
    background-color: var(--color-black);
    color: #FFFFFF;
  }

  .filters-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.1rem;
    height: 1.1rem;
    padding: 0 0.25rem;
    background-color: var(--color-red-primary);
    color: #FFFFFF;
    font-size: 0.62rem;
    line-height: 1;
  }

  .results-count {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    letter-spacing: 0.04em;
    color: var(--color-gray-dark);
  }

  .results-count strong {
    color: var(--color-black);
  }

  .wasm-status-badge {
    padding: 0.15rem 0.4rem;
    border: 1px solid var(--color-gray-light);
    font-family: var(--font-mono);
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: var(--color-gray-dark);
  }

  .wasm-status-badge.semantic-badge {
    border-color: var(--color-gold);
    background-color: var(--color-black);
    color: var(--color-gold);
  }

  .view-toggles {
    display: inline-flex;
    margin-left: auto;
    border: 2px solid var(--color-black);
  }

  .view-btn {
    padding: 0.35rem 0.7rem;
    border: none;
    background-color: var(--color-paper-light);
    color: var(--color-gray-dark);
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    cursor: pointer;
  }

  .view-btn + .view-btn {
    border-left: 2px solid var(--color-black);
  }

  .view-btn:hover {
    color: var(--color-black);
  }

  .view-btn.active {
    background-color: var(--color-black);
    color: #FFFFFF;
  }

  /* Model Loading Strip */
  .model-loading-strip {
    background-color: #FFFDF9;
    border: 2px solid var(--color-black);
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
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

  /* Active filter chips */
  .active-filters {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-wrap: wrap;
    margin-top: 0.7rem;
  }

  .active-filter-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    max-width: 22rem;
    padding: 0.28rem 0.55rem;
    border: 1px solid var(--color-black);
    background-color: var(--color-black);
    color: #FFFFFF;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: background-color 0.1s ease;
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
    font-size: 0.68rem;
    opacity: 0.8;
  }

  .reset-filters {
    padding: 0.2rem 0.3rem;
    border: none;
    background: transparent;
    font-family: var(--font-mono);
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--color-red-primary);
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;
  }

  .reset-filters:hover {
    color: var(--color-red-dark);
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
    /* 235 cards mount at once; defer off-screen layout/paint. The intrinsic
       size keeps the scrollbar stable while cards are skipped. */
    content-visibility: auto;
    contain-intrinsic-size: auto 360px;
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

  /* Filter panel */
  .filter-backdrop {
    display: none;
  }

  .filter-panel {
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 0;
    z-index: 310;
    width: min(46rem, 100%);
    max-height: min(70vh, 40rem);
    display: flex;
    flex-direction: column;
    background-color: var(--color-paper-light);
    border: var(--border-heavy);
    box-shadow: var(--shadow-hard-lg);
  }

  .filter-panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.6rem 0.9rem;
    border-bottom: 2px solid var(--color-black);
  }

  .filter-panel-title {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.1em;
  }

  .filter-panel-close {
    padding: 0.1rem 0.3rem;
    border: none;
    background: transparent;
    color: var(--color-gray-dark);
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
  }

  .filter-panel-close:hover {
    color: var(--color-red-primary);
  }

  .filter-panel-body {
    overflow-y: auto;
    padding: 0.15rem 0.9rem 0.6rem;
  }

  .filter-group {
    border-bottom: 1px solid var(--color-gray-light);
  }

  .filter-group:last-child {
    border-bottom: none;
  }

  .filter-group-summary {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.7rem 0;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    list-style: none;
    cursor: pointer;
  }

  .filter-group-summary::-webkit-details-marker {
    display: none;
  }

  .filter-group-summary:hover {
    color: var(--color-red-primary);
  }

  .filter-group-caret {
    margin-left: auto;
    font-size: 0.65rem;
    color: var(--color-gray-medium);
  }

  .filter-group[open] .filter-group-caret {
    transform: rotate(180deg);
  }

  .filter-group-active {
    padding: 0.05rem 0.3rem;
    background-color: var(--color-black);
    color: #FFFFFF;
    font-size: 0.6rem;
    letter-spacing: 0;
  }

  .filter-options {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    padding: 0 0 0.8rem;
  }

  .filter-option {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    max-width: 100%;
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--color-gray-light);
    background-color: var(--color-paper);
    color: var(--color-black);
    font-family: var(--font-mono);
    font-size: 0.68rem;
    text-align: left;
    cursor: pointer;
  }

  .filter-option:hover {
    border-color: var(--color-black);
  }

  .filter-option.selected {
    background-color: var(--color-black);
    border-color: var(--color-black);
    color: #FFFFFF;
  }

  .filter-option-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .filter-option-count {
    font-size: 0.62rem;
    color: var(--color-gray-medium);
  }

  .filter-option.selected .filter-option-count {
    color: var(--color-gray-light);
  }

  .topic-search {
    flex: 1 1 100%;
    margin-bottom: 0.15rem;
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--color-gray-light);
    background-color: #FFFFFF;
    font-family: var(--font-mono);
    font-size: 0.72rem;
  }

  .topic-search:focus-visible {
    outline: 2px solid var(--color-red-primary);
    outline-offset: -1px;
  }

  .filter-subgroup {
    flex: 1 1 100%;
    margin-bottom: 0.55rem;
  }

  .filter-subgroup:last-child {
    margin-bottom: 0;
  }

  .filter-subgroup-label {
    margin: 0 0 0.35rem;
    font-family: var(--font-mono);
    font-size: 0.58rem;
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--color-gray-medium);
  }

  .filter-subgroup-options {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }

  .filter-empty {
    flex: 1 1 100%;
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.65rem;
    color: var(--color-gray-medium);
  }

  .filter-panel-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
    padding: 0.6rem 0.9rem;
    border-top: 2px solid var(--color-black);
    background-color: var(--color-paper-dark);
  }

  .filter-result-count {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    color: var(--color-gray-dark);
  }

  .filter-panel-actions {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .panel-clear {
    padding: 0.4rem 0.6rem;
    border: 2px solid var(--color-black);
    background: transparent;
    color: var(--color-black);
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 700;
    cursor: pointer;
  }

  .panel-clear:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .panel-apply {
    padding: 0.4rem 0.8rem;
    border: 2px solid var(--color-black);
    background-color: var(--color-red-primary);
    color: #FFFFFF;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    cursor: pointer;
  }

  .panel-apply:hover {
    background-color: var(--color-red-dark);
  }

  @media (max-width: 720px) {
    .archive-nav {
      gap: 0.15rem;
      padding-bottom: 0.5rem;
    }

    .cat-tab {
      flex: 0 0 auto;
      padding: 0.4rem 0.5rem;
      font-size: 0.68rem;
    }

    .search-row {
      flex-wrap: wrap;
    }

    .search-box {
      flex: 1 1 100%;
    }

    .search-options {
      flex: 1 1 100%;
    }

    .search-options-trigger {
      width: 100%;
      height: auto;
      justify-content: space-between;
      padding: 0.45rem 0.7rem;
    }

    .search-options-menu {
      right: auto;
      left: 0;
      width: 100%;
    }

    .filter-backdrop {
      display: block;
      position: fixed;
      inset: 0;
      /* above the sticky masthead (999) so the drawer reads as modal */
      z-index: 1000;
      background-color: rgba(18, 18, 18, 0.45);
    }

    .filter-panel {
      position: fixed;
      inset: auto 0 0 0;
      z-index: 1010;
      width: 100%;
      max-height: 82vh;
      border-left: none;
      border-right: none;
      border-bottom: none;
      box-shadow: none;
    }

    .filter-option {
      font-size: 0.65rem;
    }

    .filter-panel-foot {
      position: sticky;
      bottom: 0;
    }
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

  .topic-tag.selected {
    background-color: var(--color-black);
    border-color: var(--color-black);
    color: #FFFFFF;
  }

  .topic-tag.selected:hover {
    background-color: var(--color-red-primary);
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
