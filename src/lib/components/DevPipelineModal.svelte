<script lang="ts">
  let { onclose, initialTab = 'sync' } = $props<{ onclose: () => void; initialTab?: 'sync' | 'embed' }>();

  // Mode: 'sync' or 'embed'
  let activeTab = $state<'sync' | 'embed'>('sync');

  $effect(() => {
    activeTab = initialTab;
  });

  // Sync state
  let provider = $state<'none' | 'openrouter' | 'ollama'>('none');
  let limit = $state(3);
  let dryRun = $state(false);
  let isRunning = $state(false);
  let terminalLogs = $state('');

  // Embed prompt / state
  let showEmbedPrompt = $state(false);
  let isEmbedding = $state(false);
  let embedLogs = $state('');
  let embedDim = $state(256);
  let embedModel = $state('embeddinggemma-2:270m');
  let embedForce = $state(false);
  let embedSuccess = $state(false);

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

      {:else}
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
</style>
