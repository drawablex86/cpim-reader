import { a5 as head, e as escape_html, a6 as ensure_array_like, a7 as attr, a8 as attr_class, a4 as derived } from "../../chunks/index.js";
/* empty css                                                       */
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    let selectedCategory = "All";
    let searchQuery = "";
    let viewMode = "cards";
    const categories = [
      "All",
      "CC Documents",
      "Party Congress",
      "Issues",
      "Left View"
    ];
    const filteredDocs = derived(() => data.documents.filter((doc) => {
      const matchesCategory = selectedCategory === "All";
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || doc.title.toLowerCase().includes(q) || doc.author && doc.author.toLowerCase().includes(q) || doc.date.includes(q);
      return matchesCategory && matchesSearch;
    }));
    head("1uha8ag", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>CPI(M) Documents Archive // Research Catalog</title>`);
      });
    });
    $$renderer2.push(`<div class="archive-explorer svelte-1uha8ag"><section class="hero-banner svelte-1uha8ag"><div class="hero-inner"><div class="hero-stamp svelte-1uha8ag">OFFICIAL PARTY RESOLUTIONS • 2008 – 2026</div> <h1 class="hero-title svelte-1uha8ag">CPI(M) DOCUMENT ARCHIVE</h1> <p class="hero-deck svelte-1uha8ag">A static, searchable research repository containing verbatim Central Committee resolutions,
        Party Congress declarations, and monographs published by the Communist Party of India (Marxist).</p> <div class="hero-stats-strip svelte-1uha8ag"><div class="stat-pill svelte-1uha8ag"><span class="stat-num svelte-1uha8ag">${escape_html(data.documents.length)}</span> <span class="stat-txt svelte-1uha8ag">VERIFIED ARCHIVES LOADED</span></div> <div class="stat-pill svelte-1uha8ag"><span class="stat-num svelte-1uha8ag">273+</span> <span class="stat-txt svelte-1uha8ag">CATALOGED ON LIVE SITE</span></div> <div class="stat-pill accent svelte-1uha8ag"><span class="stat-num svelte-1uha8ag">WASM</span> <span class="stat-txt svelte-1uha8ag">OFFLINE FULL-TEXT SEARCH</span></div></div></div></section> <section class="controls-toolbar svelte-1uha8ag"><div class="toolbar-inner svelte-1uha8ag"><div class="category-tabs svelte-1uha8ag" role="tablist" aria-label="Document Category Filter"><!--[-->`);
    const each_array = ensure_array_like(categories);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let cat = each_array[$$index];
      $$renderer2.push(`<button type="button" role="tab"${attr("aria-selected", selectedCategory === cat)}${attr_class("cat-tab svelte-1uha8ag", void 0, { "active": selectedCategory === cat })}>${escape_html(cat.toUpperCase())}</button>`);
    }
    $$renderer2.push(`<!--]--></div> <div class="search-and-views svelte-1uha8ag"><div class="search-box svelte-1uha8ag"><span class="search-icon svelte-1uha8ag" aria-hidden="true">⌕</span> <input type="search"${attr("value", searchQuery)} placeholder="Search documents by title, author, date..." class="search-input svelte-1uha8ag" aria-label="Search documents"/> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="view-toggles svelte-1uha8ag" role="group" aria-label="Catalog Layout View"><button type="button"${attr_class("view-btn svelte-1uha8ag", void 0, { "active": viewMode === "cards" })} title="Card Grid View">CARDS</button> <button type="button"${attr_class("view-btn svelte-1uha8ag", void 0, { "active": viewMode === "table" })} title="Archival Ledger Table View">TABLE</button></div></div></div></section> <div class="results-meta-bar svelte-1uha8ag"><div class="results-inner svelte-1uha8ag"><span class="results-count">SHOWING <strong>${escape_html(filteredDocs().length)}</strong> OF <strong>${escape_html(data.documents.length)}</strong> DOCUMENTS</span> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div> <div class="catalog-viewport">`);
    if (filteredDocs().length === 0) {
      $$renderer2.push(`<!--[0--><div class="empty-state svelte-1uha8ag"><div class="empty-box svelte-1uha8ag"><h3 class="svelte-1uha8ag">NO DOCUMENTS FOUND</h3> <p>No resolutions match category <strong>${escape_html(selectedCategory)}</strong> and query "<em>${escape_html(searchQuery)}</em>".</p> <button type="button" class="btn-reset svelte-1uha8ag">SHOW ALL DOCUMENTS</button></div></div>`);
    } else {
      $$renderer2.push(`<!--[1--><div class="card-grid svelte-1uha8ag"><!--[-->`);
      const each_array_1 = ensure_array_like(filteredDocs());
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        let doc = each_array_1[$$index_1];
        $$renderer2.push(`<article class="doc-card svelte-1uha8ag"><div class="card-top-rule svelte-1uha8ag"></div> <div class="card-header svelte-1uha8ag"><span class="card-category svelte-1uha8ag">${escape_html(doc.category)}</span> <time class="card-date svelte-1uha8ag"${attr("datetime", doc.date)}>${escape_html(doc.date)}</time></div> <h2 class="card-title svelte-1uha8ag"><a${attr("href", `/docs/${doc.slug}`)} class="svelte-1uha8ag">${escape_html(doc.title)}</a></h2> `);
        if (doc.author) {
          $$renderer2.push(`<!--[0--><div class="card-author svelte-1uha8ag"><span class="author-label svelte-1uha8ag">AUTHOR:</span> ${escape_html(doc.author)}</div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> <div class="card-footer svelte-1uha8ag"><div class="card-badges svelte-1uha8ag">`);
        if (doc.page_count) {
          $$renderer2.push(`<!--[0--><span class="badge-tag svelte-1uha8ag">${escape_html(doc.page_count)} PP</span>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> <span class="badge-tag uppercase svelte-1uha8ag">${escape_html(doc.extraction_method || "OFFICIAL")}</span></div> <div class="card-actions svelte-1uha8ag"><button type="button" class="action-btn cite-btn svelte-1uha8ag"${attr("aria-label", `Cite ${doc.title}`)}>CITE</button> <a${attr("href", `/docs/${doc.slug}`)} class="action-btn read-btn svelte-1uha8ag">READ ➔</a></div></div></article>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
export {
  _page as default
};
