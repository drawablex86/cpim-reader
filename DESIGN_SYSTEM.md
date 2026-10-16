# Design System: Soviet Constructivist & Modern Editorial (`DESIGN_SYSTEM.md`)

This design system establishes the visual tokens and component patterns for the **CPI(M) Document Reading & Research Archive**. It deliberately couples an exterior **Soviet Constructivist aesthetic** (sharp geometric structure, heavy borders, revolutionary red accents, manifesto badges, industrial density) with an **elegant modern editorial reading area** (high-legibility scholarly serif typography, comfortable line measure, sticky Table of Contents, and split-screen original PDF verification).

---

## 1. Design Philosophy: The Dual Aesthetic

| Domain | Aesthetic Influence | Key Principles | Primary Audience Feeling |
| :--- | :--- | :--- | :--- |
| **Shell & Explorer** (`Navigation`, `Hero`, `Filters`, `Catalog`, `Metadata`, `Citation Drawer`) | **Soviet Constructivism** (El Lissitzky, Rodchenko, Varvara Stepanova, Bauhaus Vkhutemas) | Angular 90° geometry, stark contrast, heavy black structural rules, revolutionary crimson accents, newsprint background, utilitarian stamped badges, hard drop-shadows. | Architectural, authoritative, historical, disciplined. |
| **Reading Canvas** (`Document Body`, `Headings`, `Blockquotes`, `Footnotes`, `Tables`) | **Modern Academic / Scholarly Editorial** (*The Atlantic*, *Aeon*, *Verso Books*) | Distraction-free serif prose, optical sizing, relaxed line-height (1.75), calibrated 68ch measure, subtle section dividers, sticky navigable TOC. | Immersive, fatigue-free, scholarly, rigorous. |

---

## 2. Color Palette & Semantic Tokens

All colors are exposed as CSS Custom Properties in `:root`:

```css
:root {
  /* ==========================================================================
     CONSTRUCTIVIST SHELL TOKENS
     ========================================================================== */
  /* Reds & Accents */
  --color-red-primary: #C41E3A;      /* Cadmium / Revolutionary Crimson */
  --color-red-dark: #9A1428;         /* Deep Garnet / Press ink red */
  --color-red-light: #F8D7DA;        /* Light Red Wash for highlights */
  --color-gold: #D4A017;             /* Industrial Ochre / Constructivist Brass */
  --color-gold-muted: #E6C665;       /* Warm yellow highlight */

  /* Inks & Neutrals */
  --color-black: #121212;            /* Deep Soviet Carbon / Printer's Ink */
  --color-charcoal: #232323;         /* Industrial Dark Slate */
  --color-gray-dark: #3F3F3F;        /* Secondary Borders & Rules */
  --color-gray-medium: #767676;      /* Metadata Muted Text */
  --color-gray-light: #D9D5CC;       /* Subtle Grid Lines & Table Rules */

  /* Surfaces & Paper Backgrounds */
  --color-paper: #F4F1EA;            /* Weathered Newsprint / Archival Paper */
  --color-paper-light: #FAF8F5;      /* Clean Reading Parchment */
  --color-paper-dark: #E6E1D5;       /* Card Background / Inset Wells */
  --color-surface-pure: #FFFFFF;     /* Pure Crisp White (for Modals & Badges) */

  /* Structural Borders */
  --border-heavy: 3px solid var(--color-black);
  --border-medium: 2px solid var(--color-black);
  --border-fine: 1px solid var(--color-gray-dark);
  --border-accent: 3px solid var(--color-red-primary);

  /* Hard Brutalist Shadows (Zero Blur) */
  --shadow-hard-sm: 2px 2px 0px var(--color-black);
  --shadow-hard-md: 4px 4px 0px var(--color-black);
  --shadow-hard-lg: 6px 6px 0px var(--color-black);
  --shadow-hard-red: 4px 4px 0px var(--color-red-primary);

  /* ==========================================================================
     EDITORIAL READING AREA TOKENS
     ========================================================================== */
  --reader-bg: var(--color-paper-light);
  --reader-ink: #1F2022;             /* High-legibility deep neutral */
  --reader-ink-secondary: #525357;   /* Author bylines & captions */
  --reader-link: var(--color-red-primary);
  --reader-link-hover: var(--color-red-dark);
  --reader-selection: rgba(196, 30, 58, 0.15);
  --reader-measure: 68ch;            /* Optimal measure: 65-72 characters */
  --reader-line-height: 1.78;
}
```

