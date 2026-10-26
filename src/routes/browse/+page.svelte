<script lang="ts">
  let { data } = $props();
</script>

<svelte:head>
  <title>Browse the Archive — CPI(M) Documents Archive</title>
  <meta
    name="description"
    content="Browse the CPI(M) documents archive by topic, Party Congress or election cycle, document format and region."
  />
</svelte:head>

<section class="browse-page">
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="/">CATALOG</a>
    <span class="sep" aria-hidden="true">/</span>
    <span class="crumb-current">BROWSE</span>
  </nav>

  <header class="browse-head">
    <span class="kicker">INDEX // FOUR WAYS IN</span>
    <h1>Browse the Archive</h1>
    <p class="blurb">
      The catalog reads chronologically. These indexes cut the same 235 documents by
      subject, by Congress or election cycle, by document format and by region.
    </p>
  </header>

  <div class="section-grid">
    {#each data.sections as section (section.kind)}
      <section class="index-card">
        <header class="card-head">
          <span class="card-singular">{section.meta.singular}</span>
          <h2>{section.meta.title}</h2>
          <p class="card-blurb">{section.meta.blurb}</p>
        </header>

        <div class="card-chips">
          {#each section.top as entry (entry.slug)}
            <a class="chip" href={`/browse/${section.kind}/${entry.slug}`}>
              {entry.label} <span class="chip-count">{entry.count}</span>
            </a>
          {/each}
        </div>

        <footer class="card-foot">
          <span class="card-stat">
            {section.totalFacets} {section.meta.singular.toLowerCase()}s ·
            {section.totalDocuments} filings
          </span>
          <a class="card-link" href={`/browse/${section.kind}`}>VIEW ALL →</a>
        </footer>
      </section>
    {/each}
  </div>
</section>

<style>
  .browse-page {
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

  .browse-head {
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
    font-size: clamp(1.8rem, 4vw, 2.7rem);
    font-weight: 700;
    line-height: 1.08;
    letter-spacing: -0.02em;
    margin: 0.4rem 0 0.6rem;
    color: var(--color-black);
  }

  .blurb {
    font-family: var(--font-prose);
    font-size: 1.02rem;
    line-height: 1.6;
    color: var(--color-gray-dark);
    max-width: 70ch;
    margin: 0;
  }

  .section-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.25rem;
  }

  .index-card {
    display: flex;
    flex-direction: column;
    padding: 1.15rem 1.25rem;
    background-color: var(--color-paper-light);
    border: var(--border-heavy);
    box-shadow: var(--shadow-hard-sm);
  }

  .card-singular {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    color: #ffffff;
    background-color: var(--color-black);
    padding: 0.12rem 0.4rem;
    align-self: flex-start;
    margin-bottom: 0.5rem;
  }

  h2 {
    font-family: var(--font-display);
    font-size: 1.15rem;
    font-weight: 700;
    line-height: 1.2;
    margin: 0 0 0.35rem;
    color: var(--color-black);
  }

  .card-blurb {
    font-family: var(--font-prose);
    font-size: 0.88rem;
    line-height: 1.5;
    color: var(--color-gray-dark);
    margin: 0 0 0.9rem;
  }

  .card-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-bottom: 1rem;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-family: var(--font-mono);
    font-size: 0.66rem;
    padding: 0.22rem 0.45rem;
    border: 1px solid var(--color-black);
    background-color: var(--color-paper);
    color: var(--color-black);
  }

  .chip:hover {
    background-color: var(--color-red-primary);
    border-color: var(--color-red-primary);
    color: #ffffff;
  }

  .chip-count {
    font-size: 0.58rem;
    color: var(--color-red-primary);
  }

  .chip:hover .chip-count {
    color: var(--color-gold);
  }

  .card-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-top: auto;
    padding-top: 0.7rem;
    border-top: 1px solid var(--color-gray-light);
    font-family: var(--font-mono);
    font-size: 0.65rem;
    color: var(--color-gray-dark);
  }

  .card-link {
    font-weight: 800;
    letter-spacing: 0.05em;
    color: var(--color-red-primary);
  }

  .card-link:hover {
    text-decoration: underline;
  }

  @media (max-width: 640px) {
    .browse-page {
      padding: 1.25rem 1rem 3rem;
    }
  }
</style>
