<script lang="ts">
  import { onMount } from 'svelte';
  import CitationModal from '$lib/components/CitationModal.svelte';
  import SimilarDocuments from '$lib/components/SimilarDocuments.svelte';

  let { data } = $props();

  let showPdfSplit = $state(false);
  let showCiteDrawer = $state(false);
  let readProgress = $state(0);
  let activeHeadingId = $state<string>('');
  let headings = $state<Array<{ id: string; text: string; level: number }>>([]);

  function updateScroll() {
    const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (totalHeight > 0) {
      readProgress = Math.min(100, Math.max(0, (window.scrollY / totalHeight) * 100));
    }
  }

  function scrollToHeading(id: string, e?: MouseEvent) {
    if (e) e.preventDefault();
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      activeHeadingId = id;
      history.pushState(null, '', `#${id}`);
    }
  }

  onMount(() => {
    window.addEventListener('scroll', updateScroll, { passive: true });
    updateScroll();

    // Query headings from rendered markdown prose (support h1, h2, h3)
    const elements = document.querySelectorAll('.markdown-prose h1, .markdown-prose h2, .markdown-prose h3');
    const collected: Array<{ id: string; text: string; level: number }> = [];
    const seenSlugs = new Map<string, number>();

    elements.forEach((el) => {
      const headingEl = el as HTMLElement;
      let rawText = headingEl.innerText.replace(/^#+\s*/, '').trim();

      // Clean markdown formatting if present in text
      rawText = rawText.replace(/\*\*/g, '').replace(/\*/g, '').replace(/__+/g, '').trim();

      // Skip empty or generic document title if it repeats page title at the very top
      if (!rawText) return;
      if (headingEl.tagName === 'H1' && rawText.toLowerCase() === (data.meta.title || '').toLowerCase()) {
        return;
      }

      const level = headingEl.tagName === 'H1' ? 1 : headingEl.tagName === 'H2' ? 2 : 3;

      if (!headingEl.id) {
        const base = rawText
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .trim()
          .replace(/\s+/g, '-');
        const count = seenSlugs.get(base) || 0;
        seenSlugs.set(base, count + 1);
        headingEl.id = count === 0 ? base : `${base}-${count}`;
      } else {
        seenSlugs.set(headingEl.id, (seenSlugs.get(headingEl.id) || 0) + 1);
      }

      collected.push({
        id: headingEl.id,
        text: rawText,
        level
      });
    });

    headings = collected;

    // IntersectionObserver to spy on active section
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            activeHeadingId = entry.target.id;
            break;
          }
        }
      },
      { rootMargin: '-80px 0px -70% 0px' }
    );

    elements.forEach((el) => observer.observe(el));

    // If deep-linked with hash on page load, smooth scroll to it
    if (window.location.hash) {
      const hashId = decodeURIComponent(window.location.hash.substring(1));
      setTimeout(() => {
        const target = document.getElementById(hashId);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          activeHeadingId = hashId;
        }
      }, 150);
    }

    return () => {
      window.removeEventListener('scroll', updateScroll);
      observer.disconnect();
    };
  });
</script>

<svelte:head>
  <title>{data.meta.title} — CPI(M) Official Archive</title>
</svelte:head>

<!-- Sticky Top Reading Progress Bar -->
<div class="reading-progress-track" aria-hidden="true">
  <div class="reading-progress-fill" style={`width: ${readProgress}%`}></div>
</div>

