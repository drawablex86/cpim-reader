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

  // Readers work through documents in sequence — chronological neighbours plus
  // the surrounding documents from the same Congress / election cycle.
  const all = loadAllDocuments(); // newest first
  const index = all.findIndex((doc) => doc.slug === params.slug);

  const brief = (doc?: (typeof all)[number] | null) =>
    doc ? { slug: doc.slug, title: doc.title, date: doc.date } : null;

  const period = post.metadata.period as string | undefined;
  let periodPrevious: ReturnType<typeof brief> = null;
  let periodNext: ReturnType<typeof brief> = null;

  if (period) {
    const inPeriod = all
      .filter((doc) => doc.period === period)
      .sort((a, b) => a.date.localeCompare(b.date));
    const position = inPeriod.findIndex((doc) => doc.slug === params.slug);
    if (position !== -1) {
      periodPrevious = brief(inPeriod[position - 1]);
      periodNext = brief(inPeriod[position + 1]);
    }
  }

  return {
    slug: params.slug,
    meta: {
      ...post.metadata,
      translations: availableTranslations
    },
    content: post.default,
    translationComponents,
    neighbors: {
      older: index !== -1 ? brief(all[index + 1]) : null,
      newer: index !== -1 ? brief(all[index - 1]) : null,
      periodPrevious,
      periodNext
    }
  };
};
