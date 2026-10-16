<script lang="ts">
  import { onMount } from 'svelte';
  import { getSimilarDocuments, type SimilarDoc } from '$lib/semantic-search';

  let { currentSlug } = $props<{ currentSlug: string }>();

  let similarDocs = $state<SimilarDoc[]>([]);
  let loaded = $state(false);

  onMount(async () => {
    similarDocs = await getSimilarDocuments(currentSlug);
    loaded = true;
  });
</script>

{#if loaded && similarDocs.length > 0}
  <div class="similar-box" aria-label="Semantically Related Resolutions">
    <div class="similar-header">
      <span class="similar-icon">⬡</span>
      <span class="similar-title">RELATED RESOLUTIONS</span>
    </div>
    <div class="similar-sub">Pre-computed via EmbeddingGemma-2</div>

    <nav class="similar-list">
      {#each similarDocs as item}
        {@const pct = Math.round(item.score * 100)}
        <a href={`/docs/${item.slug}`} class="similar-link">
          <div class="link-top">
            <span class="sim-badge" class:high={pct >= 78}>{pct}% MATCH</span>
          </div>
          <span class="sim-title">{item.title}</span>
        </a>
      {/each}
    </nav>
  </div>
{/if}

<style>
  .similar-box {
    margin-top: 1.5rem;
    background-color: var(--color-paper);
    border: var(--border-medium);
    padding: 1.15rem 1rem;
    box-shadow: var(--shadow-hard-sm);
  }

  .similar-header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    border-bottom: 2px solid var(--color-black);
    padding-bottom: 0.35rem;
    margin-bottom: 0.25rem;
  }

  .similar-icon {
    color: var(--color-red-primary);
    font-size: 0.95rem;
    font-weight: 700;
  }

  .similar-title {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--color-black);
  }

  .similar-sub {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    color: var(--color-gray-dark);
    margin-bottom: 0.85rem;
  }

  .similar-list {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .similar-link {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    text-decoration: none;
    padding: 0.45rem 0.6rem;
    border: 1px solid var(--color-gray-dark);
    background-color: var(--color-paper-light);
    transition: all 0.1s ease;
  }

  .similar-link:hover {
    background-color: #FFFFFF;
    border-color: var(--color-red-primary);
    transform: translate(-1px, -1px);
    box-shadow: 2px 2px 0px var(--color-black);
  }

  .link-top {
    display: flex;
    justify-content: flex-start;
  }

  .sim-badge {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 700;
    padding: 0.1rem 0.35rem;
    background-color: var(--color-black);
    color: #FFFFFF;
  }

  .sim-badge.high {
    background-color: var(--color-red-primary);
  }

  .sim-title {
    font-family: var(--font-display);
    font-size: 0.8rem;
    font-weight: 700;
    line-height: 1.3;
    color: var(--color-black);
  }

  .similar-link:hover .sim-title {
    color: var(--color-red-primary);
  }
</style>
