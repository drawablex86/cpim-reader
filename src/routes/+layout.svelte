<script lang="ts">
  import { dev } from '$app/environment';
  import DevPipelineModal from '$lib/components/DevPipelineModal.svelte';

  let { children } = $props();
  let showDevModal = $state(false);
  let devModalTab = $state<'sync' | 'embed' | 'translate'>('sync');
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
        <div class="dev-btn-group">
          <button
            type="button"
            class="btn-trigger-pipeline btn-sync"
            onclick={() => {
              devModalTab = 'sync';
              showDevModal = true;
            }}
          >
            ⚙ INITIATE SYNC ➔
          </button>
          <button
            type="button"
            class="btn-trigger-pipeline btn-embed"
            onclick={() => {
              devModalTab = 'embed';
              showDevModal = true;
            }}
          >
            ⬡ VECTOR EMBEDDING ➔
          </button>
          <button
            type="button"
            class="btn-trigger-pipeline btn-translate"
            onclick={() => {
              devModalTab = 'translate';
              showDevModal = true;
            }}
          >
            🌐 TRANSLATE (MALAYALAM DEV) ➔
          </button>
        </div>
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
    <DevPipelineModal initialTab={devModalTab} onclose={() => (showDevModal = false)} />
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
          <strong>CPI(M) DOCUMENT ARCHIVE & RESEARCH REPOSITORY</strong>
          <p>
            An open research archive preserving unabridged Central Committee resolutions,
            Party Congress declarations, and ideological documents published at <code>https://cpim.org/</code>.
          </p>
        </div>
      </div>
      <div class="footer-right">
        <div class="footer-meta-block">
          <span class="meta-label">COLLECTION</span>
          <span class="meta-val">Central Committee & Party Congress</span>
        </div>
        <div class="footer-meta-block">
          <span class="meta-label">CITATION TOOLS</span>
          <span class="meta-val">BibTeX, APA, Chicago & MLA</span>
        </div>
        <div class="footer-meta-block">
          <span class="meta-label">ORIGINAL RECORDS</span>
          <span class="meta-val">Verified against Official Press Scans</span>
        </div>
      </div>
    </div>
    <div class="footer-bottom-bar">
      <span>OFFICIAL CPI(M) ARCHIVAL RECORDS • HISTORICAL MATERIALS HELD IN PUBLIC TRUST</span>
      <span>PUBLIC RESEARCH ARCHIVE</span>
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

  .dev-btn-group {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  .btn-trigger-pipeline {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 0.28rem 0.75rem;
    cursor: pointer;
    box-shadow: 2px 2px 0px rgba(0, 0, 0, 0.5);
    transition: all 0.1s ease;
  }

  .btn-trigger-pipeline.btn-sync {
    background-color: var(--color-red-primary);
    color: #FFFFFF;
    border: 1px solid #FFFFFF;
  }

  .btn-trigger-pipeline.btn-sync:hover {
    background-color: var(--color-red-dark);
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0px rgba(0, 0, 0, 0.7);
  }

  .btn-trigger-pipeline.btn-embed {
    background-color: var(--color-gold);
    color: var(--color-black);
    border: 1px solid var(--color-black);
  }

  .btn-trigger-pipeline.btn-embed:hover {
    background-color: #d8a005;
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0px rgba(0, 0, 0, 0.7);
  }

  .btn-trigger-pipeline.btn-translate {
    background-color: #1a472a;
    color: #FFFFFF;
    border: 1px solid #FFFFFF;
  }

  .btn-trigger-pipeline.btn-translate:hover {
    background-color: #235d37;
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
    position: sticky;
    top: 0;
    z-index: 200;
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
    .masthead {
      padding: 0.6rem 1rem;
    }

    .masthead-inner {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }

    /* Keep the sticky bar short on phones: drop the stamps and the
       long-form subtitle, retain branding + navigation. */
    .edition-stamp,
    .archive-subtitle {
      display: none;
    }

    .logo-box {
      font-size: 1rem;
      padding: 0.3rem 0.5rem;
    }

    .party-name {
      font-size: 0.9rem;
    }

    .nav-item {
      font-size: 0.75rem;
      padding: 0.35rem 0.6rem;
    }

    .footer-inner {
      flex-direction: column;
    }
  }
</style>
