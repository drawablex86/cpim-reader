<script lang="ts">
  type ReaderTheme = 'paper' | 'white' | 'dim';

  let {
    fontSize = $bindable(1.18),
    measure = $bindable(68),
    theme = $bindable<ReaderTheme>('paper')
  } = $props<{
    fontSize?: number;
    measure?: number;
    theme?: ReaderTheme;
  }>();

  const FONT_STEPS = [1, 1.08, 1.18, 1.3, 1.45];
  const MEASURES: Array<{ value: number; label: string; title: string }> = [
    { value: 58, label: 'NARROW', title: '58 characters per line' },
    { value: 68, label: 'NORMAL', title: '68 characters per line (recommended)' },
    { value: 82, label: 'WIDE', title: '82 characters per line' }
  ];
  const THEMES: Array<{ value: ReaderTheme; label: string; title: string }> = [
    { value: 'paper', label: 'PAPER', title: 'Archival newsprint' },
    { value: 'white', label: 'WHITE', title: 'High-contrast white' },
    { value: 'dim', label: 'DIM', title: 'Low-light reading' }
  ];

  const stepIndex = $derived(
    FONT_STEPS.findIndex((step) => Math.abs(step - fontSize) < 0.001)
  );

  function step(dir: -1 | 1) {
    const current = stepIndex === -1 ? 2 : stepIndex;
    const next = Math.min(FONT_STEPS.length - 1, Math.max(0, current + dir));
    fontSize = FONT_STEPS[next];
  }

  function reset() {
    fontSize = 1.18;
    measure = 68;
    theme = 'paper';
  }

  const isDefault = $derived(
    Math.abs(fontSize - 1.18) < 0.001 && measure === 68 && theme === 'paper'
  );
</script>

<div class="reading-controls" role="group" aria-label="Reading options">
  <div class="control-group">
    <span class="ctrl-label" id="rc-text">TEXT</span>
    <div class="stepper">
      <button
        type="button"
        class="ctrl-btn step"
        onclick={() => step(-1)}
        disabled={stepIndex <= 0}
        aria-label="Decrease text size"
      >
        A−
      </button>
      <span class="ctrl-value" aria-live="polite">{Math.round((fontSize / 1.18) * 100)}%</span>
      <button
        type="button"
        class="ctrl-btn step step-up"
        onclick={() => step(1)}
        disabled={stepIndex >= FONT_STEPS.length - 1}
        aria-label="Increase text size"
      >
        A+
      </button>
    </div>
  </div>

  <div class="control-group">
    <span class="ctrl-label">WIDTH</span>
    <div class="segmented" role="group" aria-label="Line width">
      {#each MEASURES as option (option.value)}
        <button
          type="button"
          class="ctrl-btn"
          class:active={measure === option.value}
          aria-pressed={measure === option.value}
          title={option.title}
          onclick={() => (measure = option.value)}
        >
          {option.label}
        </button>
      {/each}
    </div>
  </div>

  <div class="control-group">
    <span class="ctrl-label">PAGE</span>
    <div class="segmented" role="group" aria-label="Reading theme">
      {#each THEMES as option (option.value)}
        <button
          type="button"
          class="ctrl-btn"
          class:active={theme === option.value}
          aria-pressed={theme === option.value}
          title={option.title}
          onclick={() => (theme = option.value)}
        >
          {option.label}
        </button>
      {/each}
    </div>
  </div>

  <button
    type="button"
    class="ctrl-btn reset-btn"
    onclick={reset}
    disabled={isDefault}
    title="Restore default reading settings"
  >
    RESET
  </button>
</div>

<style>
  .reading-controls {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem 1.25rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px dashed var(--color-gray-dark);
  }

  .control-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .ctrl-label {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: var(--color-gray-dark);
  }

  .stepper,
  .segmented {
    display: inline-flex;
    align-items: center;
    border: 1.5px solid var(--color-black);
    background-color: var(--color-paper-light);
    box-shadow: 1px 1px 0px var(--color-black);
  }

  .ctrl-btn {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 0.3rem 0.55rem;
    border: none;
    border-right: 1px solid var(--color-black);
    background: transparent;
    color: var(--color-black);
    cursor: pointer;
    transition: background-color 0.1s ease, color 0.1s ease;
    min-height: 30px;
  }

  .segmented .ctrl-btn:last-child {
    border-right: none;
  }

  .ctrl-btn:hover:not(:disabled) {
    background-color: var(--color-red-primary);
    color: #ffffff;
  }

  .ctrl-btn.active {
    background-color: var(--color-black);
    color: #ffffff;
  }

  .ctrl-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .ctrl-btn.step {
    font-size: 0.78rem;
    padding: 0.3rem 0.5rem;
  }

  .ctrl-value {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 700;
    color: var(--color-gray-dark);
    min-width: 2.6rem;
    text-align: center;
  }

  .reset-btn {
    border: 1.5px solid var(--color-black);
    background-color: var(--color-paper);
    box-shadow: 1px 1px 0px var(--color-black);
  }

  @media (max-width: 640px) {
    .ctrl-label {
      display: none;
    }
  }
</style>
