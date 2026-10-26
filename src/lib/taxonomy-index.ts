import { loadAllDocuments, type DocumentMeta } from '$lib/documents';
import { DOC_TYPES, TOPICS, PERIODS, GEOGRAPHY, type TaxonomyItem } from '$lib/taxonomy';

/**
 * Facet landing pages.
 *
 * Every document carries a format, a Congress/election cycle and one or more
 * regions plus topics. The catalog can filter by all of these, but the archive
 * had no page per facet — so a topic like "agrarian-relations" had no address of
 * its own to link, cite or browse from.
 */

export type FacetKind = 'topics' | 'periods' | 'formats' | 'regions';

export const FACET_KINDS: FacetKind[] = ['topics', 'periods', 'formats', 'regions'];

export interface FacetMeta {
  singular: string;
  title: string;
  blurb: string;
  /** Catalog query parameter used by the "filter in catalog" link */
  queryParam: string;
}

export const FACET_META: Record<FacetKind, FacetMeta> = {
  topics: {
    singular: 'TOPIC',
    title: 'Browse by Topic',
    blurb:
      'Themes that recur across Congresses, decades and states — from agrarian relations to communalism and the women’s movement.',
    queryParam: 'topic'
  },
  periods: {
    singular: 'PERIOD',
    title: 'Browse by Congress & Election Cycle',
    blurb:
      'Documents grouped by the Party Congress or general-election cycle they belong to, from the 14th Congress in 1992 to the 24th in 2025.',
    queryParam: 'period'
  },
  formats: {
    singular: 'FORMAT',
    title: 'Browse by Document Format',
    blurb:
      'Resolutions, committee reports, tactical reviews, manifestos and other categories of official publication.',
    queryParam: 'type'
  },
  regions: {
    singular: 'REGION',
    title: 'Browse by Region',
    blurb:
      'State and national-level documents, including state committee reports, election reviews and region-specific resolutions.',
    queryParam: 'geo'
  }
};

export function isFacetKind(value: string): value is FacetKind {
  return (FACET_KINDS as string[]).includes(value);
}

function facetTable(kind: FacetKind): Record<string, TaxonomyItem> {
  switch (kind) {
    case 'topics':
      return TOPICS;
    case 'periods':
      return PERIODS;
    case 'formats':
      return DOC_TYPES;
    case 'regions':
      return GEOGRAPHY;
  }
}

export function documentHasFacet(kind: FacetKind, doc: DocumentMeta, slug: string): boolean {
  switch (kind) {
    case 'topics':
      return !!doc.topics?.includes(slug);
    case 'periods':
      return doc.period === slug;
    case 'formats':
      return doc.doc_type === slug;
    case 'regions':
      return !!doc.geo?.includes(slug);
  }
}

export function documentsForFacet(kind: FacetKind, slug: string): DocumentMeta[] {
  return loadAllDocuments()
    .filter((doc) => documentHasFacet(kind, doc, slug))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export interface FacetItem extends TaxonomyItem {
  count: number;
}

export function findFacetItem(kind: FacetKind, slug: string): FacetItem | null {
  const item = facetTable(kind)[slug];
  if (!item) return null;
  return { ...item, count: documentsForFacet(kind, slug).length };
}

/**
 * All facets of one kind, with document counts.
 *
 * Topics and regions are ordered by how much material they hold; periods and
 * formats keep their curated taxonomy order (chronology and editorial
 * hierarchy respectively) so the index reads sensibly.
 */
export function listFacets(kind: FacetKind, options: { withDocumentsOnly?: boolean } = {}): FacetItem[] {
  const documents = loadAllDocuments();
  const entries = Object.entries(facetTable(kind)).map(([slug, item]) => ({
    ...item,
    count: documents.filter((doc) => documentHasFacet(kind, doc, slug)).length
  }));

  const ranked =
    kind === 'topics' || kind === 'regions'
      ? [...entries].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      : entries;

  return options.withDocumentsOnly ? ranked.filter((item) => item.count > 0) : ranked;
}

/** Static prerender entries for a facet detail route. */
export function facetEntries(kind: FacetKind): Array<{ slug: string }> {
  return listFacets(kind, { withDocumentsOnly: true }).map((item) => ({ slug: item.slug }));
}

/** Other facets of the same kind, for cross-linking at the foot of a page. */
export function siblingFacets(kind: FacetKind, slug: string, limit = 10): FacetItem[] {
  return listFacets(kind, { withDocumentsOnly: true })
    .filter((item) => item.slug !== slug)
    .slice(0, limit);
}
