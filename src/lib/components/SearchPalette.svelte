<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { TOPICS, getDocTypeLabel } from '$lib/taxonomy';
  import {
    loadMetadataIndex,
    matchMetadata,
    searchFullText,
    type FullTextHit,
    type SearchableDoc
  } from '$lib/search-index';

  interface Props {
    open?: boolean;
  }

  let { open = $bindable(false) }: Props = $props();

  let query = $state('');
  let documents = $state<SearchableDoc[]>([]);
  let fullText = $state<FullTextHit[]>([]);
  let activeIndex = $state(0);
  let isSearching = $state(false);
  let pagefindState = $state<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');

  let inputEl = $state<HTMLInputElement | null>(null);
  let dialogEl = $state<HTMLDivElement | null>(null);
  let listEl = $state<HTMLDivElement | null>(null);
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let previouslyFocused: HTMLElement | null = null;

  const topicLabels = Object.fromEntries(
    Object.entries(TOPICS).map(([key, value]) => [key, value.label])
  );

  const metaResults = $derived(
    query.trim() ? matchMetadata(documents, query, topicLabels, 8) : []
  );

  type ResultItem = {
    doc: SearchableDoc;
    excerpt?: string;
    source: 'title' | 'text';
  };

  const results = $derived.by<ResultItem[]>(() => {
    if (!query.trim()) return [];

    const items: ResultItem[] = metaResults.map((doc) => ({ doc, source: 'title' }));

    for (const hit of fullText) {
      const existing = items.find((item) => item.doc.slug === hit.slug);
      if (existing) {
        existing.excerpt = hit.excerpt;
        continue;
      }
      const doc = documents.find((candidate) => candidate.slug === hit.slug);
      if (doc) items.push({ doc, excerpt: hit.excerpt, source: 'text' });
    }

    return items.slice(0, 10);
  });

  const fullTextCount = $derived(fullText.length);

  // Pagefind emits <mark> around matches; drop everything else.
  function safeExcerpt(excerpt: string): string {
    return excerpt.replace(/<(?!\/?mark\b)[^>]*>/gi, '');
  }

  function closePalette() {
    open = false;
    query = '';
    fullText = [];
    activeIndex = 0;
  }

  function navigateTo(slug: string) {
    closePalette();
    goto(`/docs/${slug}`);
  }

  function moveActive(delta: number) {
    if (results.length === 0) return;
    activeIndex = (activeIndex + delta + results.length) % results.length;
    tick().then(() => {
      const active = listEl?.querySelector<HTMLElement>('[data-active="true"]');
      active?.scrollIntoView({ block: 'nearest' });
    });
  }

  function handleInputKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActive(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(-1);
    } else if (event.key === 'Enter') {
      const item = results[activeIndex];
      if (item) {
        event.preventDefault();
        navigateTo(item.doc.slug);
      }
    }
  }

  function handleDialogKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closePalette();
      return;
    }

    if (event.key !== 'Tab' || !dialogEl) return;
    const focusable = Array.from(
      dialogEl.querySelectorAll<HTMLElement>('input, a[href], button:not([disabled])')
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  // Load metadata the first time the palette is opened.
  $effect(() => {
    if (!open || documents.length > 0) return;
    loadMetadataIndex().then((docs) => {
      documents = docs;
    });
  });

  // Reset selection whenever the query changes.
  $effect(() => {
    void query;
    activeIndex = 0;
  });

  // Debounced full-text search
  $effect(() => {
    const value = query.trim();

    if (searchTimer) clearTimeout(searchTimer);

    if (!open || value.length < 2) {
      fullText = [];
      isSearching = false;
      return;
    }

    isSearching = true;
    searchTimer = setTimeout(async () => {
      try {
        const hits = await searchFullText(value, 12);
        fullText = hits;
        pagefindState = 'ready';
      } catch {
        fullText = [];
        pagefindState = 'unavailable';
      } finally {
        isSearching = false;
      }
    }, 160);

    return () => {
      if (searchTimer) clearTimeout(searchTimer);
    };
  });

  // Focus, scroll lock and focus restoration while the palette is open
  $effect(() => {
    if (!open) return;

    previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    tick().then(() => inputEl?.focus());

    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  });

  onMount(() => {
    // Warm the metadata index so the first keystroke is instant
    loadMetadataIndex().then((docs) => {
      if (documents.length === 0) documents = docs;
    });
  });
</script>

{#if open}
  <div class="palette-backdrop" onclick={closePalette} role="presentation"></div>
  <div
    class="palette"
    role="dialog"
    aria-modal="true"
    aria-label="Search the archive"
    tabindex="-1"
    bind:this={dialogEl}
    onkeydown={handleDialogKeydown}
  >
    <div class="palette-head">
      <span class="palette-stamp">⌕ SEARCH THE ARCHIVE</span>
      <span class="palette-hint">ESC TO CLOSE</span>
    </div>

    <div class="palette-input-row">
      <span class="input-glyph" aria-hidden="true">⌕</span>
      <input
        bind:this={inputEl}
        bind:value={query}
        class="palette-input"
        type="text"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls="palette-results"
        aria-autocomplete="list"
        aria-activedescendant={results[activeIndex] ? `palette-option-${activeIndex}` : undefined}
        placeholder="Search titles, resolutions, topics, Congresses…"
        autocomplete="off"
        spellcheck="false"
        onkeydown={handleInputKeydown}
      />
      {#if isSearching}
        <span class="input-status" aria-hidden="true">●</span>
      {/if}
    </div>

    <div class="palette-results" id="palette-results" role="listbox" bind:this={listEl}>
      {#if !query.trim()}
        <div class="palette-empty">
          <p class="empty-lead">Search 235 preserved documents</p>
          <ul class="empty-tips">
            <li><code>agrarian crisis</code> — full text of every resolution</li>
            <li><code>24th congress</code> — a Congress cycle</li>
            <li><code>Kerala</code> — by region</li>
          </ul>
        </div>
      {:else if results.length === 0 && !isSearching}
        <div class="palette-empty">
          <p class="empty-lead">No matches for “{query.trim()}”</p>
          <p class="empty-note">
            {#if pagefindState === 'unavailable'}
              Full-text index unavailable in this build — run <code>npm run build</code> to generate it.
            {:else}
              Try a broader term, or browse by Congress and region in the catalog.
            {/if}
          </p>
        </div>
      {:else}
        {#each results as item, index (item.doc.slug)}
          <a
            href={`/docs/${item.doc.slug}`}
            id={`palette-option-${index}`}
            class="result"
            class:active={index === activeIndex}
            data-active={index === activeIndex}
            role="option"
            aria-selected={index === activeIndex}
            onmouseenter={() => (activeIndex = index)}
            onclick={(event) => {
              event.preventDefault();
              navigateTo(item.doc.slug);
            }}
          >
            <div class="result-meta">
              <span class="result-cat">{item.doc.category}</span>
              {#if item.doc.doc_type}
                <span class="result-type">{getDocTypeLabel(item.doc.doc_type).toUpperCase()}</span>
              {/if}
              <time class="result-date" datetime={item.doc.date}>{item.doc.date}</time>
            </div>
            <span class="result-title">{item.doc.title}</span>
            {#if item.excerpt}
              <span class="result-excerpt">{@html safeExcerpt(item.excerpt)}</span>
            {/if}
          </a>
        {/each}
      {/if}
    </div>

    <div class="palette-foot">
      <span class="foot-keys">
        <kbd>↑</kbd><kbd>↓</kbd> navigate · <kbd>↵</kbd> open · <kbd>esc</kbd> close
      </span>
      {#if query.trim()}
        <a class="foot-all" href={`/?q=${encodeURIComponent(query.trim())}`}>
          ALL {Math.max(fullTextCount, results.length)} RESULTS IN CATALOG →
        </a>
      {:else}
        <span class="foot-note">Titles &amp; full text · runs entirely offline</span>
      {/if}
    </div>
  </div>
{/if}

<style>
  .palette-backdrop {
    position: fixed;
    inset: 0;
    z-index: 600;
    background-color: rgba(18, 18, 18, 0.6);
    backdrop-filter: blur(2px);
  }

  .palette {
    position: fixed;
    top: 7vh;
    left: 50%;
    transform: translateX(-50%);
    z-index: 601;
    width: min(760px, calc(100vw - 2rem));
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    background-color: var(--color-paper-light);
    border: var(--border-heavy);
    box-shadow: 8px 8px 0px var(--color-black);
  }

  .palette-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.6rem 0.9rem;
    background-color: var(--color-black);
    border-bottom: 2px solid var(--color-red-primary);
  }

  .palette-stamp {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.09em;
    color: var(--color-gold);
  }

  .palette-hint {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    letter-spacing: 0.08em;
    color: #8f8f8f;
  }

  .palette-input-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.7rem 0.9rem;
    border-bottom: 2px solid var(--color-black);
    background-color: var(--color-paper);
  }

  .input-glyph {
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--color-red-primary);
  }

  .palette-input {
    flex: 1;
    border: none;
    background: transparent;
    outline: none;
    font-family: var(--font-prose);
    font-size: 1.15rem;
    color: var(--color-black);
    min-width: 0;
  }

  .palette-input::placeholder {
    color: var(--color-gray-medium);
    font-style: italic;
  }

  .input-status {
    font-size: 0.7rem;
    color: var(--color-red-primary);
    animation: pulse 0.8s infinite alternate;
  }

  @keyframes pulse {
    0% { opacity: 0.2; }
    100% { opacity: 1; }
  }

  .palette-results {
    overflow-y: auto;
    flex: 1;
    min-height: 120px;
  }

  .result {
    display: block;
    padding: 0.65rem 0.9rem;
    border-bottom: 1px solid var(--color-gray-light);
    border-left: 3px solid transparent;
    cursor: pointer;
  }

  .result:hover,
  .result.active {
    background-color: #ffffff;
    border-left-color: var(--color-red-primary);
  }

  .result-meta {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    flex-wrap: wrap;
    margin-bottom: 0.15rem;
  }

  .result-cat,
  .result-type {
    font-family: var(--font-mono);
    font-size: 0.6rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    padding: 0.08rem 0.3rem;
  }

  .result-cat {
    background-color: var(--color-black);
    color: #ffffff;
  }

  .result-type {
    border: 1px solid var(--color-gray-dark);
    color: var(--color-gray-dark);
  }

  .result-date {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    color: var(--color-gray-medium);
    margin-left: auto;
  }

  .result-title {
    display: block;
    font-family: var(--font-display);
    font-size: 0.95rem;
    font-weight: 700;
    line-height: 1.3;
    color: var(--color-black);
  }

  .result-excerpt {
    display: block;
    margin-top: 0.2rem;
    font-family: var(--font-prose);
    font-size: 0.82rem;
    line-height: 1.45;
    color: var(--reader-ink-secondary);
    font-style: italic;
  }

  .result-excerpt :global(mark) {
    background-color: var(--color-gold-muted);
    color: var(--color-black);
    font-style: normal;
    font-weight: 700;
  }

  .palette-empty {
    padding: 1.4rem 1rem;
  }

  .empty-lead {
    margin: 0 0 0.6rem;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 0.95rem;
    color: var(--color-black);
  }

  .empty-tips {
    margin: 0;
    padding-left: 1.1rem;
    font-family: var(--font-prose);
    font-size: 0.88rem;
    line-height: 1.7;
    color: var(--reader-ink-secondary);
  }

  .empty-tips code {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    background-color: var(--color-paper-dark);
    padding: 0.05rem 0.3rem;
  }

  .empty-note {
    margin: 0;
    font-family: var(--font-prose);
    font-size: 0.88rem;
    color: var(--reader-ink-secondary);
    line-height: 1.6;
  }

  .palette-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
    padding: 0.5rem 0.9rem;
    border-top: 2px solid var(--color-black);
    background-color: var(--color-paper);
    font-family: var(--font-mono);
    font-size: 0.62rem;
    color: var(--color-gray-dark);
  }

  .foot-keys kbd {
    font-family: var(--font-mono);
    font-size: 0.6rem;
    border: 1px solid var(--color-gray-dark);
    padding: 0.02rem 0.22rem;
    background-color: #ffffff;
  }

  .foot-all {
    font-weight: 800;
    color: var(--color-red-primary);
    letter-spacing: 0.04em;
  }

  .foot-all:hover {
    text-decoration: underline;
  }

  @media (max-width: 640px) {
    .palette {
      top: 2vh;
      max-height: 92vh;
      box-shadow: 4px 4px 0px var(--color-black);
    }

    .palette-input {
      font-size: 1rem;
    }

    .foot-keys {
      display: none;
    }
  }
</style>
