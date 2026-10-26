/**
 * Canonical addressing for the archive itself.
 *
 * Note: this is *not* the upstream cpim.org origin. Document slugs are generated
 * by the extraction pipeline and do not exist on cpim.org, so citations must
 * point at the archive's own route (`/docs/<slug>`).
 *
 * Set `PUBLIC_SITE_URL` (e.g. `https://archive.example.org`) at build time to get
 * deployment-independent canonical URLs in citations and metadata. Without it we
 * fall back to the current browser origin, which is correct for any host.
 */
const CONFIGURED_ORIGIN = (import.meta.env.PUBLIC_SITE_URL as string | undefined)?.trim();

export const configuredSiteOrigin: string | null = CONFIGURED_ORIGIN
  ? CONFIGURED_ORIGIN.replace(/\/+$/, '')
  : null;

export function siteOrigin(): string {
  if (configuredSiteOrigin) return configuredSiteOrigin;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'https://cpim-documents-archive.local';
}

export function documentUrl(slug: string, hash?: string): string {
  return `${siteOrigin()}/docs/${slug}${hash ? `#${hash}` : ''}`;
}

/** URL of the authoritative upstream publication, when known. */
export function sourceUrl(doc: { source_post_url?: string }): string | null {
  return doc.source_post_url || null;
}
