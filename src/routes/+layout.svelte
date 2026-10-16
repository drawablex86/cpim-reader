<script lang="ts">
  import { dev } from '$app/environment';
  import DevPipelineModal from '$lib/components/DevPipelineModal.svelte';

  let { children } = $props();
  let showDevModal = $state(false);
</script>

<div class="app-shell">
  <!-- Dev-Only Pipeline Control Ribbon (Stripped in Production Build) -->
  {#if dev}
    <div class="dev-control-ribbon">
      <div class="dev-ribbon-inner">
        <div class="dev-badge-group">
          <span class="dev-pill">⚡ DEV ENVIRONMENT</span>
          <span class="dev-text">LOCAL PIPELINE CONTROL (EXCLUDED FROM PRODUCTION BUILD)</span>
        </div>
        <button
          type="button"
          class="btn-trigger-pipeline"
          onclick={() => (showDevModal = true)}
        >
          ⚙ INITIATE PIPELINE (SYNC) ➔
        </button>
      </div>
    </div>
  {/if}

  <!-- Top Cadmium / Revolutionary Red Accent Bar -->
  <div class="top-accent-bar" aria-hidden="true"></div>

  <!-- Constructivist Masthead Header -->
  <header class="masthead">
    <div class="masthead-inner">
      <div class="brand-cluster">
        <a href="/" class="brand-logo" aria-label="Home - CPI(M) Documents Archive">
          <div class="logo-box">
            <span class="logo-text">CPIM</span>
          </div>
          <div class="brand-text">
            <span class="party-name">COMMUNIST PARTY OF INDIA (MARXIST)</span>
            <span class="archive-subtitle">OFFICIAL DOCUMENTS ARCHIVE // RESEARCH REPOSITORY</span>
          </div>
        </a>
      </div>

      <div class="masthead-controls">
        <div class="edition-stamp">
          <span class="stamp-label">CATALOG</span>
          <span class="stamp-value">2008 – 2026</span>
        </div>
        <div class="edition-stamp highlight">
          <span class="stamp-label">EDITION</span>
          <span class="stamp-value">STATIC ARCHIVE</span>
        </div>
        <nav class="nav-links">
          <a href="/" class="nav-item">CATALOG</a>
          <a href="https://cpim.org/documents/" target="_blank" rel="noopener noreferrer" class="nav-item external">
            LIVE SOURCE ↗
          </a>
        </nav>
      </div>
    </div>
  </header>

  <!-- Dev Pipeline Modal (Dev Only) -->
  {#if dev && showDevModal}
    <DevPipelineModal onclose={() => (showDevModal = false)} />
  {/if}

  <!-- Main Viewport Content -->
  <main class="main-content">
    {@render children()}
  </main>

  <!-- Constructivist Industrial Footer -->
  <footer class="app-footer">
    <div class="footer-inner">
      <div class="footer-left">
        <div class="footer-manifesto">
          <strong>CPI(M) DOCUMENT ARCHIVE & RESEARCH ENVIRONMENT</strong>
          <p>
            An offline-capable, high-density archival research tool preserving Central Committee,
            Party Congress, and ideological resolutions published at <code>https://cpim.org/</code>.
          </p>
        </div>
      </div>
      <div class="footer-right">
        <div class="footer-meta-block">
          <span class="meta-label">EXTRACTION ENGINE</span>
          <span class="meta-val">Hybrid PyMuPDF / VLM / Svelte 5</span>
        </div>
        <div class="footer-meta-block">
          <span class="meta-label">FULL-TEXT SEARCH</span>
          <span class="meta-val">Client-Side WASM (Pagefind)</span>
        </div>
        <div class="footer-meta-block">
          <span class="meta-label">DESIGN MOTIF</span>
          <span class="meta-val">Soviet Constructivist & Editorial Prose</span>
        </div>
      </div>
    </div>
    <div class="footer-bottom-bar">
      <span>OFFICIAL CPI(M) ARCHIVAL RECORDS • HISTORICAL MATERIALS HELD IN PUBLIC TRUST</span>
      <span>OFFLINE STATIC BUILD</span>
    </div>
  </footer>
</div>

<style>
  .app-shell {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background-color: var(--color-paper);
    color: var(--color-black);
  }

  /* Dev Control Ribbon */
  .dev-control-ribbon {
    background-color: var(--color-black);
    color: #FFFFFF;
    border-bottom: 2px solid var(--color-gold);
    padding: 0.45rem 1.5rem;
  }

  .dev-ribbon-inner {
    max-width: 1400px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .dev-badge-group {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-family: var(--font-mono);
  }

  .dev-pill {
    background-color: var(--color-gold);
    color: var(--color-black);
    font-weight: 700;
    font-size: 0.7rem;
    letter-spacing: 0.08em;
    padding: 0.15rem 0.45rem;
  }

  .dev-text {
    font-size: 0.75rem;
    color: #CCCCCC;
    letter-spacing: 0.04em;
  }

  .btn-trigger-pipeline {
    background-color: var(--color-red-primary);
    color: #FFFFFF;
    border: 1px solid #FFFFFF;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 0.25rem 0.75rem;
    cursor: pointer;
    box-shadow: 2px 2px 0px rgba(0, 0, 0, 0.5);
    transition: all 0.1s ease;
  }

  .btn-trigger-pipeline:hover {
    background-color: var(--color-red-dark);
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0px rgba(0, 0, 0, 0.7);
  }

  .top-accent-bar {
    height: 6px;
    background-color: var(--color-red-primary);
    width: 100%;
  }

  .masthead {
    background-color: var(--color-paper);
    border-bottom: var(--border-heavy);
    padding: 1rem 1.5rem;
  }

  .masthead-inner {
    max-width: 1400px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1.25rem;
  }

  .brand-cluster {
    display: flex;
    align-items: center;
  }

  .brand-logo {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    text-decoration: none;
    color: var(--color-black);
  }

  .logo-box {
    background-color: var(--color-red-primary);
    color: #FFFFFF;
    font-weight: 700;
    font-size: 1.15rem;
    letter-spacing: 0.08em;
    padding: 0.4rem 0.65rem;
    border: 2px solid var(--color-black);
    box-shadow: 2px 2px 0px var(--color-black);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .brand-text {
    display: flex;
    flex-direction: column;
  }

  .party-name {
    font-weight: 700;
    font-size: 1.1rem;
    letter-spacing: 0.04em;
    line-height: 1.2;
    color: var(--color-black);
  }

  .archive-subtitle {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--color-red-primary);
    margin-top: 0.15rem;
  }

  .masthead-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .edition-stamp {
    display: flex;
    flex-direction: column;
    padding: 0.25rem 0.6rem;
    border: 1px solid var(--color-black);
    background-color: var(--color-paper-light);
    font-family: var(--font-mono);
  }

  .edition-stamp.highlight {
    background-color: var(--color-black);
    color: #FFFFFF;
  }

  .edition-stamp.highlight .stamp-label {
    color: var(--color-gold);
  }

  .stamp-label {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: var(--color-gray-dark);
  }

  .stamp-value {
    font-size: 0.8rem;
    font-weight: 700;
  }

  .nav-links {
    display: flex;
    gap: 0.5rem;
  }

  .nav-item {
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 0.4rem 0.85rem;
    border: 2px solid var(--color-black);
    background-color: var(--color-paper-light);
    color: var(--color-black);
    box-shadow: var(--shadow-hard-sm);
    transition: all 0.1s ease;
  }

  .nav-item:hover {
    background-color: var(--color-black);
    color: #FFFFFF;
    transform: translate(-1px, -1px);
    box-shadow: var(--shadow-hard-md);
  }

  .nav-item.external {
    color: var(--color-red-primary);
  }

  .nav-item.external:hover {
    color: #FFFFFF;
    background-color: var(--color-red-primary);
  }

  .main-content {
    flex: 1;
  }

  /* Footer */
  .app-footer {
    background-color: var(--color-black);
    color: var(--color-paper-light);
    border-top: 4px solid var(--color-red-primary);
    margin-top: 4rem;
  }

  .footer-inner {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2.5rem 1.5rem 2rem;
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 2rem;
  }

  .footer-left {
    max-width: 500px;
  }

  .footer-manifesto strong {
    font-size: 1rem;
    letter-spacing: 0.05em;
    color: #FFFFFF;
    display: block;
    margin-bottom: 0.5rem;
  }

  .footer-manifesto p {
    font-size: 0.85rem;
    line-height: 1.6;
    color: #C0C0C0;
    margin: 0;
  }

  .footer-manifesto code {
    font-family: var(--font-mono);
    color: var(--color-gold);
  }

  .footer-right {
    display: flex;
    gap: 2rem;
    flex-wrap: wrap;
  }

  .footer-meta-block {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-family: var(--font-mono);
  }

  .meta-label {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--color-red-primary);
  }

  .meta-val {
    font-size: 0.85rem;
    color: #ECECEC;
  }

  .footer-bottom-bar {
    max-width: 1400px;
    margin: 0 auto;
    padding: 1rem 1.5rem;
    border-top: 1px solid #282828;
    display: flex;
    justify-content: space-between;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: #888888;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  @media (max-width: 768px) {
    .masthead-inner {
      flex-direction: column;
      align-items: flex-start;
    }
    .footer-inner {
      flex-direction: column;
    }
  }
</style>
