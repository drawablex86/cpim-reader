<script lang="ts">
  import type { DocumentMeta } from '$lib/documents';
  import { getDocTypeLabel, getTopicLabel } from '$lib/taxonomy';
  import type { FacetItem, FacetKind, FacetMeta } from '$lib/taxonomy-index';

  let {
    kind,
    meta,
    item,
    documents,
    siblings
  }: {
    kind: FacetKind;
    meta: FacetMeta;
    item: FacetItem;
    documents: DocumentMeta[];
    siblings: FacetItem[];
  } = $props();

  const plural = $derived(meta.singular.charAt(0) + meta.singular.slice(1).toLowerCase() + 's');

  const dateRange = $derived.by(() => {
    if (documents.length === 0) return null;
    const dates = documents.map((doc) => doc.date).sort();
    return { earliest: dates[0], latest: dates[dates.length - 1] };
  });

  const totalPages = $derived(
    documents.reduce((sum, doc) => sum + (doc.page_count || 0), 0)
  );

  const catalogHref = $derived(`/?${meta.queryParam}=${item.slug}`);
</script>

<svelte:head>
  <title>{item.label} — {meta.title} — CPI(M) Documents Archive</title>
  <meta
    name="description"
    content={item.description || `${documents.length} CPI(M) documents filed under ${item.label}.`}
  />
</svelte:head>

