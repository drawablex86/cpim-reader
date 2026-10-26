<script lang="ts">
  import type { FacetItem, FacetKind, FacetMeta } from '$lib/taxonomy-index';

  let {
    kind,
    meta,
    items
  }: { kind: FacetKind; meta: FacetMeta; items: FacetItem[] } = $props();

  const totalDocuments = $derived(
    items.reduce((sum, item) => sum + item.count, 0)
  );
</script>

<svelte:head>
  <title>{meta.title} — CPI(M) Documents Archive</title>
  <meta name="description" content={meta.blurb} />
</svelte:head>

<section class="facet-page">
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="/">CATALOG</a>
    <span class="sep" aria-hidden="true">/</span>
    <span class="crumb-current">BROWSE BY {meta.singular}</span>
  </nav>

  <header class="facet-head">
    <span class="kicker">INDEX // {meta.singular}S</span>
    <h1>{meta.title}</h1>
    <p class="blurb">{meta.blurb}</p>
  </header>

  <div class="facet-grid">
    {#each items as item (item.slug)}
      <a class="facet-card" href={`/browse/${kind}/${item.slug}`}>
        <span class="card-count">{item.count}</span>
        <span class="card-label">{item.label}</span>
        {#if item.description}
          <span class="card-desc">{item.description}</span>
        {/if}
        <span class="card-cta" aria-hidden="true">
          {item.count === 1 ? '1 document' : `${item.count} documents`} →
        </span>
      </a>
    {/each}
  </div>

  <footer class="facet-foot">
    <span class="foot-note">
      {items.length} {meta.singular.toLowerCase()}s across {totalDocuments} document references
    </span>
    <a class="foot-link" href="/">← RETURN TO CATALOG</a>
  </footer>
</section>

<style>
  .facet-page {
    max-width: 1240px;
    margin: 0 auto;
    padding: 2rem 1.5rem 4rem;
  }

  .crumbs {
    display: flex;
    align-items: center;
    gap: 0.45rem;
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
    border-left: 6px solid var(--color-red-primary);
    padding: 0.25rem 0 0.25rem 1.25rem;
    margin-bottom: 2rem;
  }

  .kicker {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    color: var(--color-red-primary);
  }

  h1 {
    font-family: var(--font-display);
    font-size: clamp(1.7rem, 4vw, 2.6rem);
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.02em;
    margin: 0.4rem 0 0.6rem;
    color: var(--color-black);
  }

  .blurb {
    font-family: var(--font-prose);
    font-size: 1.02rem;
    line-height: 1.6;
    color: var(--color-gray-dark);
    max-width: 68ch;
    margin: 0;
  }

  .facet-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 1rem;
  }

  .facet-card {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 1rem 1.1rem 0.9rem;
    background-color: var(--color-paper-light);
    border: var(--border-medium);
    box-shadow: var(--shadow-hard-sm);
    transition: transform 0.1s ease, box-shadow 0.1s ease, border-color 0.1s ease;
  }

  .facet-card:hover {
    transform: translate(-1px, -1px);
    box-shadow: var(--shadow-hard-md);
    border-color: var(--color-red-primary);
  }

  .card-count {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 800;
    color: #ffffff;
    background-color: var(--color-red-primary);
    align-self: flex-start;
    padding: 0.1rem 0.4rem;
    margin-bottom: 0.35rem;
  }

  .card-label {
    font-family: var(--font-display);
    font-size: 1.05rem;
    font-weight: 700;
    line-height: 1.25;
    color: var(--color-black);
  }

  .card-desc {
    font-family: var(--font-prose);
    font-size: 0.86rem;
    line-height: 1.5;
    color: var(--color-gray-dark);
  }

  .card-cta {
    margin-top: auto;
    padding-top: 0.6rem;
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--color-red-primary);
  }

  .facet-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    margin-top: 2.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-gray-dark);
    font-family: var(--font-mono);
    font-size: 0.68rem;
    color: var(--color-gray-dark);
  }

  .foot-link {
    font-weight: 700;
    letter-spacing: 0.05em;
    color: var(--color-red-primary);
  }

  .foot-link:hover {
    text-decoration: underline;
  }

  @media (max-width: 640px) {
    .facet-page {
      padding: 1.25rem 1rem 3rem;
    }

    .facet-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
