export interface DocumentMeta {
  title: string;
  slug: string;
  date: string;
  category: string;
  language?: string;
  author?: string;
  publisher?: string;
  source_pdf_url?: string;
  source_post_url?: string;
  page_count?: number;
  extraction_method?: string;
  sha256?: string;
}

export interface TocHeading {
  id: string;
  text: string;
  level: number;
}

export function loadAllDocuments(): DocumentMeta[] {
  const modules = import.meta.glob('/src/content/documents/*.md', { eager: true });
  const docs: DocumentMeta[] = [];

  for (const [, mod] of Object.entries(modules)) {
    const m = mod as { metadata?: DocumentMeta };
    if (m.metadata) {
      docs.push(m.metadata);
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