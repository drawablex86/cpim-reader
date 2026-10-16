<script lang="ts">
  let { onclose, initialTab = 'sync' } = $props<{ onclose: () => void; initialTab?: 'sync' | 'embed' | 'translate' }>();

  // Mode: 'sync' | 'embed' | 'translate'
  let activeTab = $state<'sync' | 'embed' | 'translate'>('sync');

  $effect(() => {
    activeTab = initialTab;
  });

  // Sync state
  let provider = $state<'none' | 'openrouter' | 'ollama'>('none');
  let limit = $state(3);
  let dryRun = $state(false);
  let isRunning = $state(false);
  let terminalLogs = $state('');
  let syncStatus = $state<{ total_count: number; latest_processed: any } | null>(null);

  async function fetchSyncStatus() {
    try {
      const res = await fetch('/api/dev/sync-status');
      if (res.ok) {
        syncStatus = await res.json();
      }
    } catch {
      // ignore
    }
  }

  $effect(() => {
    fetchSyncStatus();
    const interval = setInterval(fetchSyncStatus, 3000);
    return () => clearInterval(interval);
  });

  // Embed prompt / state
  let showEmbedPrompt = $state(false);
  let isEmbedding = $state(false);
  let embedLogs = $state('');
  let embedDim = $state(256);
  let embedModel = $state('embeddinggemma-2:270m');
  let embedForce = $state(false);
  let embedSuccess = $state(false);

  // Translate state (Singular Focus: English -> Malayalam)
  let translateSlug = $state('2025-04-04-resolution-to-condemn-israels-genocidal-attacks-on-gaza');
  let translateEngine = $state<'ct2' | 'ollama' | 'indictrans2' | 'openrouter'>('ct2');
  let translateLang = $state('ml');
  let isTranslating = $state(false);
  let translateLogs = $state('');
  let translateSuccess = $state(false);
  let isLoadingModels = $state(false);
  let modelStatus = $state<{
    ct2?: { status: string; path: string; architecture: string; size: string; speed: string };
    ollama?: { status: string; models: string[]; hasQwen: boolean; hasIndicTransInOllama: boolean; indicOllamaNote: string };
    indictrans2?: { status: string; path: string; architecture: string; size: string };
    openrouter?: { status: string; model: string };
  } | null>(null);

  // Catalog queue state
  interface CatalogDoc {
    slug: string;
    title: string;
    date: string;
    category: string;
    status: 'completed' | 'pending';
    engine: string;
    updated_at: string;
  }
  let catalogData = $state<{
    lang: string;
    total: number;
    completed: number;
    pending: number;
    documents: CatalogDoc[];
  } | null>(null);
  let isLoadingCatalog = $state(false);
  let catalogFilter = $state<'pending' | 'all' | 'completed'>('pending');
  let catalogSearch = $state('');

  let filteredDocs = $derived.by(() => {
    if (!catalogData) return [];
    let list = catalogData.documents;
    if (catalogFilter === 'pending') {
      list = list.filter((d) => d.status === 'pending');
    } else if (catalogFilter === 'completed') {
      list = list.filter((d) => d.status === 'completed');
    }
    if (catalogSearch.trim()) {
      const q = catalogSearch.toLowerCase();
      list = list.filter((d) => d.title.toLowerCase().includes(q) || d.slug.toLowerCase().includes(q));
    }
    return list;
  });

  async function fetchCatalog() {
    isLoadingCatalog = true;
    try {
      const res = await fetch(`/api/dev/translation-catalog?lang=${translateLang}`);
      if (res.ok) {
        catalogData = await res.json();
      }
    } catch (err) {
      console.warn('Failed to fetch translation catalog:', err);
    } finally {
      isLoadingCatalog = false;
    }
  }

  async function fetchModelStatus() {
    isLoadingModels = true;
    try {
      const res = await fetch('/api/dev/models');
      if (res.ok) {
        modelStatus = await res.json();
      }
    } catch (err) {
      console.warn('Failed to fetch dev model status:', err);
    } finally {
      isLoadingModels = false;
    }
  }

  $effect(() => {
    if (activeTab === 'translate') {
      if (!modelStatus && !isLoadingModels) fetchModelStatus();
      if (!catalogData && !isLoadingCatalog) fetchCatalog();
    }
  });

  async function startTranslation() {
    isTranslating = true;
    translateSuccess = false;
    translateLogs = 'Connecting to translation backend worker...\n';

    try {
      const response = await fetch('/api/dev/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: translateSlug,
          engine: translateEngine,
          lang: translateLang,
          save: true
        })
      });

      if (!response.body) {
        translateLogs += '\n[ERROR]: No response body stream received.';
        isTranslating = false;
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        translateLogs += text;
      }

      if (translateLogs.includes('[PROCESS TERMINATED WITH CODE 0]')) {
        translateSuccess = true;
        fetchCatalog();
      }
    } catch (err: any) {
      translateLogs += `\n[NETWORK ERROR]: ${err.message}`;
    } finally {
      isTranslating = false;
    }
  }

  async function startSync() {
    isRunning = true;
    showEmbedPrompt = false;
    terminalLogs = 'Connecting to local extraction pipeline...\n';

    try {
      const response = await fetch('/api/dev/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, limit, dryRun })
      });

      if (!response.body) {
        terminalLogs += '\n[ERROR]: No response body stream received.';
        isRunning = false;
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        terminalLogs += text;
      }

      if (terminalLogs.includes('[PROCESS TERMINATED WITH CODE 0]') && !dryRun) {
        showEmbedPrompt = true;
      }
    } catch (err: any) {
      terminalLogs += `\n[NETWORK ERROR]: ${err.message}`;
    } finally {
      isRunning = false;
    }
  }

  async function startEmbedding() {
    isEmbedding = true;
    embedSuccess = false;
    embedLogs = 'Connecting to local embedding pipeline...\n';

    try {
      const response = await fetch('/api/dev/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: embedModel, dim: embedDim, force: embedForce })
      });

      if (!response.body) {
        embedLogs += '\n[ERROR]: No response body stream received.';
        isEmbedding = false;
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        embedLogs += text;
      }

      if (embedLogs.includes('[PROCESS TERMINATED WITH CODE 0]')) {
        embedSuccess = true;
      }
    } catch (err: any) {
      embedLogs += `\n[NETWORK ERROR]: ${err.message}`;
    } finally {
      isEmbedding = false;
    }
  }
