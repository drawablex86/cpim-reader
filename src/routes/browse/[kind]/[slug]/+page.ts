import { error } from '@sveltejs/kit';
import {
  FACET_KINDS,
  FACET_META,
  documentsForFacet,
  facetEntries,
  findFacetItem,
  isFacetKind,
  siblingFacets
} from '$lib/taxonomy-index';
import type { PageLoad } from './$types';

export const prerender = true;

export const entries = () =>
  FACET_KINDS.flatMap((kind) =>
    facetEntries(kind).map((entry) => ({ kind, slug: entry.slug }))
  );

export const load: PageLoad = ({ params }) => {
  if (!isFacetKind(params.kind)) {
    throw error(404, `Unknown index '${params.kind}'.`);
  }

  const item = findFacetItem(params.kind, params.slug);
  if (!item) {
    throw error(404, `No ${params.kind} entry named '${params.slug}'.`);
  }

  return {
    kind: params.kind,
    meta: FACET_META[params.kind],
    item,
    documents: documentsForFacet(params.kind, params.slug),
    siblings: siblingFacets(params.kind, params.slug)
  };
};
