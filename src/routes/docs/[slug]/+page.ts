import { error } from '@sveltejs/kit';
import { loadAllDocuments } from '$lib/documents';
import type { EntryGenerator, PageLoad } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () => {
  const docs = loadAllDocuments();
  return docs.map((doc) => ({ slug: doc.slug }));
};

export const load: PageLoad = async ({ params }) => {
  try {
    const post = await import(`../../../content/documents/${params.slug}.md`);
    return {
      meta: post.metadata,
      content: post.default
    };
  } catch (e) {
    throw error(404, `Document '${params.slug}' not found in archive.`);
  }
};
