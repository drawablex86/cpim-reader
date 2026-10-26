/**
 * Shared search plumbing for the ⌘K palette.
 *
 * Two layers are combined:
 *  1. A prerendered metadata index (`/documents.json`) for instant title,
 *     topic and Congress matching — available even before Pagefind loads.
 *  2. The Pagefind WASM index for full-text hits inside the resolutions.
 */

export interface SearchableDoc {
  slug: string;
  title: string;
  date: string;
  category: string;
  doc_type?: string;
  period?: string;
  geo?: string[];
  topics?: string[];
  author?: string;
  page_count?: number;
  has_translations?: boolean;
}

export interface FullTextHit {
  slug: string;
  excerpt: string;
  score: number;
}

let metadataPromise: Promise<SearchableDoc[]> | null = null;
let pagefindPromise: Promise<any> | null = null;

export function loadMetadataIndex(): Promise<SearchableDoc[]> {
  if (typeof window === 'undefined') return Promise.resolve([]);

  if (!metadataPromise) {
    metadataPromise = fetch('/documents.json')
      .then((res) => (res.ok ? res.json() : []))
      .catch(() => []) as Promise<SearchableDoc[]>;
  }

  return metadataPromise;
}

/**
 * Pagefind is generated after `vite build`; in a fresh dev checkout it may be
 * missing. Callers should treat a rejection as "full text unavailable".
 */
export function loadPagefind(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (pagefindPromise) return pagefindPromise;

  const importPagefind = new Function('path', 'return import(path)');

  const attempt: Promise<any> = importPagefind('/pagefind/pagefind.js')
    .then(async (pf: any) => {
      await pf.init();
      return pf;
    })
    .catch((error: unknown) => {
      pagefindPromise = null; // allow a later retry (e.g. after a build)
      throw error;
    });

  pagefindPromise = attempt;
  return attempt;
}

export async function searchFullText(query: string, limit = 12): Promise<FullTextHit[]> {
  const pf = await loadPagefind();
  const response = await pf.search(query);
  if (!response?.results?.length) return [];

  const hits: FullTextHit[] = [];
  for (const result of response.results.slice(0, limit)) {
    const data = await result.data();
    const match = String(data.url).match(/docs\/([^/?#]+?)(?:\.html)?(?:[?#]|$)/);
    if (!match) continue;
    hits.push({
      slug: match[1].replace(/\.html$/, ''),
      excerpt: data.excerpt || '',
      score: result.score
    });
  }
  return hits;
}

function normalise(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Ranks metadata matches: title prefix > title substring > author/category.
 * Deliberately simple and synchronous so results appear on every keystroke.
 */
export function matchMetadata(
  documents: SearchableDoc[],
  query: string,
  topicLabels: Record<string, string>,
  limit = 8
): SearchableDoc[] {
  const needle = normalise(query.trim());
  if (!needle) return [];

  const terms = needle.split(/\s+/).filter(Boolean);

  const scored = documents.map((doc) => {
    const title = normalise(doc.title);
    const haystack = normalise(
      [
        doc.title,
        doc.author || '',
        doc.category,
        doc.date,
        (doc.topics || []).map((t) => topicLabels[t] || t).join(' ')
      ].join(' ')
    );

    let score = 0;
    if (title.startsWith(needle)) score += 100;
    if (title.includes(needle)) score += 50;
    if (terms.every((term) => title.includes(term))) score += 30;
    if (haystack.includes(needle)) score += 10;
    if (terms.every((term) => haystack.includes(term))) score += 8;

    return { doc, score };
  });

  return scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.doc.date.localeCompare(a.doc.date))
    .slice(0, limit)
    .map((entry) => entry.doc);
}