</script>

<div class="modal-backdrop" onclick={onclose} onkeydown={(e) => e.key === 'Escape' && onclose()} role="presentation">
  <div
    class="modal-dialog"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="dev-sync-title"
    tabindex="-1"
  >
    <div class="modal-header">
      <div class="header-badge">⚡ DEV PIPELINE RUNNER</div>
      <div class="tab-pills">
        <button
          type="button"
          class="tab-pill"
          class:active={activeTab === 'sync'}
          onclick={() => (activeTab = 'sync')}
        >
          1. EXTRACTION (SYNC)
        </button>
        <button
          type="button"
          class="tab-pill"
          class:active={activeTab === 'embed'}
          onclick={() => (activeTab = 'embed')}
        >
          2. VECTOR EMBEDDING
        </button>
        <button
          type="button"
          class="tab-pill"
          class:active={activeTab === 'translate'}
          onclick={() => {
            activeTab = 'translate';
            if (!modelStatus) fetchModelStatus();
          }}
        >
          3. TRANSLATE (MALAYALAM DEV)
        </button>
      </div>
      <button type="button" class="close-btn" onclick={onclose} aria-label="Close modal">✕</button>
    </div>

    <div class="modal-body">
      {#if activeTab === 'sync'}
        <!-- EXTRACTION TAB -->
        <h2 id="dev-sync-title" class="modal-title">DOCUMENT EXTRACTION PIPELINE</h2>
        <p class="modal-deck">
          Executes <code>scripts/sync.py</code> locally. Downloads official documents, parses text/VLM, and outputs Markdown.
        </p>

        <div class="form-grid">
          <div class="form-group">
            <label for="provider-select">INFERENCE PROVIDER</label>
            <select id="provider-select" bind:value={provider} class="form-select" disabled={isRunning}>
              <option value="none">Fast Baseline: pymupdf4llm (Zero API / Zero GPU)</option>
              <option value="openrouter">Cloud Free: NVIDIA Nemotron 3 Ultra (OpenRouter .env)</option>
              <option value="ollama">Local: Ollama (qwen2.5vl:3b + qwen2.5:7b)</option>
            </select>
            {#if provider === 'openrouter'}
              <span class="field-hint">Reads <code>OPENROUTER_API_KEY</code> from local <code>.env</code> file.</span>
            {/if}
          </div>

          <div class="form-row">
            <div class="form-group half">
              <label for="limit-input">BATCH LIMIT</label>
              <input
                id="limit-input"
                type="number"
                bind:value={limit}
                min="1"
                max="50"
                class="form-input"
                disabled={isRunning}
              />
            </div>

            <div class="form-group half checkbox-group">
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={dryRun} disabled={isRunning} />
                <span>DRY RUN ONLY (Preview list)</span>
              </label>
            </div>
          </div>
        </div>

        {#if syncStatus}
          <div class="manifest-status-banner">
            <span class="manifest-badge">CATALOG MANIFEST: {syncStatus.total_count} INGESTED</span>
            {#if syncStatus.latest_processed}
              <span class="manifest-latest" title={syncStatus.latest_processed.title}>
                LATEST: <strong>{syncStatus.latest_processed.title}</strong> ({syncStatus.latest_processed.date})
              </span>
            {/if}
          </div>
        {/if}

        <div class="action-strip">
          <button
            type="button"
            class="btn-run"
            class:running={isRunning}
            onclick={startSync}
            disabled={isRunning}
          >
            {isRunning ? 'EXTRACTION RUNNING...' : dryRun ? 'RUN DRY-RUN PREVIEW ➔' : 'INITIATE EXTRACTION BATCH ➔'}
          </button>
        </div>

        <!-- Terminal Output Display -->
        <div class="terminal-shell">
          <div class="terminal-bar">
            <span>TERMINAL IPC STREAM // stdout & stderr</span>
            {#if terminalLogs}
              <button type="button" class="btn-clear" onclick={() => (terminalLogs = '')}>CLEAR</button>
            {/if}
          </div>
          <pre class="terminal-pre"><code>{terminalLogs || 'Ready to execute. Click button above to initiate.'}</code></pre>
        </div>

        <!-- Post-Sync Modal Dialogue Alert -->
        {#if showEmbedPrompt}
          <div class="post-sync-dialogue">
            <div class="dialogue-header">
              <span class="dialogue-icon">⬡</span>
              <span class="dialogue-title">DOCUMENT EXTRACTION COMPLETED!</span>
            </div>
            <p class="dialogue-desc">
              Would you like to initiate the <strong>Vector Embedding Pipeline</strong> now?
              This will run <code>scripts/embed.py</code> with <strong>embeddinggemma-2:270m</strong> to update
              <code>static/vectors.json</code> and enable dense semantic search across your documents.
            </p>
            <div class="dialogue-actions">
              <button
                type="button"
                class="btn-dialogue-confirm"
                onclick={() => {
                  activeTab = 'embed';
                  showEmbedPrompt = false;
                  startEmbedding();
                }}
              >
                ⬡ INITIATE EMBEDDING PIPELINE NOW ➔
              </button>
              <button
                type="button"
                class="btn-dialogue-cancel"
                onclick={() => (showEmbedPrompt = false)}
              >
                DISMISS
              </button>
            </div>
          </div>
        {/if}

      {:else if activeTab === 'embed'}
        <!-- EMBEDDING TAB -->
        <h2 class="modal-title">VECTOR EMBEDDING PIPELINE</h2>
        <p class="modal-deck">
          Executes <code>scripts/embed.py</code> locally using Ollama <code>{embedModel}</code>.
          Generates dense semantic vectors and writes <code>static/vectors.json</code> for client-side search.
        </p>

        <div class="form-grid">
          <div class="form-group">
            <label for="embed-model">OLLAMA EMBEDDING MODEL</label>
            <input
              id="embed-model"
              type="text"
              bind:value={embedModel}
              class="form-input"
              disabled={isEmbedding}
            />
            <span class="field-hint">Google EmbeddingGemma 2 (270M parameters text backbone)</span>
          </div>

          <div class="form-row">
            <div class="form-group half">
              <label for="dim-select">MRL OUTPUT DIMENSION</label>
              <select id="dim-select" bind:value={embedDim} class="form-select" disabled={isEmbedding}>
                <option value={128}>128 Dimensions (Ultra-compact, ~25KB)</option>
                <option value={256}>256 Dimensions (Recommended, ~50KB, High accuracy)</option>
                <option value={512}>512 Dimensions (Higher fidelity, ~100KB)</option>
                <option value={768}>768 Dimensions (Full native uncompressed)</option>
              </select>
            </div>

            <div class="form-group half checkbox-group">
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={embedForce} disabled={isEmbedding} />
                <span>FORCE RE-EMBED ALL (Ignore cached vectors)</span>
              </label>
            </div>
          </div>
        </div>

        <div class="action-strip">
          <button
            type="button"
            class="btn-run btn-embed"
            class:running={isEmbedding}
            onclick={startEmbedding}
            disabled={isEmbedding}
          >
            {isEmbedding ? 'EMBEDDING PIPELINE RUNNING...' : `GENERATE VECTORS (${embedDim}D) ➔`}
          </button>
        </div>

        {#if embedSuccess}
          <div class="success-banner">
            ✓ <code>static/vectors.json</code> SUCCESSFULLY GENERATED! Client-side semantic search is ready.
          </div>
        {/if}

        <div class="terminal-shell">
          <div class="terminal-bar">
            <span>EMBEDDING IPC STREAM // stdout & stderr</span>
            {#if embedLogs}
              <button type="button" class="btn-clear" onclick={() => (embedLogs = '')}>CLEAR</button>
            {/if}
          </div>
          <pre class="terminal-pre"><code>{embedLogs || 'Click "GENERATE VECTORS" to build client-side vector database.'}</code></pre>
        </div>

      {:else}
        <!-- MALAYALAM TRANSLATION WORKER & CATALOG QUEUE TAB -->
        <div class="translate-tab-header">
          <div>
            <h2 class="modal-title">MALAYALAM TRANSLATION CONSOLE</h2>
            <p class="modal-deck">
              Archive translation management for <strong>Malayalam (മലയാളം - ml)</strong>.
              All translations are filed in <code>src/content/translations/ml/[slug].md</code>.
              Protected by Marxist-Leninist party ideological glossary.
            </p>
          </div>
          <div class="header-action-group">
            <button type="button" class="btn-refresh-models" onclick={fetchCatalog} disabled={isLoadingCatalog}>
              {isLoadingCatalog ? 'LOADING...' : '↻ REFRESH CATALOG'}
            </button>
            <button type="button" class="btn-refresh-models" onclick={fetchModelStatus} disabled={isLoadingModels}>
              {isLoadingModels ? 'CHECKING...' : '⚙ MODEL STATUS'}
            </button>
          </div>
        </div>

        <!-- Catalog Queue Statistics Bar -->
        {#if catalogData}
          <div class="catalog-summary-bar">
            <div class="summary-metric">
              <span class="metric-label">TOTAL ARCHIVE</span>
              <span class="metric-val">{catalogData.total}</span>
            </div>
            <div class="summary-metric metric-pending">
              <span class="metric-label">PENDING (MALAYALAM)</span>
              <span class="metric-val">{catalogData.pending}</span>
            </div>
            <div class="summary-metric metric-completed">
              <span class="metric-label">COMPLETED</span>
              <span class="metric-val">{catalogData.completed}</span>
            </div>
            <div class="summary-metric metric-pct">
              <span class="metric-label">COMPLETION</span>
              <span class="metric-val">{Math.round((catalogData.completed / (catalogData.total || 1)) * 100)}%</span>
            </div>
          </div>
        {/if}

        <!-- Model Health & Discovery Matrix -->
        <div class="model-matrix">
          <div class="model-card featured-model-card">
            <div class="model-card-header">
              <span class="model-tag">⚡ CTRANSLATE2 INT8</span>
              <span class="status-badge" class:online={modelStatus?.ct2?.status === 'installed'}>
                {modelStatus?.ct2?.status === 'installed' ? '● READY (807 MB)' : '○ MISSING'}
              </span>
            </div>
            <div class="model-card-body">
              <div class="model-name">IndicTrans2 200M INT8</div>
              <div class="model-desc">
                Sub-second local C++ NEON inference (~0.4s/para). <strong>Recommended</strong>.
              </div>
            </div>
          </div>

          <div class="model-card">
            <div class="model-card-header">
              <span class="model-tag">CLOUD API (FREE)</span>
              <span class="status-badge" class:online={modelStatus?.openrouter?.status === 'configured'}>
                {modelStatus?.openrouter?.status === 'configured' ? '● ONLINE' : '○ NO API KEY'}
              </span>
            </div>
            <div class="model-card-body">
              <div class="model-name">Google Gemma 4 31B Free</div>
              <div class="model-desc">
                High-resolution zero-compute cloud fallback via OpenRouter.
              </div>
            </div>
          </div>

          <div class="model-card">
            <div class="model-card-header">
              <span class="model-tag">LOCAL OLLAMA</span>
              <span class="status-badge" class:online={modelStatus?.ollama?.status === 'online'}>
                {modelStatus?.ollama?.status === 'online' ? '● ONLINE' : '○ OFFLINE'}
              </span>
            </div>
            <div class="model-card-body">
              <div class="model-name">qwen2.5:7b (Causal LLM)</div>
              <div class="model-desc">
                Local generative Ollama worker (~1-2m/chunk).
              </div>
            </div>
          </div>
        </div>

        <!-- Active Worker Control Console -->
        <div class="runner-panel">
          <div class="runner-panel-header">
            <span class="runner-tag">ACTIVE WORKER PIPELINE</span>
            <div class="engine-pills">
              <button
                type="button"
                class="engine-pill"
                class:active={translateEngine === 'ct2'}
                onclick={() => (translateEngine = 'ct2')}
                disabled={isTranslating}
              >
                ⚡ CTranslate2 INT8
              </button>
              <button
                type="button"
                class="engine-pill"
                class:active={translateEngine === 'openrouter'}
                onclick={() => (translateEngine = 'openrouter')}
                disabled={isTranslating}
              >
                ☁ Cloud Gemma 31B
              </button>
              <button
                type="button"
                class="engine-pill"
                class:active={translateEngine === 'ollama'}
                onclick={() => (translateEngine = 'ollama')}
                disabled={isTranslating}
              >
                ⚙ Local Ollama
              </button>
            </div>
          </div>

          <div class="active-doc-banner">
            <div class="active-doc-info">
              <span class="active-label">TARGET DOCUMENT:</span>
              <span class="active-slug">{translateSlug}</span>
            </div>
            <button
              type="button"
              class="btn-run btn-translate-active"
              class:running={isTranslating}
              onclick={startTranslation}
              disabled={isTranslating}
            >
              {isTranslating ? 'TRANSLATING TO MALAYALAM...' : 'TRANSLATE THIS DOCUMENT ➔'}
            </button>
          </div>
        </div>

        {#if translateSuccess}
          <div class="success-banner translate-success">
            <div class="success-text">
              ✓ <strong>TRANSLATION COMPLETED!</strong> Stored in <code>src/content/translations/ml/{translateSlug}.md</code> and indexed in <code>data/manifest.json</code>.
            </div>
            <a
              href="/docs/{translateSlug}?lang=ml"
              class="btn-view-doc"
              onclick={onclose}
            >
              OPEN IN READER (MALAYALAM / BILINGUAL) ➔
            </a>
          </div>
        {/if}

        <!-- Terminal Output Stream -->
        <div class="terminal-shell">
          <div class="terminal-bar">
            <span>TRANSLATION IPC STREAM // stdout & stderr</span>
            {#if translateLogs}
              <button type="button" class="btn-clear" onclick={() => (translateLogs = '')}>CLEAR</button>
            {/if}
          </div>
          <pre class="terminal-pre"><code>{translateLogs || 'Select any document from the queue below and click "TRANSLATE THIS DOCUMENT".'}</code></pre>
        </div>

        <!-- Catalog Queue Filter & Table -->
        <div class="catalog-section">
          <div class="catalog-controls">
            <div class="filter-tabs">
              <button
                type="button"
                class="filter-tab"
                class:active={catalogFilter === 'pending'}
                onclick={() => (catalogFilter = 'pending')}
              >
                PENDING ({catalogData?.pending ?? '...'})
              </button>
              <button
                type="button"
                class="filter-tab"
                class:active={catalogFilter === 'all'}
                onclick={() => (catalogFilter = 'all')}
              >
                ALL DOCUMENTS ({catalogData?.total ?? '...'})
              </button>
              <button
                type="button"
                class="filter-tab"
                class:active={catalogFilter === 'completed'}
                onclick={() => (catalogFilter = 'completed')}
              >
                COMPLETED ({catalogData?.completed ?? '...'})
              </button>
            </div>

            <div class="search-box">
              <input
                type="text"
                placeholder="Search documents by title or slug..."
                bind:value={catalogSearch}
                class="search-input"
              />
            </div>
          </div>

          <div class="table-container">
            <table class="catalog-table">
              <thead>
                <tr>
                  <th style="width: 105px;">DATE</th>
                  <th>TITLE / SLUG</th>
                  <th style="width: 130px;">MALAYALAM</th>
                  <th style="width: 130px; text-align: right;">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {#if filteredDocs.length === 0}
                  <tr>
                    <td colspan="4" class="empty-cell">
                      {isLoadingCatalog ? 'Loading documents...' : 'No matching documents found.'}
                    </td>
                  </tr>
                {:else}
                  {#each filteredDocs as doc (doc.slug)}
                    <tr class:selected={translateSlug === doc.slug}>
                      <td class="date-cell">{doc.date || '—'}</td>
                      <td class="title-cell">
                        <button
                          type="button"
                          class="doc-title-btn"
                          onclick={() => (translateSlug = doc.slug)}
                          title="Select document"
                        >
                          <span class="doc-title">{doc.title}</span>
                          <span class="doc-slug">{doc.slug}</span>
                        </button>
                      </td>
                      <td class="status-cell">
                        {#if doc.status === 'completed'}
                          <span class="badge badge-completed">
                            ● TRANSLATED
                            {#if doc.engine}
                              <small>({doc.engine.toUpperCase()})</small>
                            {/if}
                          </span>
                        {:else}
                          <span class="badge badge-pending">○ PENDING</span>
                        {/if}
                      </td>
                      <td class="action-cell">
                        {#if doc.status === 'completed'}
                          <a
                            href="/docs/{doc.slug}?lang=ml"
                            class="btn-row-action btn-view"
                            onclick={onclose}
                          >
                            READ ➔
                          </a>
                        {:else}
                          <button
                            type="button"
                            class="btn-row-action btn-trans-row"
                            onclick={() => {
                              translateSlug = doc.slug;
                              startTranslation();
                            }}
                            disabled={isTranslating}
                          >
                            TRANSLATE
                          </button>
                        {/if}
                      </td>
                    </tr>
                  {/each}
                {/if}
              </tbody>
            </table>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(18, 18, 18, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    padding: 1.5rem;
    backdrop-filter: blur(2px);
  }

  .modal-dialog {
    background-color: var(--color-paper-light);
    border: var(--border-heavy);
    box-shadow: var(--shadow-hard-lg);
    width: 100%;
    max-width: 860px;
    max-height: 92vh;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  .modal-header {
    background-color: var(--color-black);
    color: #FFFFFF;
    padding: 0.85rem 1.25rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 3px solid var(--color-red-primary);
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .header-badge {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--color-gold);
    letter-spacing: 0.08em;
  }

  .tab-pills {
    display: flex;
    gap: 0.4rem;
  }

  .tab-pill {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.3rem 0.65rem;
    border: 1px solid var(--color-gold);
    background-color: transparent;
    color: #FFFFFF;
    cursor: pointer;
    transition: all 0.1s ease;
  }

  .tab-pill.active {
    background-color: var(--color-gold);
    color: var(--color-black);
  }

  .close-btn {
    background: transparent;
    border: none;
    color: #FFFFFF;
    font-size: 1.25rem;
    cursor: pointer;
    font-weight: 700;
  }

  .close-btn:hover {
    color: var(--color-red-primary);
  }

  .modal-body {
    padding: 1.75rem;
  }

  .modal-title {
    font-size: 1.4rem;
    font-weight: 700;
    margin: 0 0 0.5rem;
    color: var(--color-black);
  }

  .modal-deck {
    font-size: 0.9rem;
    color: var(--color-gray-dark);
    margin: 0 0 1.5rem;
    line-height: 1.5;
  }

  .modal-deck code {
    font-family: var(--font-mono);
    background-color: var(--color-paper-dark);
    padding: 0.15rem 0.35rem;
    border: 1px solid var(--color-gray-light);
  }

  .form-grid {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    margin-bottom: 1.5rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .form-group label {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--color-black);
  }

  .form-select,
  .form-input {
    font-family: inherit;
    font-size: 0.95rem;
    padding: 0.65rem;
    border: 2px solid var(--color-black);
    background-color: #FFFFFF;
    box-shadow: var(--shadow-hard-sm);
  }

  .field-hint {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--color-gray-dark);
  }

  .form-row {
    display: flex;
    gap: 1.5rem;
    align-items: flex-end;
  }

  .half {
    flex: 1;
  }

  .checkbox-group {
    padding-bottom: 0.6rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-family: var(--font-display);
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
  }

  .checkbox-label input {
    width: 1.25rem;
    height: 1.25rem;
    accent-color: var(--color-red-primary);
  }

  .manifest-status-banner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    padding: 0.65rem 0.85rem;
    margin-bottom: 1.25rem;
    background-color: var(--color-paper-dark);
    border: 2px solid var(--color-black);
    box-shadow: var(--shadow-hard-sm);
    font-family: var(--font-mono);
    font-size: 0.8rem;
  }

  .manifest-badge {
    background-color: var(--color-black);
    color: #FFFFFF;
    padding: 0.2rem 0.5rem;
    font-weight: 700;
    font-size: 0.75rem;
  }

  .manifest-latest {
    color: var(--color-black);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 480px;
  }

  .action-strip {
    margin-bottom: 1.5rem;
  }

  .btn-run {
    width: 100%;
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    padding: 0.85rem;
    background-color: var(--color-red-primary);
    color: #FFFFFF;
    border: 2px solid var(--color-black);
    cursor: pointer;
    box-shadow: var(--shadow-hard-md);
    transition: all 0.1s ease;
  }

  .btn-run:hover:not(:disabled) {
    background-color: var(--color-red-dark);
    transform: translate(-1px, -1px);
    box-shadow: var(--shadow-hard-lg);
  }

  .btn-run.running {
    background-color: var(--color-black);
    cursor: wait;
  }

  .btn-embed {
    background-color: var(--color-black);
    border-color: var(--color-gold);
    color: var(--color-gold);
  }

  .btn-embed:hover:not(:disabled) {
    background-color: var(--color-gold);
    color: var(--color-black);
  }

  .success-banner {
    background-color: #E8F5E9;
    border: 2px solid #2E7D32;
    color: #1B5E20;
    padding: 0.75rem 1rem;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    font-weight: 700;
    margin-bottom: 1rem;
  }

  /* Post-Sync Dialogue Banner */
  .post-sync-dialogue {
    margin-top: 1.5rem;
    background-color: #FFF9E6;
    border: 3px solid var(--color-gold);
    box-shadow: var(--shadow-hard-md);
    padding: 1.25rem;
    animation: fadeIn 0.2s ease-in-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .dialogue-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .dialogue-icon {
    color: var(--color-red-primary);
    font-size: 1.25rem;
    font-weight: 700;
  }

  .dialogue-title {
    font-family: var(--font-mono);
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--color-black);
    letter-spacing: 0.05em;
  }

  .dialogue-desc {
    font-size: 0.9rem;
    line-height: 1.5;
    color: var(--color-charcoal);
    margin: 0 0 1rem;
  }

  .dialogue-actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .btn-dialogue-confirm {
    background-color: var(--color-red-primary);
    color: #FFFFFF;
    font-family: var(--font-display);
    font-size: 0.85rem;
    font-weight: 700;
    padding: 0.6rem 1rem;
    border: 2px solid var(--color-black);
    box-shadow: var(--shadow-hard-sm);
    cursor: pointer;
    transition: all 0.1s ease;
  }

  .btn-dialogue-confirm:hover {
    background-color: var(--color-red-dark);
    transform: translate(-1px, -1px);
    box-shadow: var(--shadow-hard-md);
  }

  .btn-dialogue-cancel {
    background-color: var(--color-paper-light);
    color: var(--color-black);
    font-family: var(--font-mono);
    font-size: 0.8rem;
    font-weight: 700;
    padding: 0.6rem 0.85rem;
    border: 1.5px solid var(--color-black);
    cursor: pointer;
  }

  /* Terminal */
  .terminal-shell {
    background-color: #121212;
    border: 2px solid var(--color-black);
    box-shadow: var(--shadow-hard-md);
  }

  .terminal-bar {
    background-color: #242424;
    color: #D5D5D5;
    padding: 0.4rem 0.75rem;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #333333;
  }

  .btn-clear {
    background: transparent;
    border: 1px solid #555555;
    color: #CCCCCC;
    font-size: 0.65rem;
    padding: 0.1rem 0.4rem;
    cursor: pointer;
  }

  .terminal-pre {
    margin: 0;
    padding: 1rem;
    max-height: 250px;
    overflow-y: auto;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    line-height: 1.5;
    color: #33FF33;
    white-space: pre-wrap;
    word-break: break-all;
  }

  /* Translate Tab Specifics */
  .translate-tab-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  .btn-refresh-models {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.4rem 0.75rem;
    background-color: var(--color-paper-dark);
    border: 2px solid var(--color-black);
    box-shadow: var(--shadow-hard-sm);
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.1s ease;
  }

  .btn-refresh-models:hover:not(:disabled) {
    background-color: var(--color-gold);
  }

  .model-matrix {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .model-card {
    background-color: #FFFFFF;
    border: 2px solid var(--color-black);
    box-shadow: var(--shadow-hard-sm);
    padding: 0.75rem 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .model-card.featured-model-card {
    border: 2px solid var(--color-red-primary);
    background-color: #FFFDF9;
  }

  .model-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px dashed var(--color-gray-light);
    padding-bottom: 0.35rem;
  }

  .model-tag {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--color-gray-dark);
    letter-spacing: 0.05em;
  }

  .status-badge {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 700;
    color: #999999;
  }

  .status-badge.online {
    color: #008800;
  }

  .model-name {
    font-family: var(--font-mono);
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--color-black);
  }

  .model-desc {
    font-size: 0.75rem;
    color: var(--color-gray-dark);
    line-height: 1.35;
  }

  .model-note {
    font-size: 0.7rem;
    color: #555555;
    background-color: #FFF9E6;
    border: 1px solid var(--color-gold);
    padding: 0.3rem 0.4rem;
    margin-top: 0.2rem;
    line-height: 1.3;
  }

  .readonly-input {
    background-color: var(--color-paper-dark) !important;
    color: var(--color-black);
    font-weight: 600;
    cursor: default;
  }

  .btn-translate {
    background-color: var(--color-red-primary);
  }

  .btn-translate:hover:not(:disabled) {
    background-color: var(--color-red-dark);
  }

  .translate-success {
    background-color: #E6F4EA;
    border: 2px solid #137333;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    margin-bottom: 1rem;
    box-shadow: var(--shadow-hard-sm);
  }

  .success-text {
    font-size: 0.85rem;
    color: #137333;
    line-height: 1.4;
  }

  .btn-view-doc {
    display: inline-block;
    align-self: flex-start;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    font-weight: 700;
    background-color: var(--color-black);
    color: #FFFFFF;
    text-decoration: none;
    padding: 0.55rem 0.85rem;
    border: 2px solid var(--color-black);
    box-shadow: var(--shadow-hard-sm);
    transition: transform 0.1s ease;
  }

  .btn-view-doc:hover {
    transform: translate(-1px, -1px);
    box-shadow: var(--shadow-hard-md);
  }

  /* Catalog Queue & Console Styles */
  .header-action-group {
    display: flex;
    gap: 0.5rem;
  }

  .catalog-summary-bar {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    background-color: var(--color-black);
    color: #FFFFFF;
    border: 2px solid var(--color-black);
    margin-bottom: 1.25rem;
    box-shadow: var(--shadow-hard-sm);
  }

  .summary-metric {
    display: flex;
    flex-direction: column;
    padding: 0.65rem 0.85rem;
    border-right: 1px solid #333333;
  }

  .summary-metric:last-child {
    border-right: none;
  }

  .metric-label {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    color: #AAAAAA;
    letter-spacing: 0.05em;
  }

  .metric-val {
    font-family: var(--font-mono);
    font-size: 1.25rem;
    font-weight: 700;
    color: #FFFFFF;
  }

  .metric-pending .metric-val {
    color: var(--color-gold);
  }

  .metric-completed .metric-val {
    color: #33FF33;
  }

  .metric-pct .metric-val {
    color: #55CCFF;
  }

  /* Active Runner Panel */
  .runner-panel {
    background-color: #FFFFFF;
    border: 2px solid var(--color-black);
    box-shadow: var(--shadow-hard-sm);
    padding: 0.85rem 1rem;
    margin-bottom: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .runner-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px dashed var(--color-gray-light);
    padding-bottom: 0.5rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .runner-tag {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--color-red-primary);
  }

  .engine-pills {
    display: flex;
    gap: 0.4rem;
  }

  .engine-pill {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.25rem 0.6rem;
    border: 1.5px solid var(--color-black);
    background-color: var(--color-paper-light);
    color: var(--color-black);
    cursor: pointer;
    transition: all 0.1s ease;
  }

  .engine-pill.active {
    background-color: var(--color-black);
    color: #FFFFFF;
  }

  .active-doc-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .active-doc-info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    flex: 1;
    min-width: 250px;
  }

  .active-label {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    font-weight: 700;
    color: var(--color-gray-dark);
  }

  .active-slug {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--color-black);
    word-break: break-all;
  }

  .btn-translate-active {
    width: auto;
    padding: 0.65rem 1.25rem;
    font-size: 0.85rem;
    white-space: nowrap;
  }

  /* Catalog Section */
  .catalog-section {
    margin-top: 1.5rem;
    border-top: 2px solid var(--color-black);
    padding-top: 1rem;
  }

  .catalog-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.75rem;
    flex-wrap: wrap;
  }

  .filter-tabs {
    display: flex;
    gap: 0.35rem;
  }

  .filter-tab {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.3rem 0.65rem;
    border: 1.5px solid var(--color-black);
    background-color: var(--color-paper-light);
    color: var(--color-black);
    cursor: pointer;
    transition: all 0.1s ease;
  }

  .filter-tab.active {
    background-color: var(--color-red-primary);
    border-color: var(--color-red-primary);
    color: #FFFFFF;
  }

  .search-box {
    flex: 1;
    min-width: 220px;
    max-width: 320px;
  }

  .search-input {
    width: 100%;
    font-family: inherit;
    font-size: 0.8rem;
    padding: 0.35rem 0.6rem;
    border: 1.5px solid var(--color-black);
    background-color: #FFFFFF;
  }

  /* Catalog Table */
  .table-container {
    max-height: 380px;
    overflow-y: auto;
    border: 2px solid var(--color-black);
    background-color: #FFFFFF;
    box-shadow: var(--shadow-hard-sm);
  }

  .catalog-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
    text-align: left;
  }

  .catalog-table th {
    position: sticky;
    top: 0;
    background-color: var(--color-paper-dark);
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--color-black);
    padding: 0.5rem 0.75rem;
    border-bottom: 2px solid var(--color-black);
    z-index: 10;
  }

  .catalog-table td {
    padding: 0.55rem 0.75rem;
    border-bottom: 1px solid var(--color-paper-dark);
    vertical-align: middle;
  }

  .catalog-table tr:hover {
    background-color: #FFFDF0;
  }

  .catalog-table tr.selected {
    background-color: #FFF6E0;
    border-left: 3px solid var(--color-gold);
  }

  .date-cell {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--color-gray-dark);
    white-space: nowrap;
  }

  .doc-title-btn {
    all: unset;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    width: 100%;
    text-align: left;
  }

  .doc-title {
    font-family: var(--font-display);
    font-weight: 700;
    color: var(--color-black);
    line-height: 1.25;
  }

  .doc-slug {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    color: var(--color-gray-dark);
    word-break: break-all;
  }

  .badge {
    display: inline-block;
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 700;
    padding: 0.15rem 0.45rem;
    border-radius: 2px;
    white-space: nowrap;
  }

  .badge-pending {
    border: 1px solid #D32F2F;
    color: #D32F2F;
    background-color: #FFEBEE;
  }

  .badge-completed {
    border: 1px solid #2E7D32;
    color: #1B5E20;
    background-color: #E8F5E9;
  }

  .badge-completed small {
    font-size: 0.58rem;
    opacity: 0.85;
  }

  .action-cell {
    text-align: right;
  }

  .btn-row-action {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 700;
    padding: 0.25rem 0.6rem;
    border: 1.5px solid var(--color-black);
    cursor: pointer;
    display: inline-block;
    text-decoration: none;
    transition: all 0.1s ease;
  }

  .btn-trans-row {
    background-color: var(--color-red-primary);
    color: #FFFFFF;
  }

  .btn-trans-row:hover:not(:disabled) {
    background-color: var(--color-red-dark);
    transform: translate(-1px, -1px);
  }

  .btn-view {
    background-color: var(--color-paper-light);
    color: var(--color-black);
  }

  .btn-view:hover {
    background-color: var(--color-black);
    color: #FFFFFF;
  }

  .empty-cell {
    text-align: center;
    padding: 2rem !important;
    font-family: var(--font-mono);
    color: var(--color-gray-dark);
  }
</style>
