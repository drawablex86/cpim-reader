import { error } from '@sveltejs/kit';
import { FACET_KINDS, FACET_META, isFacetKind, listFacets } from '$lib/taxonomy-index';
import type { PageLoad } from './$types';

export const prerender = true;

export const entries = () => FACET_KINDS.map((kind) => ({ kind }));

export const load: PageLoad = ({ params }) => {
  if (!isFacetKind(params.kind)) {
    throw error(404, `Unknown index '${params.kind}'.`);
  }

  return {
    kind: params.kind,
    meta: FACET_META[params.kind],
    items: listFacets(params.kind, { withDocumentsOnly: true })
  };
};