---

## 3. Typography Hierarchy

### 3.1 Font Families
1. **Constructivist Display Font**: `'Space Grotesk'`, `'Oswald'`, sans-serif
   - Used for: Masthead branding, document titles in listing, category stamps, industrial buttons, section indicators.
   - Character: High x-height, condensed or geometric letterforms, prominent caps tracking.
2. **Academic Prose Serif Font**: `'Newsreader'`, `'Source Serif 4'`, `'Georgia'`, serif
   - Used for: Document reading prose, chapter subheadings, quotes, citations.
   - Character: Open counters, natural italics, classical editorial cadence.
3. **Archival Monospace Font**: `'JetBrains Mono'`, `'Courier New'`, monospace
   - Used for: Dates, document codes, SHA-256 hashes, citation formats, Table of Contents numbering.

### 3.2 Typography Scale

```css
/* Display & Constructivist Headers */
--font-display-2xl: 700 2.5rem/1.1 'Space Grotesk', sans-serif;
--font-display-xl:  700 2.0rem/1.15 'Space Grotesk', sans-serif;
--font-display-lg:  700 1.5rem/1.2 'Space Grotesk', sans-serif;
--font-display-md:  600 1.15rem/1.25 'Space Grotesk', sans-serif;
--font-display-sm:  600 0.95rem/1.3 'Space Grotesk', sans-serif;

/* Editorial Prose Hierarchy */
--font-prose-title: 700 2.25rem/1.25 'Newsreader', serif;
--font-prose-h2:    700 1.65rem/1.35 'Newsreader', serif;
--font-prose-h3:    600 1.35rem/1.4 'Newsreader', serif;
--font-prose-body:  400 1.125rem/1.78 'Newsreader', serif;
--font-prose-lead:  400 1.25rem/1.75 'Newsreader', serif;
--font-prose-quote: italic 400 1.15rem/1.65 'Newsreader', serif;

/* Monospace & Metadata */
--font-mono-sm:     500 0.85rem/1.4 'JetBrains Mono', monospace;
--font-mono-xs:     500 0.75rem/1.35 'JetBrains Mono', monospace;
```

---

## 4. Constructivist Geometric Motifs & Layout Rules

1. **Strict 90-Degree Angles**:
   - `border-radius: 0px !important;` across all buttons, cards, dialogs, badges, inputs, and dropdowns. No bubbly modern radii.
2. **Asymmetrical Grid Composition**:
   - Split sections, diagonal corner accents, and bold red header banners anchor the eye.
3. **Industrial Divider Bands**:
   - Thick black horizontal rules (`border-top: 3px solid var(--color-black)`) combined with red ribbon accents.
4. **Manifesto Badges**:
   - Square-bracketed stamp codes: `[RESOL_CC_2026]`, `[DOC // 0233]`.
   - Inverted fill state on hover (black background with crisp white or gold text).
5. **Tactile Button Depress Effect**:
   - On `:hover`: Shadow shifts (`transform: translate(-1px, -1px); box-shadow: var(--shadow-hard-md);`).
   - On `:active`: Button presses into the canvas (`transform: translate(2px, 2px); box-shadow: none;`).

---

## 5. Component Specifications

