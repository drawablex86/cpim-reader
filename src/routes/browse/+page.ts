import { FACET_KINDS, FACET_META, listFacets } from '$lib/taxonomy-index';
import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = () => {
  const sections = FACET_KINDS.map((kind) => {
    const items = listFacets(kind, { withDocumentsOnly: true });
    return {
      kind,
      meta: FACET_META[kind],
      totalFacets: items.length,
      totalDocuments: items.reduce((sum, item) => sum + item.count, 0),
      top: items.slice(0, 5).map((item) => ({
        slug: item.slug,
        label: item.label,
        count: item.count
      }))
    };
  });

  return { sections };
};
