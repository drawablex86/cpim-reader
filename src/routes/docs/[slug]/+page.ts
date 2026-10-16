import { error } from '@sveltejs/kit';
import { loadAllDocuments } from '$lib/documents';
import type { EntryGenerator, PageLoad } from './$types';

export const prerender = true;

const masterDocs = import.meta.glob('/src/content/documents/*.md');
const translationDocs = import.meta.glob('/src/content/translations/*/*.md');

export const entries: EntryGenerator = () => {
  const docs = loadAllDocuments();
  return docs.map((doc) => ({ slug: doc.slug }));
};

export const load: PageLoad = async ({ params }) => {
  const masterKey = `/src/content/documents/${params.slug}.md`;
  if (!masterDocs[masterKey]) {
    throw error(404, `Document '${params.slug}' not found in archive.`);
  }

  const post = (await masterDocs[masterKey]()) as { metadata: any; default: any };
  const availableTranslations: Record<string, any> = {};
  const translationComponents: Record<string, any> = {};

  const candidateLangs = ['ml', 'hi', 'bn', 'ta', 'te'];
  for (const lang of candidateLangs) {
    const transKey = `/src/content/translations/${lang}/${params.slug}.md`;
    if (translationDocs[transKey]) {
      const transMod = (await translationDocs[transKey]()) as { metadata: any; default: any };
      availableTranslations[lang] = transMod.metadata;
      translationComponents[lang] = transMod.default;
    }
  }

  return {
    slug: params.slug,
    meta: {
      ...post.metadata,
      translations: availableTranslations
    },
    content: post.default,
    translationComponents
  };
};