### 5.1 Masthead & Header (`+layout.svelte`)
- **Top Revolutionary Banner**: Crimson horizontal band (`#C41E3A`, height `6px`) spanning the entire viewport width.
- **Header Shell**: 
  - Off-white paper background (`#F4F1EA`) framed by a bottom 3px solid black border.
  - Left branding: Red square hammer & sickle emblem, bold all-caps title `CPI(M) DOCUMENT ARCHIVE`, subtitle `CENTRAL COMMITTEE & PARTY CONGRESS REPOSITORY`.
  - Right utilities: Live catalog count badge (`273 DOCUMENTS`), quick search keyboard shortcut hint (`Cmd + K` or `/`).

### 5.2 Archive Explorer & Filter Bar (`+page.svelte`)
- **Category Filter Pills**:
  - Industrial block tabs (`ALL`, `CC DOCUMENTS`, `PARTY CONGRESS`, `ISSUES`, `LEFT VIEW`).
  - Active tab: Pure black background, white text, 3px solid black border.
  - Inactive tab: Off-white background, black text, 2px solid black border; on hover fills with `--color-red-primary`.
- **Search & Sort Bar**:
  - Angular search field with hard drop-shadow.
  - Instant client-side filter by title, date, category, and author.
- **Card & Table View Switcher**:
  - **Constructivist Card View**: Stamped archive cards with bold dates, category tags, author byline, quick "Read" button, and quick "Cite" trigger.
  - **Industrial Data Table View**: Dense archival ledger with columns for `DATE`, `CATEGORY`, `OFFICIAL TITLE`, `FORMAT (PDF/WEB)`, `ACTIONS`.

### 5.3 Scholarly Reading Canvas (`docs/[slug]/+page.svelte`)
- **Header Section**:
  - Eyebrow badge with category stamp and publication date.
  - Editorial title in `Newsreader` font.
  - Action toolbar: `[DOWNLOAD ORIGINAL PDF]`, `[VERIFY WITH PDF (SPLIT VIEW)]`, `[CITE THIS DOCUMENT]`.
- **Reading Measure**:
  - Centered text column capped at `max-width: 68ch`.
  - Subtle drop-cap on opening paragraph.
  - Clean `h2` and `h3` headings with left margin anchor symbols (`#`) that reveal on hover for direct permalinking.
- **Sticky Table of Contents Sidebar**:
  - Sticks to the viewport (`position: sticky; top: 2rem;`).
  - Tracks reading position using `IntersectionObserver`, highlighting the active section with a crimson left border indicator.

### 5.4 Split-Screen PDF Verification Pane
- Integrated right-hand pane toggleable via the toolbar button.
- Responsive layout: expands from single column reader to 50/50 split workspace on desktop screens (`min-width: 1024px`).
- Embedded PDF iframe loaded directly from `source_pdf_url` (or local `.cache/pdfs/` when offline).
- Synchronized reading affordances allowing researchers to verify text against the official scanned letterhead.

### 5.5 Citation Modal & Drawer (`CitationModal.svelte`)
- Brutalist modal dialog with 3px solid black border and hard drop-shadow (`6px 6px 0px #121212`).
- Crimson header band with document title and close button `[X]`.
- Tabs for academic formats: **APA (7th)**, **MLA (9th)**, **Chicago (17th)**, and **BibTeX**.
- One-click copy with instant tactile visual feedback ("COPIED TO CLIPBOARD!").
- Dedicated "Export .bib File" button for direct Zotero / Mendeley / LaTeX integration.

---

## 6. Responsive Breakpoints

| Breakpoint | Width | Behavior |
| :--- | :--- | :--- |
| `sm` | `< 640px` | Single column, stacked filter buttons, sticky bottom navigation drawer for Table of Contents, full-screen PDF view toggle. |
| `md` | `640px – 1023px` | Two-column card grid, inline filter bar, collapsible TOC drawer. |
| `lg` | `1024px – 1439px` | Sticky sidebar TOC + central 68ch reading canvas, side-by-side split PDF workspace on demand. |
| `xl` | `≥ 1440px` | Full multi-column research workstation: left navigation & metadata, central reading prose, right-side persistent split PDF verification window. |
