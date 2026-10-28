export const REVIEW_ARCHIVE_KEY = 'chewy.review-archive.v1';
export const REVIEW_ARCHIVE_EVENT = 'chewy:review-archive';

export function readReviewArchive(storage) {
  try {
    const saved = JSON.parse(storage.getItem(REVIEW_ARCHIVE_KEY));
    return Object.fromEntries(['stories', 'screens'].map(scope => [scope,
      Array.isArray(saved?.[scope]) ? [...new Map(saved[scope]
        .filter(entry => entry && typeof entry.id === 'string' && typeof entry.label === 'string')
        .map(entry => [entry.id, entry])).values()] : [],
    ]));
  } catch {
    return { stories: [], screens: [] };
  }
}

export function updateReviewArchive(storage, scope, entry, archived) {
  const current = readReviewArchive(storage);
  if (!['stories', 'screens'].includes(scope) || !entry.id) return current;
  const entries = current[scope].filter(item => item.id !== entry.id);
  const next = { ...current, [scope]: archived ? [...entries, entry] : entries };
  // Write first: a failed save must not look like a successful removal.
  storage.setItem(REVIEW_ARCHIVE_KEY, JSON.stringify(next));
  return next;
}
