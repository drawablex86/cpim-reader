export interface TranslationMeta {
  title: string;
  original_title?: string;
  slug: string;
  language: string;
  language_name: string;
  translated_via?: string;
  translated_at?: string;
  date?: string;
  category?: string;
}

export interface DocumentMeta {
  title: string;
  slug: string;
  date: string;
  category: string;
  language?: string;
  language_name?: string;
  author?: string;
  publisher?: string;
  source_pdf_url?: string;
  source_post_url?: string;
  page_count?: number;
  extraction_method?: string;
  sha256?: string;
  translations?: Record<string, TranslationMeta>;
}

export interface TocHeading {
  id: string;
  text: string;
  level: number;
}

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' }
] as const;

export function loadAllDocuments(): DocumentMeta[] {
  const masterModules = import.meta.glob('/src/content/documents/*.md', { eager: true });
  const transModules = import.meta.glob('/src/content/translations/*/*.md', { eager: true });

  // Map translations by slug
  const transMap: Record<string, Record<string, TranslationMeta>> = {};

  for (const [path, mod] of Object.entries(transModules)) {
    const m = mod as { metadata?: TranslationMeta };
    if (m.metadata && m.metadata.slug && m.metadata.language) {
      const slug = m.metadata.slug;
      if (!transMap[slug]) transMap[slug] = {};
      transMap[slug][m.metadata.language] = m.metadata;
    }
  }

  const docs: DocumentMeta[] = [];

  for (const [, mod] of Object.entries(masterModules)) {
    const m = mod as { metadata?: DocumentMeta };
    if (m.metadata) {
      const doc = { ...m.metadata };
      if (!doc.language) doc.language = 'en';
      if (!doc.language_name) doc.language_name = 'English';
      doc.translations = transMap[doc.slug] || {};
      docs.push(doc);
    }
  }

  return docs.sort((a, b) => b.date.localeCompare(a.date));
}

export function slugifyText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

export function extractHeadingsFromMarkdown(raw: string): TocHeading[] {
  const headings: TocHeading[] = [];
  const lines = raw.split('\n');

  for (const line of lines) {
    const match = line.match(/^(#{2,3})\s+(.*)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim().replace(/\*\*/g, '');
      const id = slugifyText(text);
      if (text && id) {
        headings.push({ id, text, level });
      }
    }
  }

  return headings;
}