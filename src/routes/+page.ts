import { loadAllDocuments } from '$lib/documents';
import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = () => {
  const documents = loadAllDocuments();
  return { documents };
};
