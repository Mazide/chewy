import { useEffect, useState } from 'react';
import { REVIEW_ARCHIVE_EVENT, REVIEW_ARCHIVE_KEY, readReviewArchive, updateReviewArchive } from './review-archive.js';

export function readBrowserReviewArchive() {
  try { return readReviewArchive(window.localStorage); }
  catch { return { stories: [], screens: [] }; }
}

export function useReviewArchive() {
  const [archive, setArchive] = useState(readBrowserReviewArchive);
  const [error, setError] = useState('');
  useEffect(() => {
    const refresh = event => {
      if (event.type === 'storage' && event.key !== null && event.key !== REVIEW_ARCHIVE_KEY) return;
      setArchive(readBrowserReviewArchive());
    };
    window.addEventListener('storage', refresh);
    window.addEventListener(REVIEW_ARCHIVE_EVENT, refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener(REVIEW_ARCHIVE_EVENT, refresh);
    };
  }, []);
  const change = (scope, entry, archived) => {
    try {
      const next = updateReviewArchive(window.localStorage, scope, entry, archived);
      setArchive(next);
      setError('');
      window.dispatchEvent(new Event(REVIEW_ARCHIVE_EVENT));
      return true;
    } catch {
      setError('Не удалось сохранить список. Разреши локальное хранение и попробуй ещё раз.');
      return false;
    }
  };
  return { archive, error, change };
}
