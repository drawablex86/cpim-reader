<script lang="ts">
  import type { DocumentMeta } from '$lib/documents';

  let {
    doc,
    currentUrl,
    sectionTitle = '',
    onclose
  } = $props<{
    doc: DocumentMeta;
    currentUrl: string;
    sectionTitle?: string;
    onclose?: () => void;
  }>();

  let activeFormat = $state<'APA' | 'MLA' | 'Chicago' | 'BibTeX'>('APA');
  let copiedFormat = $state<string | null>(null);

  const parsedDate = $derived(new Date(doc.date));
  const year = $derived(isNaN(parsedDate.getFullYear()) ? '2026' : parsedDate.getFullYear());
  const formattedDate = $derived(
    isNaN(parsedDate.getTime())
      ? doc.date
      : parsedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  );
  const author = $derived(doc.author || 'Central Committee, Communist Party of India (Marxist)');
  const fullTitle = $derived(sectionTitle ? `${doc.title} (Section: ${sectionTitle})` : doc.title);

  const citations = $derived({
    APA: `${author}. (${year}, ${formattedDate}). ${fullTitle} [Official Party Document, ${doc.category}]. Communist Party of India (Marxist). ${currentUrl}`,
    MLA: `${author}. "${fullTitle}." Communist Party of India (Marxist), ${formattedDate}, ${currentUrl}.`,
    Chicago: `${author}. "${fullTitle}." Communist Party of India (Marxist). ${formattedDate}. ${currentUrl}.`,
    BibTeX: `@misc{cpim_${year}_${doc.slug.replace(/[^a-zA-Z0-9_]/g, '_')},
  author = {{${author}}},
  title = {{${fullTitle}}},
  year = {${year}},
  date = {${doc.date}},
  note = {Official Document: ${doc.category}},
  url = {${currentUrl}},
  howpublished = {\\url{${doc.source_pdf_url || currentUrl}}}
}`
  });

  async function copy(format: 'APA' | 'MLA' | 'Chicago' | 'BibTeX') {
    try {
      await navigator.clipboard.writeText(citations[format]);
      copiedFormat = format;
      setTimeout(() => (copiedFormat = null), 2000);
    } catch (e) {
      console.error('Failed to copy citation:', e);
    }
  }

  function downloadBib() {
    const blob = new Blob([citations.BibTeX], { type: 'application/x-bibtex' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.slug}.bib`;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<!-- Backdrop Overlay -->
<div class="modal-backdrop" onclick={onclose} onkeydown={(e) => e.key === 'Escape' && onclose?.()} role="presentation">
  <div
    class="modal-dialog"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="cite-modal-title"
    tabindex="-1"
  >
    <div class="modal-header">
      <div class="header-stamp">ACADEMIC CITATION GENERATOR</div>
      <button type="button" class="close-btn" onclick={onclose} aria-label="Close modal">
        ✕
      </button>
    </div>

    <div class="modal-body">
      <h2 id="cite-modal-title" class="doc-title">{doc.title}</h2>
      <div class="doc-meta-strip">
        <span><strong>DATE:</strong> {doc.date}</span>
        <span><strong>CATEGORY:</strong> {doc.category}</span>
        {#if doc.sha256}
          <span class="hash-tag"><strong>SHA256:</strong> {doc.sha256.slice(0, 10)}...</span>
        {/if}
      </div>

      <!-- Format Tabs -->
      <div class="format-tabs" role="tablist">
        {#each (['APA', 'MLA', 'Chicago', 'BibTeX'] as const) as fmt}
          <button
            type="button"
            role="tab"
            aria-selected={activeFormat === fmt}
            class="tab-btn"
            class:active={activeFormat === fmt}
            onclick={() => (activeFormat = fmt)}
          >
            {fmt}
          </button>
        {/each}
      </div>

      <!-- Citation Display Box -->
      <div class="citation-box">
        <pre class="citation-code"><code>{citations[activeFormat]}</code></pre>
      </div>

      <!-- Actions Strip -->
      <div class="modal-actions">
        <button
          type="button"
          class="action-btn copy-btn"
          onclick={() => copy(activeFormat)}
        >
          {copiedFormat === activeFormat ? '✓ COPIED TO CLIPBOARD' : `COPY ${activeFormat} CITATION`}
        </button>

        <button type="button" class="action-btn bib-btn" onclick={downloadBib}>
          EXPORT .BIB FILE (ZOTERO / LATEX)
        </button>

        {#if doc.source_pdf_url}
          <a
            href={doc.source_pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            class="action-btn pdf-btn"
          >
            ORIGINAL SOURCE PDF ↗
          </a>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(18, 18, 18, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1.5rem;
    backdrop-filter: blur(2px);
  }

  .modal-dialog {
    background-color: var(--color-paper-light);
    border: var(--border-heavy);
    box-shadow: var(--shadow-hard-lg);
    width: 100%;
    max-width: 760px;
    display: flex;
    flex-direction: column;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-header {
    background-color: var(--color-black);
    color: #FFFFFF;
    padding: 0.85rem 1.25rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid var(--color-red-primary);
  }

  .header-stamp {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--color-gold);
  }

  .close-btn {
    background: transparent;
    border: none;
    color: #FFFFFF;
    font-size: 1.25rem;
    cursor: pointer;
    font-weight: 700;
    padding: 0.2rem 0.5rem;
  }

  .close-btn:hover {
    color: var(--color-red-primary);
  }

  .modal-body {
    padding: 1.5rem;
  }

  .doc-title {
    font-size: 1.35rem;
    font-weight: 700;
    margin: 0 0 0.5rem;
    color: var(--color-black);
    line-height: 1.3;
  }

  .doc-meta-strip {
    display: flex;
    gap: 1.25rem;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--color-gray-dark);
    margin-bottom: 1.5rem;
    border-bottom: 1px solid var(--color-gray-light);
    padding-bottom: 0.75rem;
    flex-wrap: wrap;
  }

  .hash-tag {
    color: var(--color-steel);
  }

  .format-tabs {
    display: flex;
    gap: 0.35rem;
    margin-bottom: 1rem;
    border-bottom: 2px solid var(--color-black);
    padding-bottom: 0;
  }

  .tab-btn {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    font-weight: 700;
    padding: 0.5rem 1rem;
    border: 2px solid var(--color-black);
    border-bottom: none;
    background-color: var(--color-paper);
    color: var(--color-black);
    cursor: pointer;
    box-shadow: 2px 0px 0px var(--color-black);
  }

  .tab-btn.active {
    background-color: var(--color-black);
    color: #FFFFFF;
  }

  .tab-btn:hover:not(.active) {
    background-color: var(--color-red-primary);
    color: #FFFFFF;
  }

  .citation-box {
    background-color: #FFFFFF;
    border: 2px solid var(--color-black);
    padding: 1.25rem;
    margin-bottom: 1.5rem;
    box-shadow: var(--shadow-hard-sm);
  }

  .citation-code {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-all;
    color: var(--color-black);
  }

  .modal-actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .action-btn {
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 0.6rem 1.15rem;
    border: 2px solid var(--color-black);
    cursor: pointer;
    box-shadow: var(--shadow-hard-sm);
    transition: all 0.1s ease;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
  }

  .action-btn:hover {
    transform: translate(-1px, -1px);
    box-shadow: var(--shadow-hard-md);
  }

  .copy-btn {
    background-color: var(--color-red-primary);
    color: #FFFFFF;
  }

  .copy-btn:hover {
    background-color: var(--color-red-dark);
  }

  .bib-btn {
    background-color: var(--color-black);
    color: #FFFFFF;
  }

  .pdf-btn {
    background-color: var(--color-paper-dark);
    color: var(--color-black);
  }
</style>