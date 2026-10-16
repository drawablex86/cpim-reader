<script lang="ts">
  import CitationModal from '$lib/components/CitationModal.svelte';
  import type { DocumentMeta } from '$lib/documents';

  let { data } = $props();

  let selectedCategory = $state('All');
  let searchQuery = $state('');
  let viewMode = $state<'cards' | 'table'>('cards');
  let activeCiteDoc = $state<DocumentMeta | null>(null);

  const categories = ['All', 'CC Documents', 'Party Congress', 'Issues', 'Left View'];

  const filteredDocs = $derived(
    data.documents.filter((doc: DocumentMeta) => {
      const matchesCategory =
        selectedCategory === 'All' || doc.category.toLowerCase() === selectedCategory.toLowerCase();
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        doc.title.toLowerCase().includes(q) ||
        (doc.author && doc.author.toLowerCase().includes(q)) ||
        doc.date.includes(q);
      return matchesCategory && matchesSearch;
    })
  );

  function openCite(doc: DocumentMeta) {
    activeCiteDoc = doc;
  }

  function closeCite() {
    activeCiteDoc = null;
  }
</script>

<svelte:head>
  <title>CPI(M) Documents Archive // Research Catalog</title>
</svelte:head>

<div class="archive-explorer">
  <!-- Constructivist Hero Banner -->
  <section class="hero-banner">
    <div class="hero-inner">
      <div class="hero-stamp">OFFICIAL PARTY RESOLUTIONS • 2008 – 2026</div>
      <h1 class="hero-title">CPI(M) DOCUMENT ARCHIVE</h1>
      <p class="hero-deck">
        A static, searchable research repository containing verbatim Central Committee resolutions,
        Party Congress declarations, and monographs published by the Communist Party of India (Marxist).
      </p>

      <div class="hero-stats-strip">
        <div class="stat-pill">
          <span class="stat-num">{data.documents.length}</span>
          <span class="stat-txt">VERIFIED ARCHIVES LOADED</span>
        </div>
        <div class="stat-pill">
          <span class="stat-num">273+</span>
          <span class="stat-txt">CATALOGED ON LIVE SITE</span>
        </div>
        <div class="stat-pill accent">
          <span class="stat-num">WASM</span>
          <span class="stat-txt">OFFLINE FULL-TEXT SEARCH</span>
        </div>
      </div>
    </div>
  </section>

  <!-- Filter & Controls Toolbar -->
  <section class="controls-toolbar">
    <div class="toolbar-inner">
      <!-- Category Tabs -->
      <div class="category-tabs" role="tablist" aria-label="Document Category Filter">
        {#each categories as cat}
          <button
            type="button"
            role="tab"
            aria-selected={selectedCategory === cat}
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
          <span class="search-icon" aria-hidden="true">⌕</span>
          <input
            type="search"
            bind:value={searchQuery}
            placeholder="Search documents by title, author, date..."
            class="search-input"
            aria-label="Search documents"
          />
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
  </section>

  <!-- Results Count Strip -->
  <div class="results-meta-bar">
    <div class="results-inner">
      <span class="results-count">
        SHOWING <strong>{filteredDocs.length}</strong> OF <strong>{data.documents.length}</strong> DOCUMENTS
      </span>
      {#if selectedCategory !== 'All' || searchQuery}
        <button
          type="button"
          class="reset-filters"
          onclick={() => {
            selectedCategory = 'All';
            searchQuery = '';
          }}
        >
          RESET FILTERS ✕
        </button>
      {/if}
    </div>
  </div>

  <!-- Document Explorer Results -->
  <div class="catalog-viewport">
    {#if filteredDocs.length === 0}
      <div class="empty-state">
        <div class="empty-box">
          <h3>NO DOCUMENTS FOUND</h3>
          <p>No resolutions match category <strong>{selectedCategory}</strong> and query "<em>{searchQuery}</em>".</p>
          <button
            type="button"
            class="btn-reset"
            onclick={() => {
              selectedCategory = 'All';
              searchQuery = '';
            }}
          >
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
              <span class="card-category">{doc.category}</span>
              <time class="card-date" datetime={doc.date}>{doc.date}</time>
            </div>

            <h2 class="card-title">
              <a href={`/docs/${doc.slug}`}>{doc.title}</a>
            </h2>

            {#if doc.author}
              <div class="card-author">
                <span class="author-label">AUTHOR:</span> {doc.author}
              </div>
            {/if}

            <div class="card-footer">
              <div class="card-badges">
                {#if doc.page_count}
                  <span class="badge-tag">{doc.page_count} PP</span>
                {/if}
                <span class="badge-tag uppercase">{doc.extraction_method || 'OFFICIAL'}</span>
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
                </td>
                <td>
                  <a href={`/docs/${doc.slug}`} class="table-title-link">
                    {doc.title}
                  </a>
                  {#if doc.author}
                    <div class="table-author">{doc.author}</div>
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
      currentUrl={`https://cpim.org/documents/${activeCiteDoc.slug}`}
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

  .search-and-views {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .search-box {
    flex: 1;
    min-width: 280px;
    display: flex;
    align-items: center;
    background-color: #FFFFFF;
    border: 2px solid var(--color-black);
    box-shadow: var(--shadow-hard-sm);
    padding: 0 0.75rem;
  }

  .search-icon {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-gray-dark);
    margin-right: 0.5rem;
  }

  .search-input {
    flex: 1;
    border: none;
    outline: none;
    font-family: inherit;
    font-size: 0.95rem;
    padding: 0.65rem 0;
    background: transparent;
  }

  .clear-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    font-weight: 700;
    color: var(--color-gray-dark);
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

  /* Card Grid */
  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 1.5rem;
  }

  .doc-card {
    background-color: var(--color-paper-light);
    border: var(--border-heavy);
    box-shadow: var(--shadow-hard-md);
    display: flex;
    flex-direction: column;
    padding: 1.5rem;
    position: relative;
    transition: transform 0.1s ease, box-shadow 0.1s ease;
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
    margin-bottom: 1rem;
    font-family: var(--font-mono);
  }

  .card-category {
    font-size: 0.75rem;
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
    line-height: 1.3;
    margin: 0 0 1rem;
    flex: 1;
  }

  .card-title a {
    color: var(--color-black);
  }

  .card-title a:hover {
    color: var(--color-red-primary);
    text-decoration: underline;
  }

  .card-author {
    font-size: 0.85rem;
    color: var(--color-gray-dark);
    margin-bottom: 1.5rem;
    line-height: 1.4;
  }

  .author-label {
    font-weight: 700;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--color-black);
  }

  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid var(--color-gray-light);
    padding-top: 1rem;
    margin-top: auto;
  }

  .card-badges {
    display: flex;
    gap: 0.5rem;
  }

  .badge-tag {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 600;
    border: 1px solid var(--color-black);
    padding: 0.15rem 0.4rem;
    background-color: var(--color-paper);
  }

  .card-actions {
    display: flex;
    gap: 0.5rem;
  }

  .action-btn {
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 0.4rem 0.8rem;
    border: 2px solid var(--color-black);
    cursor: pointer;
    box-shadow: var(--shadow-hard-sm);
    transition: all 0.1s ease;
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
</style>
