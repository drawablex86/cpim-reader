/**
 * Reader position tracking.
 *
 * The archive is offline-capable and fully static, so progress lives in
 * localStorage rather than any server. Entries are keyed by document slug and
 * capped so the map cannot grow without bound.
 */
export interface ReadingProgressEntry {
  slug: string;
  title: string;
  percent: number;
  headingId?: string;
  headingText?: string;
  updatedAt: number;
}

const STORAGE_KEY = 'cpim:reading-progress';
const MAX_ENTRIES = 40;

function hasStorage(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

export function readAllProgress(): Record<string, ReadingProgressEntry> {
  if (!hasStorage()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ReadingProgressEntry>;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

export function getProgress(slug: string): ReadingProgressEntry | null {
  return readAllProgress()[slug] || null;
}

export function saveProgress(entry: ReadingProgressEntry): void {
  if (!hasStorage()) return;

  const all = readAllProgress();
  all[entry.slug] = entry;

  const trimmed = Object.fromEntries(
    Object.entries(all)
      .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
      .slice(0, MAX_ENTRIES)
  );

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* quota exceeded or storage disabled — progress simply is not persisted */
  }
}

export function clearProgress(slug: string): void {
  if (!hasStorage()) return;
  const all = readAllProgress();
  if (!(slug in all)) return;
  delete all[slug];
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

/** Most recent in-progress documents, newest first. */
export function recentProgress(limit = 4): ReadingProgressEntry[] {
  return Object.values(readAllProgress())
    .filter((entry) => entry.percent >= 1 && entry.percent <= 98)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(timestamp).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}
