<script lang="ts">
  import type { SearchResult } from '$lib/semantic-search';
  import type { DocumentMeta } from '$lib/documents';

  let { results, query, loading, oncite } = $props<{
    results: SearchResult[];
    query: string;
    loading: boolean;
    oncite?: (doc: DocumentMeta) => void;
  }>();

  function toMeta(doc: any): DocumentMeta {
    return {
      title: doc.title,
      slug: doc.slug,
      date: doc.date,
      category: doc.category,
      model: doc.model
    };
  }
</script>

<div class="semantic-results-shell" role="region" aria-label="Dense Semantic Search Results">
  <div class="panel-header">
    <div class="header-left">
      <span class="panel-stamp">⬡ DENSE SEMANTIC VECTOR MATCHES</span>
      {#if !loading && results.length > 0}
        <span class="match-count">{results.length} DOCUMENTS RANKED BY EMBEDDINGGEMMA-2</span>
      {/if}
    </div>
    {#if loading}
      <span class="status-indicator live">INFERRING COSINE SIMILARITY...</span>
    {:else}
      <span class="status-indicator ready">WASM MATRIX COMPUTATION COMPLETED</span>
    {/if}
  </div>

  {#if loading}
    <div class="skeleton-container">
      <div class="skeleton-row"></div>
      <div class="skeleton-row short"></div>
      <div class="skeleton-row"></div>
    </div>
  {:else if results.length === 0}
    {#if query.trim().length >= 3}
      <div class="no-matches-box">
        <div class="no-matches-title">NO HIGH-CONFIDENCE SEMANTIC MATCHES FOUND</div>
        <p class="no-matches-desc">
          No resolutions scored above the relevance threshold for "<em>{query}</em>".
          Try broader thematic terms (e.g., <em>imperialism</em>, <em>peasant struggles</em>, <em>healthcare</em>).
        </p>
      </div>
    {/if}
  {:else}
    <div class="results-list">
      {#each results as { doc, score }, idx}
        {@const percentage = Math.round(score * 100)}
        <article class="semantic-card" class:top-card={idx === 0}>
          <div class="score-strip">
            <div class="score-meta">
              <span class="score-label">SEMANTIC SIMILARITY</span>
              <span class="score-val" class:high-score={percentage >= 75}>{percentage}%</span>
            </div>
            <div class="score-track" aria-hidden="true">
              <div
                class="score-fill"
                class:high-fill={percentage >= 75}
                style={`width: ${Math.max(4, Math.min(100, percentage))}%`}
              ></div>
            </div>
          </div>

          <div class="card-main">
            <div class="card-meta-line">
              <span class="cat-badge">{doc.category}</span>
              <time class="doc-date" datetime={doc.date}>{doc.date}</time>
            </div>

            <h3 class="card-title">
              <a href={`/docs/${doc.slug}`}>{doc.title}</a>
            </h3>

            <div class="card-actions">
              <a href={`/docs/${doc.slug}`} class="btn-read">READ RESOLUTION ➔</a>
              {#if oncite}
                <button
                  type="button"
                  class="btn-cite"
                  onclick={() => oncite(toMeta(doc))}
                >
                  CITE
                </button>
              {/if}
            </div>
          </div>
        </article>
      {/each}
    </div>
  {/if}
</div>

<style>
  .semantic-results-shell {
    background-color: var(--color-paper-light);
    border: var(--border-heavy);
    box-shadow: var(--shadow-hard-md);
    margin-bottom: 2rem;
    overflow: hidden;
  }

  .panel-header {
    background-color: var(--color-black);
    color: #FFFFFF;
    padding: 0.75rem 1.25rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 3px solid var(--color-gold);
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .panel-stamp {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--color-gold);
  }

  .match-count {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: #CCCCCC;
    background-color: #262626;
    padding: 0.15rem 0.5rem;
    border: 1px solid #444444;
  }

  .status-indicator {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.05em;
  }

  .status-indicator.live {
    color: var(--color-gold);
    animation: pulse 1s infinite alternate;
  }

  .status-indicator.ready {
    color: #4CAF50;
  }

  @keyframes pulse {
    from { opacity: 0.6; }
    to { opacity: 1; }
  }

  /* Skeleton Loading */
  .skeleton-container {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .skeleton-row {
    height: 60px;
    background: linear-gradient(90deg, #E6E1D5 25%, #F4F1EA 50%, #E6E1D5 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border: 1px solid var(--color-gray-light);
  }

  .skeleton-row.short {
    width: 75%;
    height: 40px;
  }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* Results List */
  .results-list {
    display: flex;
    flex-direction: column;
    divide-y: 2px solid var(--color-black);
  }

  .semantic-card {
    padding: 1.25rem;
    background-color: var(--color-paper-light);
    border-bottom: 2px solid var(--color-black);
    display: grid;
    grid-template-columns: 180px 1fr;
    gap: 1.5rem;
    align-items: center;
    transition: background-color 0.1s ease;
  }

  .semantic-card:hover {
    background-color: #FAF5EB;
  }

  .semantic-card.top-card {
    background-color: #FFFDF9;
    border-left: 6px solid var(--color-red-primary);
  }

  /* Score Visualization */
  .score-strip {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .score-meta {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-family: var(--font-mono);
  }

  .score-label {
    font-size: 0.65rem;
    font-weight: 700;
    color: var(--color-gray-dark);
    letter-spacing: 0.05em;
  }

  .score-val {
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--color-black);
  }

  .score-val.high-score {
    color: var(--color-red-primary);
  }

  .score-track {
    height: 8px;
    background-color: var(--color-paper-dark);
    border: 1.5px solid var(--color-black);
    position: relative;
    overflow: hidden;
  }

  .score-fill {
    height: 100%;
    background-color: var(--color-black);
    transition: width 0.3s ease;
  }

  .score-fill.high-fill {
    background-color: var(--color-red-primary);
  }

  /* Card Main Info */
  .card-main {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .card-meta-line {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-family: var(--font-mono);
  }

  .cat-badge {
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.15rem 0.4rem;
    background-color: var(--color-black);
    color: #FFFFFF;
  }

  .doc-date {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-gray-dark);
  }

  .card-title {
    font-size: 1.2rem;
    font-weight: 700;
    line-height: 1.3;
    margin: 0;
  }

  .card-title a {
    color: var(--color-black);
    text-decoration: none;
  }

  .card-title a:hover {
    color: var(--color-red-primary);
    text-decoration: underline;
  }

  .card-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.4rem;
  }

  .btn-read {
    font-family: var(--font-display);
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.35rem 0.75rem;
    background-color: var(--color-red-primary);
    color: #FFFFFF;
    border: 1.5px solid var(--color-black);
    text-decoration: none;
    box-shadow: 1px 1px 0px var(--color-black);
    transition: all 0.1s ease;
  }

  .btn-read:hover {
    background-color: var(--color-red-dark);
    transform: translate(-1px, -1px);
    box-shadow: 2px 2px 0px var(--color-black);
  }

  .btn-cite {
    font-family: var(--font-display);
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.35rem 0.65rem;
    background-color: var(--color-paper);
    color: var(--color-black);
    border: 1.5px solid var(--color-black);
    cursor: pointer;
    box-shadow: 1px 1px 0px var(--color-black);
  }

  .btn-cite:hover {
    background-color: var(--color-black);
    color: #FFFFFF;
  }

  .no-matches-box {
    padding: 2.5rem 1.5rem;
    text-align: center;
  }

  .no-matches-title {
    font-family: var(--font-mono);
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--color-red-primary);
    margin-bottom: 0.5rem;
  }

  .no-matches-desc {
    font-size: 0.9rem;
    color: var(--color-gray-dark);
    max-width: 550px;
    margin: 0 auto;
    line-height: 1.5;
  }

  @media (max-width: 768px) {
    .semantic-card {
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }
  }
</style>
