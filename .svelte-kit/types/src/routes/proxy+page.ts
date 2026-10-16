// @ts-nocheck
import { loadAllDocuments } from '$lib/documents';
import type { PageLoad } from './$types';

export const prerender = true;

export const load = () => {
  const documents = loadAllDocuments();
  return { documents };
};
;null as any as PageLoad;