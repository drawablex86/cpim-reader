<script lang="ts">
  import { SUPPORTED_LANGUAGES, type TranslationMeta } from '$lib/documents';

  interface Props {
    currentLang: string;
    isBilingual: boolean;
    availableTranslations: Record<string, TranslationMeta>;
    onSelectLang: (lang: string) => void;
    onToggleBilingual: () => void;
  }

  let {
    currentLang,
    isBilingual,
    availableTranslations = {},
    onSelectLang,
    onToggleBilingual
  }: Props = $props();

  const activeTranslation = $derived(
    currentLang === 'en' ? null : availableTranslations[currentLang]
  );
</script>

<div class="lang-selector-shell" aria-label="Archival Language & Translation Selector">
  <div class="lang-header-row">
    <div class="lang-label-group">
      <span class="constructivist-stamp">LANG // ഭാഷ // भाषा:</span>
      {#if activeTranslation}
        <span class="provenance-tag">
          VERIFIED INDICTRANS2 TRANSLATION
        </span>
      {:else}
        <span class="provenance-tag en-master">
          ORIGINAL MASTER TEXT
        </span>
      {/if}
    </div>

    <!-- Mode Toggle: Single Column vs. Parallel Bilingual View -->
    {#if Object.keys(availableTranslations).length > 0}
      <button
        type="button"
        class="bilingual-toggle-btn"
        class:active={isBilingual}
        onclick={onToggleBilingual}
        title="Toggle side-by-side synchronized English and Indic comparative reading"
      >
        <span class="mode-icon">{isBilingual ? '◧' : '◫'}</span>
        <span class="mode-text">
          {isBilingual ? 'SINGLE COLUMN' : 'PARALLEL BILINGUAL VIEW'}
        </span>
      </button>
    {/if}
  </div>

  <!-- Language Pills Strip -->
  <div class="lang-pills-row" role="tablist">
    <!-- English Master Pill -->
    <button
      type="button"
      role="tab"
      aria-selected={currentLang === 'en'}
      class="lang-pill"
      class:active={currentLang === 'en'}
      onclick={() => onSelectLang('en')}
    >
      <span class="pill-code">EN</span>
      <span class="pill-native">ENGLISH ORIGINAL</span>
    </button>

    <!-- Indic Language Pills -->
    {#each SUPPORTED_LANGUAGES.filter(l => l.code !== 'en') as lang}
      {@const isAvailable = Boolean(availableTranslations[lang.code])}
      <button
        type="button"
        role="tab"
        aria-selected={currentLang === lang.code}
        disabled={!isAvailable}
        class="lang-pill"
        class:available={isAvailable}
        class:unavailable={!isAvailable}
        class:active={currentLang === lang.code}
        onclick={() => isAvailable && onSelectLang(lang.code)}
        title={isAvailable ? `Read in ${lang.name}` : `Translation in ${lang.name} pending`}
      >
        <span class="pill-code">{lang.code.toUpperCase()}</span>
        <span class="pill-native">{lang.native}</span>
        {#if !isAvailable}
          <span class="pending-dot" title="Pending generation">·</span>
        {/if}
      </button>
    {/each}
  </div>
</div>

<style>
  .lang-selector-shell {
    margin-top: 1.25rem;
    padding: 0.85rem 1rem;
    background: var(--color-paper-light, #FAF8F5);
    border: var(--border-medium, 2px solid #121212);
    box-shadow: var(--shadow-hard-sm, 2px 2px 0px #121212);
  }

  .lang-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 0.65rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px dashed var(--color-gray-dark, #404040);
  }

  .lang-label-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .constructivist-stamp {
    font-family: var(--font-mono, monospace);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--color-black, #121212);
    background: var(--color-paper-dark, #E6E1D5);
    padding: 0.15rem 0.4rem;
    border: 1px solid var(--color-black, #121212);
  }

  .provenance-tag {
    font-family: var(--font-mono, monospace);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    color: var(--color-red-primary, #C41E3A);
    background: var(--color-red-light, #FCE8E6);
    border: 1px solid var(--color-red-primary, #C41E3A);
    padding: 0.15rem 0.45rem;
  }

  .provenance-tag.en-master {
    color: var(--color-black, #121212);
    background: #FFFFFF;
    border: 1px solid var(--color-gray-dark, #404040);
  }

  .bilingual-toggle-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: #FFFFFF;
    color: var(--color-black, #121212);
    border: 2px solid var(--color-black, #121212);
    padding: 0.3rem 0.65rem;
    font-family: var(--font-display, sans-serif);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    cursor: pointer;
    box-shadow: 2px 2px 0px var(--color-black, #121212);
    transition: transform 0.1s ease, box-shadow 0.1s ease;
  }

  .bilingual-toggle-btn:hover {
    background: var(--color-gold-muted, #E6C665);
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0px var(--color-black, #121212);
  }

  .bilingual-toggle-btn:active {
    transform: translate(1px, 1px);
    box-shadow: none;
  }

  .bilingual-toggle-btn.active {
    background: var(--color-red-primary, #C41E3A);
    color: #FFFFFF;
    border-color: var(--color-black, #121212);
  }

  .mode-icon {
    font-size: 0.95rem;
    line-height: 1;
  }

  .lang-pills-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }

  .lang-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.65rem;
    background: #FFFFFF;
    color: var(--color-black, #121212);
    border: 2px solid var(--color-black, #121212);
    box-shadow: 2px 2px 0px var(--color-black, #121212);
    cursor: pointer;
    font-family: var(--font-display, sans-serif);
    transition: all 0.1s ease;
    user-select: none;
  }

  .lang-pill.available:hover {
    background: var(--color-paper-dark, #E6E1D5);
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0px var(--color-black, #121212);
  }

  .lang-pill.active {
    background: var(--color-red-primary, #C41E3A) !important;
    color: #FFFFFF !important;
    border-color: var(--color-black, #121212);
    box-shadow: 2px 2px 0px var(--color-black, #121212);
  }

  .lang-pill.unavailable {
    opacity: 0.45;
    background: var(--color-paper-dark, #E6E1D5);
    border-color: var(--color-gray-medium, #707070);
    box-shadow: none;
    cursor: not-allowed;
  }

  .pill-code {
    font-family: var(--font-mono, monospace);
    font-weight: 700;
    font-size: 0.72rem;
    letter-spacing: 0.04em;
    padding: 0.1rem 0.25rem;
    background: rgba(0, 0, 0, 0.08);
  }

  .lang-pill.active .pill-code {
    background: rgba(255, 255, 255, 0.25);
  }

  .pill-native {
    font-size: 0.85rem;
    font-weight: 600;
  }

  .pending-dot {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--color-gray-medium, #707070);
  }
</style>