<section class="facet-page">
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="/">CATALOG</a>
    <span class="sep" aria-hidden="true">/</span>
    <a href={`/browse/${kind}`}>BY {meta.singular}</a>
    <span class="sep" aria-hidden="true">/</span>
    <span class="crumb-current">{item.label.toUpperCase()}</span>
  </nav>

  <header class="facet-head">
    <div class="head-main">
      <span class="kicker">{meta.singular} // {String(item.count).padStart(2, '0')} DOCUMENTS</span>
      <h1>{item.label}</h1>
      {#if item.description}
        <p class="blurb">{item.description}</p>
      {/if}
    </div>

    <dl class="head-stats">
      <div class="stat">
        <dt>DOCUMENTS</dt>
        <dd>{item.count}</dd>
      </div>
      {#if dateRange}
        <div class="stat">
          <dt>SPAN</dt>
          <dd>{dateRange.earliest.slice(0, 4)}–{dateRange.latest.slice(0, 4)}</dd>
        </div>
      {/if}
      {#if totalPages > 0}
        <div class="stat">
          <dt>PAGES</dt>
          <dd>{totalPages.toLocaleString()}</dd>
        </div>
      {/if}
    </dl>
  </header>

  <div class="actions">
    <a class="action-primary" href={catalogHref}>FILTER IN CATALOG →</a>
    <a class="action-secondary" href={`/browse/${kind}`}>ALL {plural.toUpperCase()} →</a>
  </div>

  {#if documents.length === 0}
    <p class="empty">No documents are filed under {item.label} yet.</p>
  {:else}
    <ol class="doc-list">
      {#each documents as doc (doc.slug)}
        <li class="doc-item">
          <a class="doc-link" href={`/docs/${doc.slug}`}>
            <time class="doc-date" datetime={doc.date}>{doc.date}</time>

            <span class="doc-body">
              <span class="doc-title">{doc.title}</span>
              {#if doc.topics && doc.topics.length > 0}
                <span class="doc-topics">
                  {#each doc.topics.slice(0, 3) as topic}
                    <span class="doc-topic">#{getTopicLabel(topic)}</span>
                  {/each}
                </span>
              {/if}
            </span>

            <span class="doc-meta">
              {#if doc.doc_type}
                <span class="doc-type">{getDocTypeLabel(doc.doc_type).toUpperCase()}</span>
              {/if}
              {#if doc.page_count}
                <span class="doc-pages">{doc.page_count} pp</span>
              {/if}
            </span>
          </a>
        </li>
      {/each}
    </ol>
  {/if}

  {#if siblings.length > 0}
    <nav class="siblings" aria-label={`Other ${plural.toLowerCase()}`}>
      <span class="siblings-label">ALSO IN {meta.singular}S</span>
      <div class="sibling-chips">
        {#each siblings as sibling (sibling.slug)}
          <a class="chip" href={`/browse/${kind}/${sibling.slug}`}>
            {sibling.label} <span class="chip-count">{sibling.count}</span>
          </a>
        {/each}
      </div>
    </nav>
  {/if}
</section>

<style>
  .facet-page {
    max-width: 1100px;
    margin: 0 auto;
    padding: 2rem 1.5rem 4rem;
  }

  .crumbs {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    flex-wrap: wrap;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    letter-spacing: 0.05em;
    color: var(--color-gray-dark);
    margin-bottom: 1.5rem;
  }

  .crumbs a {
    color: var(--color-gray-dark);
  }

  .crumbs a:hover {
    color: var(--color-red-primary);
    text-decoration: underline;
  }

  .sep {
    color: var(--color-gray-light);
  }

  .crumb-current {
    color: var(--color-black);
    font-weight: 700;
  }

  .facet-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1.5rem;
    flex-wrap: wrap;
    border-top: var(--border-heavy);
    border-bottom: 1px solid var(--color-gray-dark);
    padding: 1.25rem 0 1.15rem;
    margin-bottom: 1.15rem;
  }

  .head-main {
    flex: 1 1 380px;
    min-width: 0;
  }

  .kicker {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.11em;
    color: var(--color-red-primary);
  }

  h1 {
    font-family: var(--font-display);
    font-size: clamp(1.7rem, 4vw, 2.5rem);
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.02em;
    margin: 0.35rem 0 0.55rem;
    color: var(--color-black);
  }

  .blurb {
    font-family: var(--font-prose);
    font-size: 1rem;
    line-height: 1.6;
    color: var(--color-gray-dark);
    max-width: 62ch;
    margin: 0;
  }

  .head-stats {
    display: flex;
    gap: 1.25rem;
    margin: 0;
    padding-left: 1.25rem;
    border-left: 1px solid var(--color-gray-light);
  }

  .stat dt {
    font-family: var(--font-mono);
    font-size: 0.6rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: var(--color-gray-dark);
  }

  .stat dd {
    margin: 0.15rem 0 0;
    font-family: var(--font-mono);
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--color-black);
    font-variant-numeric: tabular-nums;
  }

  .actions {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
    margin-bottom: 1.75rem;
  }

  .action-primary,
  .action-secondary {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    padding: 0.45rem 0.8rem;
    border: 2px solid var(--color-black);
  }

  .action-primary {
    background-color: var(--color-black);
    color: #ffffff;
    box-shadow: var(--shadow-hard-sm);
  }

  .action-primary:hover {
    background-color: var(--color-red-primary);
    border-color: var(--color-red-dark);
  }

  .action-secondary {
    background-color: var(--color-paper-light);
    color: var(--color-black);
  }

  .action-secondary:hover {
    background-color: var(--color-gold);
  }

  .doc-list {
    list-style: none;
    margin: 0;
    padding: 0;
    border-top: 2px solid var(--color-black);
  }

  .doc-item {
    border-bottom: 1px solid var(--color-gray-light);
  }

  .doc-link {
    display: grid;
    grid-template-columns: 6.5rem 1fr auto;
    align-items: baseline;
    gap: 1rem;
    padding: 0.7rem 0.5rem;
    transition: background-color 0.1s ease, border-color 0.1s ease;
    border-left: 3px solid transparent;
  }

  .doc-link:hover {
    background-color: var(--color-paper-light);
    border-left-color: var(--color-red-primary);
  }

  .doc-date {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--color-gray-dark);
    font-variant-numeric: tabular-nums;
  }

  .doc-body {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
  }

  .doc-title {
    font-family: var(--font-display);
    font-size: 0.95rem;
    font-weight: 700;
    line-height: 1.3;
    color: var(--color-black);
  }

  .doc-link:hover .doc-title {
    color: var(--color-red-primary);
  }

  .doc-topics {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .doc-topic {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    color: var(--color-gray-dark);
  }

  .doc-meta {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    justify-self: end;
    white-space: nowrap;
  }

  .doc-type {
    font-family: var(--font-mono);
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--color-gray-dark);
    border: 1px solid var(--color-gray-light);
    padding: 0.05rem 0.3rem;
  }

  .doc-pages {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    color: var(--color-gray-dark);
  }

  .empty {
    font-family: var(--font-prose);
    color: var(--color-gray-dark);
    font-style: italic;
  }

  .siblings {
    margin-top: 2.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-gray-dark);
  }

  .siblings-label {
    display: block;
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: var(--color-gray-dark);
    margin-bottom: 0.6rem;
  }

  .sibling-chips {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    padding: 0.25rem 0.55rem;
    border: 1px solid var(--color-black);
    background-color: var(--color-paper-light);
    color: var(--color-black);
  }

  .chip:hover {
    background-color: var(--color-black);
    color: #ffffff;
  }

  .chip-count {
    font-size: 0.6rem;
    color: var(--color-red-primary);
  }

  .chip:hover .chip-count {
    color: var(--color-gold);
  }

  @media (max-width: 720px) {
    .facet-page {
      padding: 1.25rem 1rem 3rem;
    }

    .head-stats {
      border-left: none;
      padding-left: 0;
      gap: 1.5rem;
    }

    .doc-link {
      grid-template-columns: 1fr;
      gap: 0.2rem;
    }

    .doc-meta {
      justify-self: start;
    }
  }
</style>
