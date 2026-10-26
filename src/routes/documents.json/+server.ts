import { json } from '@sveltejs/kit';
import { loadAllDocuments } from '$lib/documents';
import type { RequestHandler } from './$types';

export const prerender = true;

/**
 * Lightweight metadata index for the ⌘K palette.
 *
 * `loadAllDocuments()` uses an eager `import.meta.glob`, so importing it into a
 * client component would pull every markdown file into the browser bundle.
 * Prerendering the bare metadata to a static JSON file keeps the payload to a
 * few dozen kB and lets the palette match titles even when the Pagefind index
 * has not been built yet.
 */
export const GET: RequestHandler = () => {
  const documents = loadAllDocuments().map((doc) => ({
    slug: doc.slug,
    title: doc.title,
    date: doc.date,
    category: doc.category,
    doc_type: doc.doc_type,
    period: doc.period,
    geo: doc.geo,
    topics: doc.topics,
    author: doc.author,
    page_count: doc.page_count,
    has_translations: Object.keys(doc.translations || {}).length > 0
  }));

  return json(documents, {
    headers: {
      'cache-control': 'public, max-age=3600'
    }
  });
};
