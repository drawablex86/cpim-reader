<script lang="ts">
  let { onclose } = $props<{ onclose: () => void }>();

  let provider = $state<'none' | 'openrouter' | 'ollama'>('none');
  let limit = $state(3);
  let dryRun = $state(true);
  let isRunning = $state(false);
  let terminalLogs = $state('');

  async function startSync() {
    isRunning = true;
    terminalLogs = 'Connecting to local pipeline runner...\n';

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
        terminalLogs += decoder.decode(value, { stream: true });
      }
    } catch (err: any) {
      terminalLogs += `\n[NETWORK ERROR]: ${err.message}`;
    } finally {
      isRunning = false;
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
      <div class="header-badge">⚡ DEV-ONLY PIPELINE RUNNER</div>
      <button type="button" class="close-btn" onclick={onclose} aria-label="Close modal">✕</button>
    </div>

    <div class="modal-body">
      <h2 id="dev-sync-title" class="modal-title">INITIATE DOCUMENT EXTRACTION PIPELINE</h2>
      <p class="modal-deck">
        Executes <code>scripts/sync.py</code> locally on your machine.
        (This control interface is stripped from static production builds via dead-code elimination).
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
              <span>DRY RUN ONLY (Preview list without writing files)</span>
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
          {isRunning ? 'PIPELINE EXECUTING...' : dryRun ? 'RUN DRY-RUN PREVIEW ➔' : 'INITIATE EXTRACTION BATCH ➔'}
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
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(18, 18, 18, 0.8);
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
    max-width: 820px;
    max-height: 90vh;
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
  }

  .header-badge {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--color-gold);
    letter-spacing: 0.08em;
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
    color: var(--color-red-primary);
  }

  .field-hint code {
    font-weight: 700;
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
    color: #33FF33; /* Classic terminal phosphor green */
    white-space: pre-wrap;
    word-break: break-all;
  }
</style>