<article class="reader-container" data-pagefind-body>
  <!-- Constructivist Navigation & Document Header -->
  <header class="doc-header">
    <div class="header-inner">
      <div class="nav-breadcrumbs">
        <a href="/" class="back-link">← RETURN TO CATALOG</a>
      </div>

      <div class="meta-strip">
        <span class="badge category" data-pagefind-filter="category">{data.meta.category}</span>
        <time class="meta-item date" datetime={data.meta.date}>{data.meta.date}</time>
        {#if data.meta.page_count}
          <span class="meta-item pages">{data.meta.page_count} PAGES</span>
        {/if}
        {#if data.meta.extraction_method}
          <span class="badge method">{data.meta.extraction_method.toUpperCase()}</span>
        {/if}
      </div>

      <h1 class="document-headline">{data.meta.title}</h1>

      <div class="author-byline">
        <span class="byline-label">OFFICIAL ISSUANCE:</span>
        <span class="byline-text">{data.meta.author || 'Central Committee, Communist Party of India (Marxist)'}</span>
      </div>

      <!-- Action Toolbar -->
      <div class="reader-toolbar">
        {#if data.meta.source_pdf_url}
          <button
            type="button"
            class="tool-btn split-toggle"
            class:active={showPdfSplit}
            onclick={() => (showPdfSplit = !showPdfSplit)}
          >
            {showPdfSplit ? '✕ CLOSE ORIGINAL PDF' : '◫ VERIFY WITH ORIGINAL PDF (SPLIT VIEW)'}
          </button>
        {/if}

        <button
          type="button"
          class="tool-btn cite-toggle"
          class:active={showCiteDrawer}
          onclick={() => (showCiteDrawer = !showCiteDrawer)}
        >
          {showCiteDrawer ? '✕ CLOSE CITATIONS' : '❝ CITE THIS DOCUMENT'}
        </button>

        {#if data.meta.source_pdf_url}
          <a
            href={data.meta.source_pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            class="tool-btn download-pdf"
          >
            DOWNLOAD SOURCE PDF ↗
          </a>
        {/if}

        {#if data.meta.source_post_url}
          <a
            href={data.meta.source_post_url}
            target="_blank"
            rel="noopener noreferrer"
            class="tool-btn view-source"
          >
            CPIM.ORG WEB SOURCE ↗
          </a>
        {/if}
      </div>
    </div>
  </header>

  <!-- Workspace Container: TOC Sidebar + Editorial Prose + Split PDF Pane -->
  <div class="reader-workspace" class:split-active={showPdfSplit}>
    <!-- Sticky Table of Contents & Related Resolutions Sidebar -->
    <aside class="toc-sidebar" aria-label="Table of Contents and Related Documents">
      {#if headings.length > 0}
        <div class="toc-sticky-box">
          <div class="toc-title-stamp">DOCUMENT SECTIONS</div>
          <nav class="toc-list">
            {#each headings as h}
              <a
                href={`#${h.id}`}
                class="toc-item level-{h.level}"
                class:h1-item={h.level === 1}
                class:h2-item={h.level === 2}
                class:h3-indent={h.level === 3}
                class:active={activeHeadingId === h.id}
                onclick={(e) => scrollToHeading(h.id, e)}
              >
                {h.text}
              </a>
            {/each}
          </nav>
        </div>
      {/if}

      <!-- Semantically Similar Resolutions (EmbeddingGemma-2) -->
      <SimilarDocuments currentSlug={data.meta.slug} />
    </aside>

    <!-- Main Editorial Reading Canvas -->
    <main class="reading-canvas">
      <div class="markdown-prose">
        <data.content />
      </div>

      <div class="end-of-document">
        <div class="end-stamp">∎ END OF OFFICIAL ARCHIVAL RESOLUTION ∎</div>
        <p class="end-meta">
          Preserved in the CPI(M) Research Repository under SHA256 integrity hash:
          <code>{data.meta.sha256 || 'verified-record'}</code>
        </p>
      </div>
    </main>

    <!-- Side-by-Side Split View PDF Pane -->
    {#if showPdfSplit && data.meta.source_pdf_url}
      <aside class="pdf-pane" aria-label="Original Source PDF Verification">
        <div class="pdf-pane-header">
          <span class="pdf-pane-title">ORIGINAL SOURCE PDF VERIFICATION</span>
          <button
            type="button"
            class="pdf-close-btn"
            onclick={() => (showPdfSplit = false)}
            aria-label="Close PDF pane"
          >
            ✕
          </button>
        </div>
        <iframe
          src={data.meta.source_pdf_url}
          title="Official Source PDF"
          class="pdf-iframe"
        ></iframe>
      </aside>
    {/if}
  </div>
</article>

<!-- Academic Citation Modal -->
{#if showCiteDrawer}
  <CitationModal
    doc={data.meta}
    currentUrl={`https://cpim.org/documents/${data.meta.slug}`}
    onclose={() => (showCiteDrawer = false)}
  />
{/if}

<style>
  /* Reading Progress Track */
  .reading-progress-track {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: transparent;
    z-index: 999;
  }

  .reading-progress-fill {
    height: 100%;
    background-color: var(--color-red-primary);
    transition: width 0.1s linear;
  }

  .reader-container {
    background-color: var(--color-paper-light);
    min-height: 100vh;
  }

  /* Document Header */
  .doc-header {
    background-color: var(--color-paper);
    border-bottom: var(--border-heavy);
    padding: 2rem 1.5rem 1.5rem;
  }

  .header-inner {
    max-width: 1400px;
    margin: 0 auto;
  }

  .nav-breadcrumbs {
    margin-bottom: 1rem;
  }

  .back-link {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--color-black);
    text-decoration: none;
    border-bottom: 1.5px solid var(--color-black);
    padding-bottom: 0.15rem;
  }

  .back-link:hover {
    color: var(--color-red-primary);
    border-color: var(--color-red-primary);
  }

  .meta-strip {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
  }

  .badge {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.25rem 0.6rem;
    border: 1px solid var(--color-black);
    text-transform: uppercase;
  }

  .badge.category {
    background-color: var(--color-black);
    color: #FFFFFF;
  }

  .badge.method {
    background-color: var(--color-paper-dark);
    color: var(--color-black);
  }

  .meta-item {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-gray-dark);
  }

  .document-headline {
    font-family: var(--font-prose);
    font-size: clamp(2rem, 4vw, 3rem);
    font-weight: 700;
    line-height: 1.2;
    color: var(--color-black);
    margin: 0.5rem 0 1rem;
    max-width: 950px;
  }

  .author-byline {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    color: var(--color-gray-dark);
    margin-bottom: 1.75rem;
  }

  .byline-label {
    font-weight: 700;
    color: var(--color-black);
  }

  .reader-toolbar {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    border-top: 2px solid var(--color-black);
    padding-top: 1.25rem;
  }

  .tool-btn {
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 0.55rem 1.15rem;
    border: 2px solid var(--color-black);
    cursor: pointer;
    background-color: var(--color-paper-light);
    color: var(--color-black);
    box-shadow: var(--shadow-hard-sm);
    transition: all 0.1s ease;
    display: inline-flex;
    align-items: center;
    text-decoration: none;
  }

  .tool-btn:hover {
    transform: translate(-1px, -1px);
    box-shadow: var(--shadow-hard-md);
  }

  .split-toggle {
    background-color: var(--color-black);
    color: #FFFFFF;
  }

  .split-toggle.active {
    background-color: var(--color-red-primary);
    border-color: var(--color-red-dark);
  }

  .cite-toggle {
    background-color: var(--color-paper-light);
  }

  .cite-toggle:hover {
    background-color: var(--color-gold);
  }

  .download-pdf {
    background-color: var(--color-paper-dark);
    color: var(--color-red-primary);
  }

  .view-source {
    background-color: var(--color-paper-light);
    color: var(--color-gray-dark);
  }

  /* Workspace Layout */
  .reader-workspace {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2.5rem 1.5rem 5rem;
    display: grid;
    grid-template-columns: 260px 1fr;
    gap: 3.5rem;
    align-items: start;
    transition: all 0.2s ease;
  }

  .reader-workspace.split-active {
    grid-template-columns: 220px 1fr 1fr;
    gap: 2rem;
  }

  /* Sticky Table of Contents Sidebar */
  .toc-sidebar {
    position: sticky;
    top: 2rem;
    max-height: calc(100vh - 4rem);
    overflow-y: auto;
  }

  .toc-sticky-box {
    background-color: var(--color-paper);
    border: var(--border-medium);
    padding: 1.25rem 1rem;
    box-shadow: var(--shadow-hard-sm);
  }

  .toc-title-stamp {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--color-red-primary);
    margin-bottom: 0.85rem;
    border-bottom: 1px solid var(--color-black);
    padding-bottom: 0.35rem;
  }

  .toc-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .toc-item {
    font-family: var(--font-display);
    font-size: 0.85rem;
    line-height: 1.35;
    color: var(--color-black);
    padding: 0.35rem 0.5rem;
    border-left: 2px solid transparent;
    text-decoration: none;
    transition: all 0.1s ease;
  }

  .toc-item.h1-item {
    font-weight: 700;
    color: var(--color-black);
    margin-top: 0.35rem;
  }

  .toc-item.h2-item {
    padding-left: 0.65rem;
    font-size: 0.82rem;
  }

  .toc-item.h3-indent {
    padding-left: 1.25rem;
    font-size: 0.78rem;
    color: var(--color-gray-dark);
  }

  .toc-item:hover {
    background-color: rgba(196, 30, 58, 0.08);
    color: var(--color-red-primary);
  }

  .toc-item.active {
    border-left-color: var(--color-red-primary);
    background-color: rgba(196, 30, 58, 0.1);
    color: var(--color-red-primary);
    font-weight: 700;
  }

  /* Reading Canvas (Prose Area) */
  .reading-canvas {
    max-width: var(--reader-measure);
    margin: 0 auto;
    width: 100%;
  }

  /* Editorial Markdown Prose Styles */
  :global(.markdown-prose) {
    font-family: var(--font-prose);
    font-size: 1.18rem;
    line-height: var(--reader-line-height);
    color: var(--reader-ink);
  }

  :global(.markdown-prose h1) {
    font-family: var(--font-prose);
    font-size: 2.1rem;
    font-weight: 700;
    line-height: 1.25;
    color: var(--color-black);
    margin: 3.5rem 0 1.25rem;
    border-bottom: 3px solid var(--color-black);
    padding-bottom: 0.5rem;
    scroll-margin-top: 3.5rem;
  }

  :global(.markdown-prose h2) {
    font-family: var(--font-prose);
    font-size: 1.75rem;
    font-weight: 700;
    line-height: 1.3;
    color: var(--color-black);
    margin: 2.75rem 0 1rem;
    border-bottom: 2px solid var(--color-black);
    padding-bottom: 0.35rem;
    scroll-margin-top: 3.5rem;
  }

  :global(.markdown-prose h3) {
    font-family: var(--font-prose);
    font-size: 1.4rem;
    font-weight: 700;
    line-height: 1.35;
    color: var(--color-red-dark);
    margin: 2.25rem 0 0.85rem;
    scroll-margin-top: 3rem;
  }

  :global(.markdown-prose p) {
    margin: 0 0 1.5rem;
    text-align: justify;
    text-justify: inter-word;
  }

  :global(.markdown-prose strong) {
    color: var(--color-black);
    font-weight: 700;
  }

  :global(.markdown-prose blockquote) {
    border-left: 3px solid var(--color-red-primary);
    margin: 2rem 0;
    padding: 0.75rem 1.5rem;
    background-color: var(--color-paper);
    font-style: italic;
  }

  :global(.markdown-prose ul),
  :global(.markdown-prose ol) {
    margin: 0 0 1.75rem;
    padding-left: 1.75rem;
  }

  :global(.markdown-prose li) {
    margin-bottom: 0.65rem;
  }

  :global(.markdown-prose a) {
    color: var(--color-red-primary);
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 3px;
  }

  :global(.markdown-prose a:hover) {
    color: var(--color-red-dark);
  }

  :global(.markdown-prose table) {
    width: 100%;
    border-collapse: collapse;
    margin: 2rem 0;
    font-size: 1rem;
    border: 2px solid var(--color-black);
  }

  :global(.markdown-prose th) {
    background-color: var(--color-black);
    color: #FFFFFF;
    font-weight: 700;
    padding: 0.65rem 0.85rem;
    border: 1px solid #333333;
    font-family: var(--font-display);
    font-size: 0.85rem;
  }

  :global(.markdown-prose td) {
    padding: 0.65rem 0.85rem;
    border: 1px solid var(--color-gray-light);
  }

  /* End of Document Stamp */
  .end-of-document {
    border-top: 3px solid var(--color-black);
    margin-top: 4rem;
    padding-top: 2rem;
    text-align: center;
  }

  .end-stamp {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--color-red-primary);
    margin-bottom: 0.5rem;
  }

  .end-meta {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--color-gray-dark);
    margin: 0;
  }

  .end-meta code {
    background-color: var(--color-paper-dark);
    padding: 0.15rem 0.4rem;
    border: 1px solid var(--color-gray-light);
  }

  /* Split PDF Pane */
  .pdf-pane {
    position: sticky;
    top: 2rem;
    height: calc(100vh - 4rem);
    background-color: var(--color-paper);
    border: var(--border-heavy);
    box-shadow: var(--shadow-hard-md);
    display: flex;
    flex-direction: column;
  }

  .pdf-pane-header {
    background-color: var(--color-black);
    color: #FFFFFF;
    padding: 0.65rem 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .pdf-pane-title {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--color-gold);
  }

  .pdf-close-btn {
    background: transparent;
    border: none;
    color: #FFFFFF;
    font-weight: 700;
    cursor: pointer;
  }

  .pdf-iframe {
    width: 100%;
    flex: 1;
    border: none;
  }

  @media (max-width: 1024px) {
    .reader-workspace {
      grid-template-columns: 1fr;
      gap: 2rem;
    }

    .toc-sidebar {
      display: none; /* Hide TOC sidebar on mobile/tablet */
    }

    .reader-workspace.split-active {
      grid-template-columns: 1fr;
    }

    .pdf-pane {
      position: static;
      height: 600px;
      margin-top: 2rem;
    }
  }
</style>