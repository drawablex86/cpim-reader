import { a5 as head, a9 as attr_style, e as escape_html, a7 as attr, a8 as attr_class, a6 as ensure_array_like } from "../../../../chunks/index.js";
/* empty css                                                             */
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    let showPdfSplit = false;
    let showCiteDrawer = false;
    let readProgress = 0;
    let activeHeadingId = "";
    let headings = [];
    head("11o795e", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>${escape_html(data.meta.title)} — CPI(M) Official Archive</title>`);
      });
    });
    $$renderer2.push(`<div class="reading-progress-track svelte-11o795e" aria-hidden="true"><div class="reading-progress-fill svelte-11o795e"${attr_style(`width: ${readProgress}%`)}></div></div> <article class="reader-container svelte-11o795e" data-pagefind-body=""><header class="doc-header svelte-11o795e"><div class="header-inner svelte-11o795e"><div class="nav-breadcrumbs svelte-11o795e"><a href="/" class="back-link svelte-11o795e">← RETURN TO CATALOG</a></div> <div class="meta-strip svelte-11o795e"><span class="badge category svelte-11o795e" data-pagefind-filter="category">${escape_html(data.meta.category)}</span> <time class="meta-item date svelte-11o795e"${attr("datetime", data.meta.date)}>${escape_html(data.meta.date)}</time> `);
    if (data.meta.page_count) {
      $$renderer2.push(`<!--[0--><span class="meta-item pages svelte-11o795e">${escape_html(data.meta.page_count)} PAGES</span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (data.meta.extraction_method) {
      $$renderer2.push(`<!--[0--><span class="badge method svelte-11o795e">${escape_html(data.meta.extraction_method.toUpperCase())}</span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <h1 class="document-headline svelte-11o795e">${escape_html(data.meta.title)}</h1> <div class="author-byline svelte-11o795e"><span class="byline-label svelte-11o795e">OFFICIAL ISSUANCE:</span> <span class="byline-text">${escape_html(data.meta.author || "Central Committee, Communist Party of India (Marxist)")}</span></div> <div class="reader-toolbar svelte-11o795e">`);
    if (data.meta.source_pdf_url) {
      $$renderer2.push(`<!--[0--><button type="button"${attr_class("tool-btn split-toggle svelte-11o795e", void 0, { "active": showPdfSplit })}>${escape_html("◫ VERIFY WITH ORIGINAL PDF (SPLIT VIEW)")}</button>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <button type="button"${attr_class("tool-btn cite-toggle svelte-11o795e", void 0, { "active": showCiteDrawer })}>${escape_html("❝ CITE THIS DOCUMENT")}</button> `);
    if (data.meta.source_pdf_url) {
      $$renderer2.push(`<!--[0--><a${attr("href", data.meta.source_pdf_url)} target="_blank" rel="noopener noreferrer" class="tool-btn download-pdf svelte-11o795e">DOWNLOAD SOURCE PDF ↗</a>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (data.meta.source_post_url) {
      $$renderer2.push(`<!--[0--><a${attr("href", data.meta.source_post_url)} target="_blank" rel="noopener noreferrer" class="tool-btn view-source svelte-11o795e">CPIM.ORG WEB SOURCE ↗</a>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div></header> <div${attr_class("reader-workspace svelte-11o795e", void 0, { "split-active": showPdfSplit })}>`);
    if (headings.length > 0) {
      $$renderer2.push(`<!--[0--><aside class="toc-sidebar svelte-11o795e" aria-label="Table of Contents"><div class="toc-sticky-box svelte-11o795e"><div class="toc-title-stamp svelte-11o795e">DOCUMENT SECTIONS</div> <nav class="toc-list svelte-11o795e"><!--[-->`);
      const each_array = ensure_array_like(headings);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let h = each_array[$$index];
        $$renderer2.push(`<a${attr("href", `#${h.id}`)}${attr_class("toc-item svelte-11o795e", void 0, {
          "h3-indent": h.level === 3,
          "active": activeHeadingId === h.id
        })}>${escape_html(h.text)}</a>`);
      }
      $$renderer2.push(`<!--]--></nav></div></aside>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <main class="reading-canvas svelte-11o795e"><div class="markdown-prose">`);
    if (data.content) {
      $$renderer2.push("<!--[-->");
      data.content($$renderer2, {});
      $$renderer2.push("<!--]-->");
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push("<!--]-->");
    }
    $$renderer2.push(`</div> <div class="end-of-document svelte-11o795e"><div class="end-stamp svelte-11o795e">∎ END OF OFFICIAL ARCHIVAL RESOLUTION ∎</div> <p class="end-meta svelte-11o795e">Preserved in the CPI(M) Research Repository under SHA256 integrity hash: <code class="svelte-11o795e">${escape_html(data.meta.sha256 || "verified-record")}</code></p></div></main> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></article> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
export {
  _page as default
};
