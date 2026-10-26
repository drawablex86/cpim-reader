<script lang="ts">
  import { onMount, tick } from 'svelte';
  import CitationModal from '$lib/components/CitationModal.svelte';
  import SimilarDocuments from '$lib/components/SimilarDocuments.svelte';
  import LanguageSelector from '$lib/components/LanguageSelector.svelte';
  import ReadingControls from '$lib/components/ReadingControls.svelte';
  import {
    getProgress,
    saveProgress,
    type ReadingProgressEntry
  } from '$lib/reading-progress';
  import { getDocTypeLabel, getTopicLabel, getGeoLabel, getPeriodLabel } from '$lib/taxonomy';
  import { documentUrl, configuredSiteOrigin } from '$lib/site';

  let { data } = $props();

  let showPdfSplit = $state(false);
  let showCiteDrawer = $state(false);
  let readProgress = $state(0);
  let activeHeadingId = $state<string>('');
  let headings = $state<Array<{ id: string; text: string; level: number }>>([]);
  let tocScrollerEl = $state<HTMLElement | null>(null);
  let scrollSpy: IntersectionObserver | null = null;

  // Mobile section navigation (the sticky sidebar is hidden below 1024px)
  let mobileTocOpen = $state(false);

  const activeHeadingText = $derived(
    headings.find((h) => h.id === activeHeadingId)?.text || ''
  );

  // In-document find (the prose can exceed 58,000 words)
  let findOpen = $state(false);
  let findQuery = $state('');
  let findIndex = $state(0);
  let findMatches = $state(0);
  let findInputEl = $state<HTMLInputElement | null>(null);
  let findRanges: Range[] = [];
  let findTimer: ReturnType<typeof setTimeout> | undefined;

  // Passage selection toolbar (deep link / quote / section citation)
  type PassageSelection = {
    text: string;
    headingId?: string;
    headingText?: string;
    top: number;
    left: number;
  };
  let passage = $state<PassageSelection | null>(null);
  let passageFeedback = $state<string | null>(null);
  let activeSectionTitle = $state('');

  // Resume-reading state
  let resumeEntry = $state<ReadingProgressEntry | null>(null);
  let resumeDismissed = $state(false);
  let lastSavedAt = 0;

  // Multilingual State
  let currentLang = $state<string>('en');
  let isBilingualView = $state(false);

  // Reader presentation preferences (persisted per browser)
  type ReaderTheme = 'paper' | 'white' | 'dim';
  const READER_PREFS_KEY = 'cpim:reader-prefs';
  let readerFontSize = $state(1.18);
  let readerMeasure = $state(68);
  let readerTheme = $state<ReaderTheme>('paper');
  let readerPrefsLoaded = $state(false);

  $effect(() => {
    // Never write before the stored preferences have been read, otherwise the
    // first effect flush would overwrite the saved values with defaults.
    if (!readerPrefsLoaded) return;
    if (typeof window === 'undefined') return;
    const prefs = {
      fontSize: readerFontSize,
      measure: readerMeasure,
      theme: readerTheme
    };
    try {
      window.localStorage.setItem(READER_PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* storage unavailable (private mode) — preferences stay session-only */
    }
  });

  function restoreReaderPrefs() {
    try {
      const raw = window.localStorage.getItem(READER_PREFS_KEY);
      if (!raw) return;
      const prefs = JSON.parse(raw) as Partial<{
        fontSize: number;
        measure: number;
        theme: ReaderTheme;
      }>;
      if (typeof prefs.fontSize === 'number' && prefs.fontSize >= 0.9 && prefs.fontSize <= 1.6) {
        readerFontSize = prefs.fontSize;
      }
      if (typeof prefs.measure === 'number' && [58, 68, 82].includes(prefs.measure)) {
        readerMeasure = prefs.measure;
      }
      if (prefs.theme === 'paper' || prefs.theme === 'white' || prefs.theme === 'dim') {
        readerTheme = prefs.theme;
      }
    } catch {
      /* ignore malformed prefs */
    } finally {
      readerPrefsLoaded = true;
    }
  }

  // References for synchronized bilingual scrolling
  let masterPaneEl: HTMLElement | null = $state(null);
  let transPaneEl: HTMLElement | null = $state(null);

  const availableTranslations = $derived(data.meta.translations || {});
  const activeTranslation = $derived(
    currentLang === 'en' ? null : availableTranslations[currentLang]
  );

  const displayTitle = $derived(
    activeTranslation?.title || data.meta.title
  );

  // Active translation Svelte component
  const ActiveTransComponent = $derived(
    currentLang !== 'en' && data.translationComponents ? data.translationComponents[currentLang] : null
  );

  function handleSelectLang(lang: string) {
    currentLang = lang;
    tick().then(() => {
      refreshSectionNavigation();
    });
  }

  function handleToggleBilingual() {
    isBilingualView = !isBilingualView;
    if (isBilingualView) {
      showPdfSplit = false; // prioritize bilingual view
      if (currentLang === 'en') {
        // default to first available translation
        const availableKeys = Object.keys(availableTranslations);
        if (availableKeys.length > 0) {
          currentLang = availableKeys[0];
        }
      }
    }
    tick().then(() => {
      refreshSectionNavigation();
    });
  }

  function persistProgress(force = false) {
    if (typeof window === 'undefined') return;
    const now = Date.now();
    if (!force && now - lastSavedAt < 1500) return;
    lastSavedAt = now;

    const percent = Math.round(readProgress);
    if (percent < 1) return;

    const heading = headings.find((h) => h.id === activeHeadingId);
    saveProgress({
      slug: data.meta.slug,
      title: displayTitle,
      percent,
      headingId: heading?.id,
      headingText: heading?.text,
      updatedAt: now
    });
  }

  function jumpToSavedPosition() {
    if (!resumeEntry) return;

    if (resumeEntry.headingId && document.getElementById(resumeEntry.headingId)) {
      scrollToHeading(resumeEntry.headingId);
    } else if (isBilingualView && masterPaneEl) {
      // The bilingual panes scroll internally; the page itself does not.
      const max = masterPaneEl.scrollHeight - masterPaneEl.clientHeight;
      masterPaneEl.scrollTo({ top: (resumeEntry.percent / 100) * max, behavior: 'smooth' });
    } else {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: (resumeEntry.percent / 100) * totalHeight, behavior: 'smooth' });
    }

    resumeDismissed = true;
  }

  /**
   * Reading progress is measured against whichever surface actually scrolls.
   * In bilingual mode that is the master pane, not the page — measuring the
   * page there would keep reporting the same percentage forever.
   */
  function updateScroll() {
    let fraction = 0;

    if (isBilingualView && masterPaneEl) {
      const max = masterPaneEl.scrollHeight - masterPaneEl.clientHeight;
      fraction = max > 0 ? masterPaneEl.scrollTop / max : 0;
    } else {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      fraction = totalHeight > 0 ? window.scrollY / totalHeight : 0;
    }

    readProgress = Math.min(100, Math.max(0, fraction * 100));
    persistProgress();
  }

  function openFind() {
    findOpen = true;
    tick().then(() => {
      findInputEl?.focus();
      findInputEl?.select();
    });
  }

  function closeFind() {
    findOpen = false;
    findQuery = '';
    findIndex = 0;
    findMatches = 0;
    findRanges = [];
    clearHighlights();
  }

  function clearHighlights() {
    const highlights = (window as any).CSS?.highlights;
    if (highlights) {
      highlights.delete('cpim-find');
      highlights.delete('cpim-find-current');
    }
  }

  function collectFindRanges(needle: string) {
    findRanges = [];
    if (!needle) return;

    const root = document.querySelector(
      isBilingualView ? '.bilingual-workspace' : '.reading-canvas .markdown-prose'
    ) as HTMLElement | null;
    if (!root) return;

    const lowerNeedle = needle.toLowerCase();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest('script, style')) return NodeFilter.FILTER_REJECT;
        return node.nodeValue && node.nodeValue.toLowerCase().includes(lowerNeedle)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      }
    });

    let node = walker.nextNode();
    while (node) {
      const text = (node.nodeValue || '').toLowerCase();
      let position = text.indexOf(lowerNeedle);

      while (position !== -1) {
        const range = document.createRange();
        range.setStart(node, position);
        range.setEnd(node, position + lowerNeedle.length);
        findRanges.push(range);
        if (findRanges.length >= 400) return;
        position = text.indexOf(lowerNeedle, position + lowerNeedle.length);
      }

      node = walker.nextNode();
    }
  }

  function paintFindHighlights() {
    const cssHighlights = (window as any).CSS?.highlights;
    const HighlightCtor = (window as any).Highlight;
    if (!cssHighlights || !HighlightCtor) return;

    clearHighlights();
    if (findRanges.length === 0) return;

    cssHighlights.set('cpim-find', new HighlightCtor(...findRanges));
    const current = findRanges[findIndex];
    if (current) cssHighlights.set('cpim-find-current', new HighlightCtor(current));
  }

  function scrollToCurrentMatch() {
    const range = findRanges[findIndex];
    if (!range) return;
    const rect = range.getBoundingClientRect();
    window.scrollBy({
      top: rect.top - window.innerHeight / 2,
      behavior: 'smooth'
    });
  }

  function runFind(query: string) {
    collectFindRanges(query);
    findIndex = 0;
    findMatches = findRanges.length;
    paintFindHighlights();
    if (findRanges.length > 0) scrollToCurrentMatch();
  }

  function stepFind(direction: 1 | -1) {
    if (findRanges.length === 0) return;
    findIndex = (findIndex + direction + findRanges.length) % findRanges.length;
    paintFindHighlights();
    scrollToCurrentMatch();
  }

  // Re-run the search as the query changes
  $effect(() => {
    const query = findQuery.trim();
    if (!findOpen) return;

    if (findTimer) clearTimeout(findTimer);
    findTimer = setTimeout(() => runFind(query), 140);
    return () => {
      if (findTimer) clearTimeout(findTimer);
    };
  });

  /** Nearest preceding heading for a node inside the prose column. */
  function findEnclosingHeading(node: Element): { headingId?: string; headingText?: string } {
    let current: Element | null = node;

    while (current && !current.classList.contains('markdown-prose')) {
      let sibling: Element | null = current.previousElementSibling;
      while (sibling) {
        const heading = sibling.matches('h1, h2, h3')
          ? sibling
          : sibling.querySelector('h1, h2, h3');
        if (heading) {
          return {
            headingId: heading.id || undefined,
            headingText: heading.textContent?.trim() || undefined
          };
        }
        sibling = sibling.previousElementSibling;
      }
      current = current.parentElement;
    }

    return {};
  }

  function handleDocumentKeydown(event: KeyboardEvent) {
    const isFindShortcut =
      (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f';
    if (isFindShortcut) {
      event.preventDefault();
      openFind();
      return;
    }
    if (event.key === 'Escape' && findOpen) {
      event.preventDefault();
      closeFind();
    }
  }

  function handleProseSelection() {
    if (typeof window === 'undefined') return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      passage = null;
      return;
    }

    const text = selection.toString().trim();
    if (text.length < 12) {
      passage = null;
      return;
    }

    const anchor = selection.anchorNode;
    const anchorEl =
      anchor?.nodeType === Node.TEXT_NODE ? anchor.parentElement : (anchor as Element | null);
    if (!anchorEl || !anchorEl.closest('.markdown-prose')) {
      passage = null;
      return;
    }

    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      passage = null;
      return;
    }

    const heading = findEnclosingHeading(anchorEl);
    const toolbarWidth = 300;
    const left = Math.min(
      Math.max(rect.left + rect.width / 2, toolbarWidth / 2 + 12),
      window.innerWidth - toolbarWidth / 2 - 12
    );

    passage = {
      text,
      ...heading,
      top: Math.max(rect.top - 52, 12),
      left
    };
  }

  function dismissPassage() {
    passage = null;
  }

  async function copyText(value: string, feedback: string) {
    try {
      await navigator.clipboard.writeText(value);
      passageFeedback = feedback;
      setTimeout(() => (passageFeedback = null), 1800);
    } catch {
      passageFeedback = 'COPY FAILED';
      setTimeout(() => (passageFeedback = null), 1800);
    }
  }

  async function copyPassageLink() {
    if (!passage) return;
    await copyText(documentUrl(data.meta.slug, passage.headingId), '✓ LINK COPIED');
  }

  async function copyPassageQuote() {
    if (!passage) return;
    const section = passage.headingText ? `${passage.headingText}. ` : '';
    const quote = `“${passage.text}” — ${section}${data.meta.title} (${data.meta.date}), CPI(M) Documents Archive. ${documentUrl(data.meta.slug, passage.headingId)}`;
    await copyText(quote, '✓ QUOTE COPIED');
  }

  function citePassage() {
    if (!passage) return;
    activeSectionTitle = passage.headingText || '';
    showCiteDrawer = true;
    passage = null;
  }

  function openMobileToc() {
    mobileTocOpen = true;
  }

  function closeMobileToc() {
    mobileTocOpen = false;
  }

  function scrollToHeading(id: string, e?: MouseEvent) {
    if (e) e.preventDefault();
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      activeHeadingId = id;
      history.pushState(null, '', `#${id}`);
    }
    mobileTocOpen = false;
  }

  /**
   * Highlights the section currently under the reading band. Design system 5.3
   * specifies an IntersectionObserver; previously the active item only ever
   * changed when the reader clicked a TOC link.
   */
  function setupScrollSpy() {
    scrollSpy?.disconnect();
    scrollSpy = null;

    if (typeof IntersectionObserver === 'undefined' || headings.length === 0) return;

    // id -> top of the heading inside the observation band
    const inBand = new Map<string, number>();

    scrollSpy = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inBand.set(entry.target.id, entry.boundingClientRect.top);
          else inBand.delete(entry.target.id);
        }
        if (inBand.size === 0) return; // mid-section: keep the last known heading
        const nearestTop = [...inBand.entries()].sort((a, b) => a[1] - b[1])[0];
        if (nearestTop && nearestTop[0] !== activeHeadingId) {
          activeHeadingId = nearestTop[0];
        }
      },
      { rootMargin: '-88px 0px -62% 0px', threshold: 0 }
    );

    for (const heading of headings) {
      const el = document.getElementById(heading.id);
      if (el) scrollSpy.observe(el);
    }
  }

  /** Rebuild heading list, table wrappers and the scroll spy after a re-render. */
  function refreshSectionNavigation() {
    refreshHeadings();
    wrapProseTables();
    setupScrollSpy();
    invalidateSyncAnchors();
  }

  function wrapProseTables() {
    document.querySelectorAll('.markdown-prose table').forEach((table) => {
      const parent = table.parentElement;
      if (parent && parent.classList.contains('table-scroll')) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'table-scroll';
      wrapper.setAttribute('role', 'region');
      wrapper.setAttribute('tabindex', '0');
      wrapper.setAttribute('aria-label', 'Data table');
      table.parentNode?.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });
  }

  function refreshHeadings() {
    // In bilingual mode the master (original) pane defines the document's
    // structure; indexing the translation produced a Malayalam/Hindi TOC in an
    // otherwise English interface.
    const selector = isBilingualView
      ? '.bilingual-pane.master-pane h1, .bilingual-pane.master-pane h2, .bilingual-pane.master-pane h3'
      : '.reading-canvas .markdown-prose h1, .reading-canvas .markdown-prose h2, .reading-canvas .markdown-prose h3';

    const elements = document.querySelectorAll(selector);
    const collected: Array<{ id: string; text: string; level: number }> = [];
    const seenSlugs = new Map<string, number>();

    elements.forEach((el) => {
      const headingEl = el as HTMLElement;
      let rawText = headingEl.innerText.replace(/^#+\s*/, '').trim();
      rawText = rawText.replace(/\*\*/g, '').replace(/\*/g, '').replace(/__+/g, '').trim();

      if (!rawText) return;
      if (headingEl.tagName === 'H1' && rawText.toLowerCase() === (displayTitle || '').toLowerCase()) {
        return;
      }

      const level = headingEl.tagName === 'H1' ? 1 : headingEl.tagName === 'H2' ? 2 : 3;

      if (!headingEl.id) {
        const base = rawText
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s-]/gu, '')
          .trim()
          .replace(/\s+/g, '-');
        const count = seenSlugs.get(base) || 0;
        seenSlugs.set(base, count + 1);
        headingEl.id = count === 0 ? (base || `section-${collected.length + 1}`) : `${base}-${count}`;
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
  }

  // ---------------------------------------------------------------------------
  // Bilingual scroll synchronisation
  //
  // A pure scroll-ratio mapping drifts badly: a Malayalam translation of an
  // English report is not proportionally longer section by section, so after a
  // few screens the panes are discussing different paragraphs.
  //
  // Instead each pane's headings are measured once, then a scroll position is
  // interpolated inside the *current heading segment* only. Error stays bounded
  // to one section and resets at every heading.
  // ---------------------------------------------------------------------------

  let syncAnchors: { master: number[]; trans: number[] } | null = null;
  let suppressMasterSync = false;
  let suppressTransSync = false;

  function measurePaneAnchors(pane: HTMLElement): number[] {
    const paneTop = pane.getBoundingClientRect().top - pane.scrollTop;
    const offsets = Array.from(
      pane.querySelectorAll<HTMLElement>('.markdown-prose h1, .markdown-prose h2, .markdown-prose h3')
    ).map((heading) => heading.getBoundingClientRect().top - paneTop);

    offsets.push(pane.scrollHeight); // closing sentinel: end of document
    return offsets;
  }

  function refreshSyncAnchors() {
    if (!masterPaneEl || !transPaneEl) {
      syncAnchors = null;
      return;
    }
    syncAnchors = {
      master: measurePaneAnchors(masterPaneEl),
      trans: measurePaneAnchors(transPaneEl)
    };
  }

  function invalidateSyncAnchors() {
    syncAnchors = null;
  }

  function syncPanes(source: 'master' | 'trans') {
    const from = source === 'master' ? masterPaneEl : transPaneEl;
    const to = source === 'master' ? transPaneEl : masterPaneEl;
    if (!from || !to) return;

    if (!syncAnchors) refreshSyncAnchors();
    if (!syncAnchors) return;

    const fromAnchors = source === 'master' ? syncAnchors.master : syncAnchors.trans;
    const toAnchors = source === 'master' ? syncAnchors.trans : syncAnchors.master;
    const pairs = Math.min(fromAnchors.length, toAnchors.length);
    if (pairs === 0) return;

    // Current heading segment (clamped to the paired range)
    const y = from.scrollTop + 2;
    let segment = 0;
    for (let i = 0; i < pairs; i += 1) {
      if (fromAnchors[i] <= y) segment = i;
      else break;
    }

    const fromStart = fromAnchors[segment];
    const fromEnd = fromAnchors[segment + 1] ?? from.scrollHeight;
    const toStart = toAnchors[segment];
    const toEnd = toAnchors[segment + 1] ?? to.scrollHeight;

    const span = fromEnd - fromStart;
    const fraction = span > 4 ? Math.min(1, Math.max(0, (y - fromStart) / span)) : 0;
    const target = Math.round(toStart + fraction * (toEnd - toStart));

    // Ignore the scroll event our own assignment will produce, but only if the
    // position actually changes (otherwise no event arrives and the guard would
    // swallow the next genuine scroll).
    if (Math.abs(target - to.scrollTop) > 1) {
      if (source === 'master') suppressTransSync = true;
      else suppressMasterSync = true;
      to.scrollTop = target;
    }
  }

  function handleMasterScroll() {
    if (suppressMasterSync) {
      suppressMasterSync = false;
      return;
    }
    syncPanes('master');
    updateScroll();
  }

  function handleTransScroll() {
    if (suppressTransSync) {
      suppressTransSync = false;
      return;
    }
    syncPanes('trans');
  }

  // Typography or theme changes invalidate the measured heading positions
  $effect(() => {
    void [readerFontSize, readerMeasure, readerTheme];
    syncAnchors = null;
  });

  // Keep the active TOC entry in view without scrolling the page
  $effect(() => {
    const id = activeHeadingId;
    if (!id || !tocScrollerEl) return;
    const active = tocScrollerEl.querySelector(`[data-toc-id="${id}"]`) as HTMLElement | null;
    if (!active) return;

    const box = tocScrollerEl.getBoundingClientRect();
    const item = active.getBoundingClientRect();
    if (item.top < box.top + 8 || item.bottom > box.bottom - 8) {
      tocScrollerEl.scrollTop +=
        item.top - box.top - tocScrollerEl.clientHeight / 2 + item.height / 2;
    }
  });

  onMount(() => {
    // Check if query params request a language
    const searchParams = new URLSearchParams(window.location.search);
    const requestedLang = searchParams.get('lang');
    if (requestedLang && availableTranslations[requestedLang]) {
      currentLang = requestedLang;
    }

    restoreReaderPrefs();

    window.addEventListener('scroll', updateScroll, { passive: true });
    updateScroll();
    refreshSectionNavigation();

    // Offer to resume when there is meaningful saved progress and the visitor
    // did not arrive at a specific anchor.
    const saved = getProgress(data.meta.slug);
    if (saved && saved.percent >= 3 && saved.percent <= 98 && !window.location.hash) {
      resumeEntry = saved;
    }

    const handleResize = () => invalidateSyncAnchors();
    window.addEventListener('resize', handleResize);

    const flushProgress = () => persistProgress(true);
    window.addEventListener('pagehide', flushProgress);
    document.addEventListener('visibilitychange', flushProgress);

    document.addEventListener('mouseup', handleProseSelection);
    document.addEventListener('keyup', handleProseSelection);
    document.addEventListener('keydown', handleDocumentKeydown);
    window.addEventListener('scroll', dismissPassage, { passive: true });

    return () => {
      window.removeEventListener('scroll', updateScroll);
      window.removeEventListener('pagehide', flushProgress);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', flushProgress);
      document.removeEventListener('mouseup', handleProseSelection);
      document.removeEventListener('keyup', handleProseSelection);
      document.removeEventListener('keydown', handleDocumentKeydown);
      clearHighlights();
      window.removeEventListener('scroll', dismissPassage);
      scrollSpy?.disconnect();
    };
  });
</script>

<svelte:head>
  <title>{displayTitle} — CPI(M) Official Archive</title>
  {#if configuredSiteOrigin}
    <link rel="canonical" href={documentUrl(data.meta.slug)} />
    <meta property="og:type" content="article" />
    <meta property="og:title" content={displayTitle} />
    <meta property="og:url" content={documentUrl(data.meta.slug)} />
    <meta name="citation_publication_date" content={data.meta.date} />
    <meta name="citation_title" content={displayTitle} />
  {/if}
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
        <nav class="crumbs" aria-label="Breadcrumb">
          <a href="/" class="crumb">CATALOG</a>
          <span class="crumb-sep" aria-hidden="true">/</span>
          <span class="crumb">{data.meta.category}</span>
          {#if data.meta.period}
            <span class="crumb-sep" aria-hidden="true">/</span>
            <a
              href={`/?period=${data.meta.period}`}
              class="crumb"
              title="All documents from this Congress / election cycle"
            >
              {getPeriodLabel(data.meta.period, currentLang)}
            </a>
          {/if}
        </nav>
      </div>

      <div class="meta-strip">
        <a
          class="badge category"
          href={`/?cat=${encodeURIComponent(data.meta.category)}`}
          title="All {data.meta.category} documents"
          data-pagefind-filter="category">{data.meta.category}</a>
        {#if data.meta.doc_type}
          <a
            class="badge doc-type-badge"
            href={`/browse/formats/${data.meta.doc_type}`}
            title="Browse all {getDocTypeLabel(data.meta.doc_type)} documents"
            data-pagefind-filter="type">{getDocTypeLabel(data.meta.doc_type, currentLang).toUpperCase()}</a>
        {/if}
        {#if data.meta.period}
          <a
            class="badge period-badge"
            href={`/browse/periods/${data.meta.period}`}
            title="Browse this Congress / election cycle"
            data-pagefind-filter="period">{getPeriodLabel(data.meta.period, currentLang).toUpperCase()}</a>
        {/if}
        <time class="meta-item date" datetime={data.meta.date}>{data.meta.date}</time>
        {#if data.meta.page_count}
          <span class="meta-item pages">{data.meta.page_count} PAGES</span>
        {/if}
        {#if data.meta.extraction_method}
          <span class="badge method">{data.meta.extraction_method.toUpperCase()}</span>
        {/if}
        <span class="badge lang-tag" data-pagefind-filter="language">{currentLang.toUpperCase()}</span>
      </div>

      {#if data.meta.topics && data.meta.topics.length > 0}
        <div class="reader-topics-strip">
          <span class="topics-label">INDEXED TOPICS:</span>
          {#each data.meta.topics as t}
            <a
              class="badge topic-badge"
              href={`/browse/topics/${t}`}
              title="Browse all documents on this topic"
              data-pagefind-filter="topic">#{getTopicLabel(t, currentLang)}</a>
          {/each}
          {#if data.meta.geo && data.meta.geo.length > 0}
            {#each data.meta.geo as g}
              <a
                class="badge geo-badge"
                href={`/browse/regions/${g}`}
                title="Browse all documents from this region"
                data-pagefind-filter="geo">⚲ {getGeoLabel(g, currentLang).toUpperCase()}</a>
            {/each}
          {/if}
        </div>
      {/if}

      <h1 class="document-headline" lang={currentLang} class:indic-prose-ml={currentLang === 'ml'} class:indic-prose-hi={currentLang === 'hi'}>
        {displayTitle}
      </h1>

      {#if activeTranslation && activeTranslation.original_title}
        <div class="original-title-sub">
          <span class="sub-label">ORIGINAL ENGLISH TITLE:</span>
          <span class="sub-text">{activeTranslation.original_title}</span>
        </div>
      {/if}

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
            onclick={() => {
              showPdfSplit = !showPdfSplit;
              if (showPdfSplit) isBilingualView = false;
            }}
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

      <!-- Constructivist Language Selector & Bilingual Controller -->
      <LanguageSelector
        {currentLang}
        isBilingual={isBilingualView}
        {availableTranslations}
        onSelectLang={handleSelectLang}
        onToggleBilingual={handleToggleBilingual}
      />

      <!-- Reader presentation controls (text size, measure, page theme) -->
      <ReadingControls
        bind:fontSize={readerFontSize}
        bind:measure={readerMeasure}
        bind:theme={readerTheme}
      />
    </div>
  </header>

  {#if resumeEntry && !resumeDismissed}
    <div class="resume-banner" role="status">
      <div class="resume-text">
        <span class="resume-stamp">◷ CONTINUE READING</span>
        <span class="resume-detail">
          You stopped at <strong>{resumeEntry.percent}%</strong>{#if resumeEntry.headingText}
            in <em>{resumeEntry.headingText}</em>{/if}.
        </span>
      </div>
      <div class="resume-actions">
        <button type="button" class="resume-btn primary" onclick={jumpToSavedPosition}>
          RESUME
        </button>
        <button
          type="button"
          class="resume-btn"
          onclick={() => {
            resumeDismissed = true;
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          START OVER
        </button>
      </div>
    </div>
  {/if}

  <!-- Workspace Container: TOC Sidebar + Editorial Prose + Split PDF Pane -->
  <div
    class="reader-workspace"
    class:split-active={showPdfSplit}
    class:bilingual-active={isBilingualView}
    style={`--reader-font-size: ${readerFontSize}rem; --reader-measure: ${readerMeasure}ch;`}
  >
    <!-- Sticky Table of Contents & Related Resolutions Sidebar -->
    <aside class="toc-sidebar" aria-label="Table of Contents and Related Documents" bind:this={tocScrollerEl}>
      {#if headings.length > 0}
        <div class="toc-sticky-box">
          <div class="toc-title-stamp">
            {currentLang === 'ml' ? 'പ്രമേയ ഉള്ളടക്കം' : currentLang === 'hi' ? 'दस्तावेज़ की विषय-सूची' : 'DOCUMENT SECTIONS'}
          </div>
          <nav class="toc-list">
            {#each headings as h}
              <a
                href={`#${h.id}`}
                data-toc-id={h.id}
                aria-current={activeHeadingId === h.id ? 'location' : undefined}
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
    {#if !isBilingualView}
      <!-- Single Column Standard Mode -->
      <main
        class="reading-canvas"
        data-reader-theme={readerTheme}
        lang={currentLang}
        class:indic-prose-ml={currentLang === 'ml'}
        class:indic-prose-hi={currentLang === 'hi'}
        class:indic-prose-bn={currentLang === 'bn'}
      >
        <div class="markdown-prose">
          {#if currentLang !== 'en' && ActiveTransComponent}
            <ActiveTransComponent />
          {:else}
            <data.content />
          {/if}
        </div>

        <div class="end-of-document">
          <div class="end-stamp">∎ END OF OFFICIAL ARCHIVAL RESOLUTION ∎</div>
          <p class="end-meta">
            Preserved in the CPI(M) Research Repository under SHA256 integrity hash:
            <code>{data.meta.sha256 || 'verified-record'}</code>
          </p>
        </div>

        <div class="print-footer" aria-hidden="true">
          <p class="print-title">{displayTitle}</p>
          <p>{data.meta.author || 'Central Committee, Communist Party of India (Marxist)'} · {data.meta.date}</p>
          <p>CPI(M) Documents Archive · {documentUrl(data.meta.slug)}</p>
          {#if data.meta.source_pdf_url}
            <p>Facsimile: {data.meta.source_pdf_url}</p>
          {/if}
          {#if data.meta.sha256}
            <p>SHA256: {data.meta.sha256}</p>
          {/if}
        </div>

        {#if data.neighbors && (data.neighbors.older || data.neighbors.newer)}
          <nav class="doc-pager" aria-label="Adjacent documents">
            {#if data.neighbors.older}
              <a class="pager-item older" href={`/docs/${data.neighbors.older.slug}`}>
                <span class="pager-dir">← EARLIER DOCUMENT</span>
                <span class="pager-title">{data.neighbors.older.title}</span>
                <span class="pager-date">{data.neighbors.older.date}</span>
              </a>
            {:else}
              <span class="pager-item empty"></span>
            {/if}
            {#if data.neighbors.newer}
              <a class="pager-item newer" href={`/docs/${data.neighbors.newer.slug}`}>
                <span class="pager-dir">LATER DOCUMENT →</span>
                <span class="pager-title">{data.neighbors.newer.title}</span>
                <span class="pager-date">{data.neighbors.newer.date}</span>
              </a>
            {/if}
          </nav>
        {/if}

        {#if data.neighbors && (data.neighbors.periodPrevious || data.neighbors.periodNext)}
          <nav class="period-pager" aria-label="Documents from the same Congress or election cycle">
            <span class="period-pager-label">
              {getPeriodLabel(data.meta.period, currentLang).toUpperCase()} — CONTINUE IN THIS SERIES
            </span>
            <div class="period-pager-items">
              {#if data.neighbors.periodPrevious}
                <a href={`/docs/${data.neighbors.periodPrevious.slug}`} class="period-pager-item">
                  ← {data.neighbors.periodPrevious.title}
                </a>
              {/if}
              {#if data.neighbors.periodNext}
                <a href={`/docs/${data.neighbors.periodNext.slug}`} class="period-pager-item next">
                  {data.neighbors.periodNext.title} →
                </a>
              {/if}
            </div>
          </nav>
        {/if}
      </main>
    {:else}
      <!-- Parallel Bilingual Comparative Mode -->
      <div class="bilingual-workspace" aria-label="Side-by-side Comparative Reading">
        <!-- Left: English Master Text -->
        <div
          class="bilingual-pane master-pane"
          data-reader-theme={readerTheme}
          bind:this={masterPaneEl}
          onscroll={handleMasterScroll}
        >
          <div class="pane-header-stamp">
            <span class="stamp-pill en">ENGLISH MASTER RESOLUTION</span>
          </div>
          <div class="markdown-prose master-prose">
            <data.content />
          </div>
        </div>

        <!-- Right: Indian Language Translation Text -->
        <div
          class="bilingual-pane trans-pane"
          data-reader-theme={readerTheme}
          lang={currentLang}
          class:indic-prose-ml={currentLang === 'ml'}
          class:indic-prose-hi={currentLang === 'hi'}
          class:indic-prose-bn={currentLang === 'bn'}
          bind:this={transPaneEl}
          onscroll={handleTransScroll}
        >
          <div class="pane-header-stamp">
            <span class="stamp-pill indic">
              {currentLang.toUpperCase()} VERIFIED TRANSLATION ({activeTranslation?.language_name || currentLang})
            </span>
          </div>
          <div class="markdown-prose trans-prose">
            {#if ActiveTransComponent}
              <ActiveTransComponent />
            {:else}
              <p class="placeholder-msg">Translation not available in this language.</p>
            {/if}
          </div>
        </div>
      </div>
    {/if}

    <!-- Side-by-Side Split View PDF Pane -->
    {#if showPdfSplit && data.meta.source_pdf_url}
      <aside class="pdf-pane" aria-label="Original Source PDF Verification">
        <div class="pdf-pane-header">
          <span class="pdf-pane-title">ORIGINAL SOURCE PDF VERIFICATION</span>
          <div class="pdf-pane-actions">
            <a
              href={data.meta.source_pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              class="pdf-open-link"
              title="Open the facsimile in a new tab"
            >
              OPEN ↗
            </a>
            <button
              type="button"
              class="pdf-close-btn"
              onclick={() => (showPdfSplit = false)}
              aria-label="Close PDF pane"
            >
              ✕
            </button>
          </div>
        </div>
        <iframe
          src={data.meta.source_pdf_url}
          title="Official Source PDF"
          class="pdf-iframe"
        ></iframe>
        <p class="pdf-pane-note">
          Publishers sometimes block embedded viewing. If the facsimile stays blank,
          <a href={data.meta.source_pdf_url} target="_blank" rel="noopener noreferrer">open it directly ↗</a>.
        </p>
      </aside>
    {/if}
  </div>
</article>

<!-- In-document find bar -->
{#if findOpen}
  <div class="find-bar" role="search" aria-label="Find in this document">
    <input
      type="search"
      class="find-input"
      bind:this={findInputEl}
      bind:value={findQuery}
      placeholder="Find in this document…"
      aria-label="Find in this document"
      onkeydown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          stepFind(e.shiftKey ? -1 : 1);
        }
      }}
    />
    <span class="find-count" aria-live="polite">
      {#if findQuery.trim()}
        {findMatches === 0 ? 'NO MATCHES' : `${findIndex + 1} / ${findMatches}`}
      {:else}
        TYPE TO SEARCH
      {/if}
    </span>
    <div class="find-actions">
      <button
        type="button"
        class="find-btn"
        onclick={() => stepFind(-1)}
        disabled={findMatches === 0}
        aria-label="Previous match"
      >
        ↑
      </button>
      <button
        type="button"
        class="find-btn"
        onclick={() => stepFind(1)}
        disabled={findMatches === 0}
        aria-label="Next match"
      >
        ↓
      </button>
      <button type="button" class="find-btn close" onclick={closeFind} aria-label="Close find bar">
        ✕
      </button>
    </div>
  </div>
{/if}

<!-- Passage selection actions -->
{#if passage}
  <div
    class="passage-toolbar"
    style={`top: ${passage.top}px; left: ${passage.left}px;`}
    role="toolbar"
    aria-label="Passage actions"
  >
    {#if passageFeedback}
      <span class="passage-feedback" role="status">{passageFeedback}</span>
    {:else}
      <button
        type="button"
        class="passage-btn"
        onmousedown={(e) => e.preventDefault()}
        onclick={copyPassageLink}
        title="Copy a permalink to this section"
      >
        LINK
      </button>
      <button
        type="button"
        class="passage-btn"
        onmousedown={(e) => e.preventDefault()}
        onclick={copyPassageQuote}
        title="Copy the selection as a citation"
      >
        QUOTE
      </button>
      <button
        type="button"
        class="passage-btn primary"
        onmousedown={(e) => e.preventDefault()}
        onclick={citePassage}
        title="Open the citation generator for this section"
      >
        CITE SECTION
      </button>
    {/if}
  </div>
{/if}

<!-- Mobile section navigation (sidebar is hidden below 1024px) -->
{#if headings.length > 0}
  <button
    type="button"
    class="mobile-toc-trigger"
    onclick={openMobileToc}
    aria-expanded={mobileTocOpen}
    aria-controls="mobile-toc-sheet"
  >
    <span class="trigger-icon" aria-hidden="true">☰</span>
    <span class="trigger-label">SECTIONS</span>
    {#if activeHeadingText}
      <span class="trigger-current">{activeHeadingText}</span>
    {/if}
  </button>

  {#if mobileTocOpen}
    <div class="mobile-toc-backdrop" onclick={closeMobileToc} role="presentation"></div>
    <div
      class="mobile-toc-sheet"
      id="mobile-toc-sheet"
      role="dialog"
      aria-modal="true"
      aria-label="Document sections"
    >
      <div class="sheet-header">
        <span class="sheet-title">
          {currentLang === 'ml' ? 'പ്രമേയ ഉള്ളടക്കം' : currentLang === 'hi' ? 'दस्तावेज़ की विषय-सूची' : 'DOCUMENT SECTIONS'}
        </span>
        <button type="button" class="sheet-close" onclick={closeMobileToc} aria-label="Close sections">
          ✕
        </button>
      </div>
      <nav class="sheet-list">
        {#each headings as h}
          <a
            href={`#${h.id}`}
            class="sheet-item level-{h.level}"
            class:active={activeHeadingId === h.id}
            onclick={(e) => scrollToHeading(h.id, e)}
          >
            {h.text}
          </a>
        {/each}
      </nav>
    </div>
  {/if}
{/if}

<!-- Academic Citation Modal -->
{#if showCiteDrawer}
  <CitationModal
    doc={data.meta}
    currentUrl={documentUrl(data.meta.slug)}
    sectionTitle={activeSectionTitle}
    onclose={() => {
      showCiteDrawer = false;
      activeSectionTitle = '';
    }}
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

  /* Reader Page Layout */
  .reader-container {
    background-color: var(--reader-bg);
    min-height: 100vh;
  }

  /* Document Header Section */
  .doc-header {
    background-color: var(--color-paper);
    border-bottom: var(--border-heavy);
    padding: 3rem 1.5rem 2.5rem;
  }

  .header-inner {
    max-width: 1400px;
    margin: 0 auto;
  }

  .nav-breadcrumbs {
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .crumbs {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    letter-spacing: 0.04em;
    color: var(--color-gray-dark);
    flex-wrap: wrap;
  }

  .crumb {
    color: var(--color-gray-dark);
    text-transform: uppercase;
  }

  .crumb:hover {
    color: var(--color-red-primary);
    text-decoration: underline;
  }

  .crumb-sep {
    color: var(--color-gray-light);
  }

  .back-link {
    font-family: var(--font-display);
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: var(--color-black);
    padding: 0.4rem 0.8rem;
    border: 2px solid var(--color-black);
    background-color: var(--color-paper-light);
    box-shadow: var(--shadow-hard-sm);
    transition: all 0.1s ease;
    display: inline-block;
  }

  .back-link:hover {
    transform: translate(-1px, -1px);
    box-shadow: var(--shadow-hard-md);
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
    text-decoration: none;
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.25rem 0.6rem;
    border: 1px solid var(--color-black);
    text-transform: uppercase;
  }

  .badge:hover {
    filter: brightness(1.25);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .badge.category {
    background-color: var(--color-black);
    color: #FFFFFF;
  }

  .badge.doc-type-badge {
    background-color: var(--color-red-primary);
    color: #FFFFFF;
  }

  .badge.period-badge {
    background-color: var(--color-gold);
    color: #000000;
  }

  .reader-topics-strip {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 1.25rem;
  }

  .topics-label {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: var(--color-gray-dark);
  }

  .badge.topic-badge {
    background-color: #FAF5EB;
    color: var(--color-black);
    border: 1px solid #555555;
    font-size: 0.72rem;
  }

  .badge.geo-badge {
    background-color: var(--color-paper-dark);
    color: var(--color-black);
    border: 1px solid var(--color-black);
    font-size: 0.72rem;
  }

  .badge.method {
    background-color: var(--color-paper-dark);
    color: var(--color-black);
  }

  .badge.lang-tag {
    background-color: var(--color-red-primary);
    color: #FFFFFF;
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
    line-height: 1.25;
    color: var(--color-black);
    margin: 0.5rem 0 1rem;
    max-width: 950px;
  }

  .original-title-sub {
    margin-bottom: 1rem;
    padding: 0.4rem 0.75rem;
    background: var(--color-paper-dark);
    border-left: 3px solid var(--color-red-primary);
    display: inline-block;
  }

  .sub-label {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--color-gray-dark);
    margin-right: 0.5rem;
  }

  .sub-text {
    font-family: var(--font-prose);
    font-size: 0.95rem;
    font-style: italic;
    color: var(--color-black);
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

  /* Resume reading banner */
  .resume-banner {
    max-width: 1400px;
    margin: 1.5rem auto 0;
    padding: 0.85rem 1.15rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.85rem;
    background-color: var(--color-black);
    color: var(--color-paper-light);
    border: var(--border-medium);
    box-shadow: var(--shadow-hard-sm);
  }

  .resume-text {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    flex-wrap: wrap;
    font-size: 0.85rem;
  }

  .resume-stamp {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.09em;
    color: var(--color-gold);
  }

  .resume-detail {
    color: #e4e2dd;
  }

  .resume-detail em {
    font-family: var(--font-prose);
    color: #ffffff;
  }

  .resume-actions {
    display: flex;
    gap: 0.5rem;
  }

  .resume-btn {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 0.35rem 0.75rem;
    border: 1.5px solid var(--color-paper-light);
    background-color: transparent;
    color: var(--color-paper-light);
    cursor: pointer;
  }

  .resume-btn.primary {
    background-color: var(--color-red-primary);
    border-color: var(--color-red-primary);
    color: #ffffff;
  }

  .resume-btn:hover {
    background-color: var(--color-gold);
    border-color: var(--color-gold);
    color: var(--color-black);
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

  .reader-workspace.bilingual-active {
    grid-template-columns: 220px 1fr;
    gap: 2rem;
  }

  /* Sticky Table of Contents Sidebar */
  .toc-sidebar {
    position: sticky;
    top: 4.75rem;
    max-height: calc(100vh - 6.25rem);
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

  /* Parallel Bilingual Workspace */
  .bilingual-workspace {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    width: 100%;
  }

  .bilingual-pane {
    background: #FFFFFF;
    border: var(--border-medium);
    padding: 2rem;
    box-shadow: var(--shadow-hard-sm);
    max-height: calc(100vh - 6rem);
    overflow-y: auto;
  }

  .pane-header-stamp {
    margin-bottom: 1.5rem;
    padding-bottom: 0.75rem;
    border-bottom: 2px solid var(--color-black);
  }

  .stamp-pill {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    padding: 0.25rem 0.6rem;
    border: 1px solid var(--color-black);
    display: inline-block;
  }

  .stamp-pill.en {
    background: var(--color-black);
    color: #FFFFFF;
  }

  .stamp-pill.indic {
    background: var(--color-red-primary);
    color: #FFFFFF;
  }

  /* Editorial Markdown Prose Styles */
  :global(.markdown-prose) {
    font-family: var(--font-prose);
    font-size: var(--reader-font-size, 1.18rem);
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
    scroll-margin-top: 6.5rem;
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
    scroll-margin-top: 6.5rem;
  }

  :global(.markdown-prose h3) {
    font-family: var(--font-prose);
    font-size: 1.4rem;
    font-weight: 700;
    line-height: 1.35;
    color: var(--color-red-dark);
    margin: 2.25rem 0 0.85rem;
    scroll-margin-top: 6rem;
  }

  :global(.markdown-prose p) {
    margin: 0 0 1.5rem;
    text-align: justify;
    text-justify: inter-word;
    hyphens: auto;
    -webkit-hyphens: auto;
  }

  :global(.markdown-prose strong) {
    color: var(--color-black);
    font-weight: 700;
  }

  :global(.markdown-prose em) {
    font-style: italic;
  }

  :global(.markdown-prose blockquote) {
    border-left: 3px solid var(--color-red-primary);
    margin: 2rem 0;
    padding: 0.75rem 1.5rem;
    background-color: var(--color-paper);
    font-style: italic;
  }

  :global(.markdown-prose blockquote p:last-child) {
    margin-bottom: 0;
  }

  /* Lists — 6,970 bullet lines across the archive */
  :global(.markdown-prose ul),
  :global(.markdown-prose ol) {
    margin: 0 0 1.6rem;
    padding-left: 1.6rem;
  }

  :global(.markdown-prose ul) {
    list-style-type: square;
  }

  :global(.markdown-prose li) {
    margin-bottom: 0.55rem;
    padding-left: 0.15rem;
  }

  :global(.markdown-prose li > ul),
  :global(.markdown-prose li > ol) {
    margin-top: 0.55rem;
    margin-bottom: 0;
  }

  :global(.markdown-prose li > p) {
    margin-bottom: 0.55rem;
  }

  :global(.markdown-prose ul > li::marker) {
    color: var(--color-red-primary);
    font-size: 0.9em;
  }

  :global(.markdown-prose ol > li::marker) {
    font-family: var(--font-mono);
    font-size: 0.88em;
    font-weight: 700;
    color: var(--color-red-primary);
  }

  /* Inline links — headings are excluded (rehype-autolink wraps them in <a>) */
  :global(.markdown-prose p a),
  :global(.markdown-prose li a),
  :global(.markdown-prose td a) {
    color: var(--reader-link);
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 2px;
  }

  :global(.markdown-prose p a:hover),
  :global(.markdown-prose li a:hover),
  :global(.markdown-prose td a:hover) {
    color: var(--color-red-dark);
    text-decoration-thickness: 2px;
  }

  :global(.markdown-prose h1 a),
  :global(.markdown-prose h2 a),
  :global(.markdown-prose h3 a) {
    color: inherit;
    text-decoration: none;
  }

  /* Inline code & preformatted blocks */
  :global(.markdown-prose code) {
    font-family: var(--font-mono);
    font-size: 0.86em;
    background-color: var(--color-paper-dark);
    border: 1px solid var(--color-gray-light);
    padding: 0.1rem 0.32rem;
  }

  :global(.markdown-prose pre) {
    background-color: #121212;
    color: #faf8f5;
    padding: 1.1rem 1.25rem;
    overflow-x: auto;
    margin: 0 0 1.6rem;
    line-height: 1.55;
    font-size: 0.85rem;
  }

  :global(.markdown-prose pre code) {
    background: transparent;
    border: none;
    padding: 0;
    font-size: inherit;
    color: inherit;
  }

  /* Horizontal rules */
  :global(.markdown-prose hr) {
    border: none;
    border-top: 2px solid var(--color-black);
    margin: 2.75rem 0;
  }

  /* Images */
  :global(.markdown-prose img) {
    max-width: 100%;
    height: auto;
    border: 1px solid var(--color-gray-light);
    background-color: #ffffff;
  }

  /* Reading themes (prose surface only — the shell stays constructivist) */
  .reading-canvas[data-reader-theme='white'],
  .bilingual-pane[data-reader-theme='white'] {
    background-color: #ffffff;
  }

  .reading-canvas[data-reader-theme='dim'],
  .bilingual-pane[data-reader-theme='dim'] {
    background-color: #16171a;
    border: 1px solid #33343a;
    padding: 2rem;
  }

  .reading-canvas[data-reader-theme='white'],
  .bilingual-pane[data-reader-theme='white'] {
    padding: 2rem;
    border: 1px solid var(--color-gray-light);
  }

  .reading-canvas[data-reader-theme='dim'] :global(.markdown-prose),
  .bilingual-pane[data-reader-theme='dim'] :global(.markdown-prose) {
    --reader-ink: #e4dfd4;
    --reader-ink-secondary: #a9a6a0;
    --color-black: #e4dfd4;
    --color-red-primary: #e8657c;
    --color-red-dark: #f08ca0;
    --color-paper: #202127;
    --color-paper-dark: #2a2b31;
    --color-gray-light: #3a3b41;
    --color-gray-dark: #b3b0a8;
  }

  .reading-canvas[data-reader-theme='dim'] :global(.markdown-prose .table-scroll) {
    --reader-table-bg: #1e1f24;
  }

  /* Data tables — 35 documents contain statistical tables */
  :global(.markdown-prose .table-scroll) {
    margin: 2rem 0;
    overflow-x: auto;
    border: 1px solid var(--color-gray-dark);
    background-color: var(--reader-table-bg, #ffffff);
    -webkit-overflow-scrolling: touch;
  }

  :global(.markdown-prose table) {
    border-collapse: collapse;
    width: 100%;
    font-family: var(--font-prose);
    font-size: 1rem;
    line-height: 1.45;
    font-variant-numeric: tabular-nums;
  }

  :global(.markdown-prose thead th) {
    background-color: #121212;
    color: #ffffff;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-align: left;
    padding: 0.6rem 0.8rem;
    border-right: 1px solid #3a3a3a;
    vertical-align: bottom;
  }

  :global(.markdown-prose tbody td) {
    padding: 0.55rem 0.8rem;
    border-bottom: 1px solid var(--color-gray-light);
    border-right: 1px solid var(--color-gray-light);
    vertical-align: top;
  }

  :global(.markdown-prose tbody tr:last-child td) {
    border-bottom: none;
  }

  :global(.markdown-prose tbody tr:nth-child(even)) {
    background-color: var(--color-paper);
  }

  :global(.markdown-prose tbody tr:hover) {
    background-color: rgba(196, 30, 58, 0.05);
  }

  :global(.markdown-prose td:first-child),
  :global(.markdown-prose th:first-child) {
    font-weight: 600;
  }

  /* End of Document Stamp */
  .end-of-document {
    margin-top: 4rem;
    padding-top: 2rem;
    border-top: 2px dashed var(--color-gray-dark);
    text-align: center;
  }

  .end-stamp {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--color-red-primary);
    margin-bottom: 0.75rem;
  }

  .end-meta {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--color-gray-dark);
  }

  .end-meta code {
    background-color: var(--color-paper-dark);
    padding: 0.2rem 0.4rem;
    border: 1px solid var(--color-gray-light);
  }

  /* Sequential document navigation */
  .doc-pager {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-top: 2.5rem;
  }

  .pager-item {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.9rem 1rem;
    border: 2px solid var(--color-black);
    background-color: var(--color-paper-light);
    box-shadow: var(--shadow-hard-sm);
    transition: all 0.1s ease;
  }

  .pager-item:hover {
    transform: translate(-1px, -1px);
    box-shadow: var(--shadow-hard-md);
    border-color: var(--color-red-primary);
  }

  .pager-item.empty {
    border: 1px dashed var(--color-gray-light);
    box-shadow: none;
    background: transparent;
    pointer-events: none;
  }

  .pager-item.newer {
    text-align: right;
    align-items: flex-end;
  }

  .pager-dir {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: var(--color-red-primary);
  }

  .pager-title {
    font-family: var(--font-display);
    font-size: 0.92rem;
    font-weight: 700;
    line-height: 1.3;
    color: var(--color-black);
  }

  .pager-date {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    color: var(--color-gray-dark);
  }

  .period-pager {
    margin-top: 2rem;
    border: 1px solid var(--color-gray-light);
    background-color: var(--color-paper);
    padding: 1rem 1.15rem;
  }

  .period-pager-label {
    display: block;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.07em;
    color: var(--color-gray-dark);
    border-bottom: 1px solid var(--color-gray-light);
    padding-bottom: 0.5rem;
    margin-bottom: 0.6rem;
  }

  .period-pager-items {
    display: flex;
    gap: 1.25rem;
    flex-wrap: wrap;
  }

  .period-pager-item {
    font-family: var(--font-prose);
    font-size: 0.92rem;
    color: var(--color-red-primary);
    text-decoration: underline;
    text-underline-offset: 2px;
    flex: 1 1 240px;
  }

  .period-pager-item.next {
    text-align: right;
  }

  .period-pager-item:hover {
    color: var(--color-red-dark);
  }

  /* Split PDF Verification Pane */
  .pdf-pane {
    position: sticky;
    top: 4.75rem;
    height: calc(100vh - 6.25rem);
    background-color: var(--color-surface-pure);
    border: var(--border-heavy);
    box-shadow: var(--shadow-hard-md);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .pdf-pane-header {
    background-color: var(--color-black);
    color: #FFFFFF;
    padding: 0.6rem 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .pdf-pane-title {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.05em;
  }

  .pdf-close-btn {
    background: transparent;
    border: none;
    color: #FFFFFF;
    font-size: 1rem;
    cursor: pointer;
    line-height: 1;
    padding: 0.2rem 0.5rem;
  }

  .pdf-close-btn:hover {
    color: var(--color-red-primary);
  }

  .pdf-iframe {
    width: 100%;
    height: 100%;
    border: none;
  }

  /* In-document find */
  .find-bar {
    position: fixed;
    top: 4.9rem;
    right: 1rem;
    z-index: 430;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.5rem;
    background-color: var(--color-paper-light);
    border: var(--border-medium);
    box-shadow: var(--shadow-hard-md);
    max-width: calc(100vw - 2rem);
  }

  .find-input {
    font-family: var(--font-prose);
    font-size: 0.92rem;
    padding: 0.35rem 0.5rem;
    border: 1.5px solid var(--color-black);
    background-color: #ffffff;
    min-width: 190px;
    outline: none;
  }

  .find-input:focus {
    border-color: var(--color-red-primary);
    box-shadow: 0 0 0 1px var(--color-red-primary);
  }

  .find-count {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--color-gray-dark);
    white-space: nowrap;
  }

  .find-actions {
    display: flex;
    gap: 2px;
  }

  .find-btn {
    font-size: 0.75rem;
    font-weight: 700;
    line-height: 1;
    padding: 0.35rem 0.45rem;
    border: 1.5px solid var(--color-black);
    background-color: var(--color-paper);
    cursor: pointer;
    min-width: 26px;
  }

  .find-btn:hover:not(:disabled) {
    background-color: var(--color-red-primary);
    color: #ffffff;
  }

  .find-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .find-btn.close {
    border-color: var(--color-black);
    background-color: var(--color-black);
    color: #ffffff;
  }

  /* Passage highlighting via the CSS Custom Highlight API */
  :global(::highlight(cpim-find)) {
    background-color: rgba(212, 160, 23, 0.45);
    color: inherit;
  }

  :global(::highlight(cpim-find-current)) {
    background-color: var(--color-red-primary);
    color: #ffffff;
  }

  @media (max-width: 640px) {
    .find-bar {
      top: auto;
      bottom: 4.5rem;
      right: 0.5rem;
      left: 0.5rem;
    }

    .find-input {
      min-width: 0;
      flex: 1;
    }
  }

  /* Passage selection toolbar */
  .passage-toolbar {
    position: fixed;
    z-index: 420;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 1px;
    padding: 3px;
    background-color: var(--color-black);
    border: 2px solid var(--color-black);
    box-shadow: var(--shadow-hard-md);
  }

  .passage-btn {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    padding: 0.3rem 0.55rem;
    border: none;
    background-color: var(--color-paper-light);
    color: var(--color-black);
    cursor: pointer;
    white-space: nowrap;
  }

  .passage-btn:hover {
    background-color: var(--color-gold);
  }

  .passage-btn.primary {
    background-color: var(--color-red-primary);
    color: #ffffff;
  }

  .passage-btn.primary:hover {
    background-color: var(--color-red-dark);
  }

  .passage-feedback {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    padding: 0.3rem 0.7rem;
    color: var(--color-gold);
  }

  /* Mobile section navigation */
  .mobile-toc-trigger {
    display: none;
  }

  .mobile-toc-backdrop {
    display: none;
  }

  @media (max-width: 1024px) {
    .mobile-toc-trigger {
      position: fixed;
      left: 0.75rem;
      bottom: 0.75rem;
      z-index: 400;
      display: flex;
      align-items: center;
      gap: 0.45rem;
      max-width: calc(100vw - 1.5rem);
      padding: 0.6rem 0.85rem;
      border: 2px solid var(--color-black);
      background-color: var(--color-black);
      color: #ffffff;
      font-family: var(--font-mono);
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      box-shadow: var(--shadow-hard-md);
      cursor: pointer;
    }

    .trigger-icon {
      color: var(--color-gold);
      font-size: 0.9rem;
    }

    .trigger-current {
      font-family: var(--font-prose);
      font-size: 0.78rem;
      font-weight: 400;
      font-style: italic;
      letter-spacing: 0;
      color: #d8d5cf;
      max-width: 12rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .mobile-toc-backdrop {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 398;
      background-color: rgba(18, 18, 18, 0.55);
    }

    .mobile-toc-sheet {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 399;
      max-height: 72vh;
      display: flex;
      flex-direction: column;
      background-color: var(--color-paper-light);
      border-top: 3px solid var(--color-black);
      box-shadow: 0 -4px 0 rgba(18, 18, 18, 0.25);
    }

    .sheet-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1rem;
      border-bottom: 2px solid var(--color-black);
      background-color: var(--color-paper);
    }

    .sheet-title {
      font-family: var(--font-mono);
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: var(--color-red-primary);
    }

    .sheet-close {
      border: 1.5px solid var(--color-black);
      background-color: var(--color-paper-light);
      font-weight: 700;
      padding: 0.2rem 0.55rem;
      cursor: pointer;
    }

    .sheet-list {
      overflow-y: auto;
      padding: 0.5rem 0.75rem 1.25rem;
      display: flex;
      flex-direction: column;
    }

    .sheet-item {
      font-family: var(--font-display);
      font-size: 0.9rem;
      line-height: 1.35;
      color: var(--color-black);
      padding: 0.55rem 0.5rem;
      border-bottom: 1px solid var(--color-gray-light);
    }

    .sheet-item.level-2 {
      padding-left: 1.1rem;
      font-size: 0.85rem;
    }

    .sheet-item.level-3 {
      padding-left: 1.9rem;
      font-size: 0.8rem;
      color: var(--color-gray-dark);
    }

    .sheet-item.active {
      color: var(--color-red-primary);
      font-weight: 700;
      border-left: 3px solid var(--color-red-primary);
    }
  }

  .pdf-pane-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .pdf-open-link {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: var(--color-gold);
    padding: 0.15rem 0.4rem;
    border: 1px solid #555555;
  }

  .pdf-open-link:hover {
    background-color: var(--color-gold);
    color: var(--color-black);
  }

  .pdf-pane-note {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    line-height: 1.5;
    color: var(--color-gray-dark);
    margin: 0;
    padding: 0.45rem 0.75rem;
    border-top: 1px solid var(--color-gray-light);
    background-color: var(--color-paper);
  }

  .pdf-pane-note a {
    color: var(--color-red-primary);
    text-decoration: underline;
  }

  /* Print-only provenance */
  .print-footer {
    display: none;
  }

  @media print {
    @page {
      margin: 18mm 16mm;
    }

    :global(html),
    :global(body) {
      background: #ffffff !important;
    }

    :global(.masthead),
    :global(.app-footer),
    :global(.top-accent-bar),
    :global(.reading-progress-track),
    .resume-banner,
    .reader-toolbar,
    .reading-controls,
    .toc-sidebar,
    .mobile-toc-trigger,
    .mobile-toc-backdrop,
    .mobile-toc-sheet,
    .pdf-pane,
    .doc-pager,
    .period-pager,
    .end-of-document,
    :global(.similar-box) {
      display: none !important;
    }

    .reader-container {
      background: #ffffff !important;
    }

    .doc-header {
      background: #ffffff !important;
      border-bottom: 1px solid #000000;
      padding: 0 0 1rem;
    }

    .nav-breadcrumbs {
      display: none;
    }

    .reader-workspace {
      display: block;
      max-width: none;
      padding: 0;
      gap: 0;
    }

    .reading-canvas {
      max-width: none !important;
      padding: 0 !important;
      border: none !important;
      background: #ffffff !important;
    }

    :global(.markdown-prose),
    :global(.markdown-prose *) {
      color: #000000 !important;
      background-color: transparent !important;
    }

    :global(.markdown-prose) {
      font-size: 10.5pt;
      line-height: 1.55;
    }

    :global(.markdown-prose p) {
      text-align: left;
      hyphens: none;
      orphans: 3;
      widows: 3;
    }

    :global(.markdown-prose h1),
    :global(.markdown-prose h2),
    :global(.markdown-prose h3) {
      break-after: avoid;
      break-inside: avoid;
    }

    :global(.markdown-prose table),
    :global(.markdown-prose blockquote),
    :global(.markdown-prose pre) {
      break-inside: avoid;
    }

    :global(.markdown-prose thead th) {
      background-color: #ececec !important;
      color: #000000 !important;
      border-bottom: 1px solid #000000;
    }

    :global(.markdown-prose .table-scroll) {
      overflow: visible !important;
      border: 1px solid #000000;
    }

    .print-footer {
      display: block;
      margin-top: 2rem;
      padding-top: 0.75rem;
      border-top: 1px solid #000000;
      font-family: var(--font-mono);
      font-size: 7.5pt;
      line-height: 1.5;
      color: #333333;
    }

    .print-footer p {
      margin: 0 0 0.15rem;
      word-break: break-all;
    }

    .print-footer .print-title {
      font-weight: 700;
      color: #000000;
      margin-bottom: 0.35rem;
    }
  }

  /* Responsive Adjustments */
  @media (max-width: 1024px) {
    .reader-workspace {
      grid-template-columns: 1fr;
      gap: 2rem;
    }

    .bilingual-workspace {
      grid-template-columns: 1fr;
    }

    .toc-sidebar {
      display: none;
    }

    .reader-workspace.split-active {
      grid-template-columns: 1fr;
    }

    .pdf-pane {
      height: 600px;
      position: static;
      margin-top: 2rem;
    }

    .doc-pager {
      grid-template-columns: 1fr;
    }

    .pager-item.newer,
    .period-pager-item.next {
      text-align: left;
      align-items: flex-start;
    }
  }

  /* Narrow screens: a justified column of ~40 characters produces river gaps.
     Switch to ragged-right and give the prose a touch more breathing room. */
  @media (max-width: 640px) {
    :global(.markdown-prose p) {
      text-align: left;
      hyphens: none;
      -webkit-hyphens: none;
    }

    .reading-canvas[data-reader-theme='white'],
    .reading-canvas[data-reader-theme='dim'],
    .bilingual-pane[data-reader-theme='white'],
    .bilingual-pane[data-reader-theme='dim'] {
      padding: 1.15rem;
    }

    :global(.markdown-prose h1) {
      font-size: 1.6rem;
    }

    :global(.markdown-prose h2) {
      font-size: 1.4rem;
    }

    :global(.markdown-prose h3) {
      font-size: 1.2rem;
    }

    :global(.markdown-prose table) {
      font-size: 0.9rem;
    }
  }
</style>