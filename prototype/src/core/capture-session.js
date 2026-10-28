import { EMPTY_PLATE, MEAL_PRESETS, scoreMeal } from '../data/game.js';

export const CAPTURE_STORAGE_KEY = 'chewy.capture-study.v1';
export const CAPTURE_THEMES = {
  science: { label: 'Научная лаборатория', waiting: 'Исследуем твою еду', detail: 'Собираем снимки и детали в одну запись.' },
  alchemy: { label: 'Алхимическая', waiting: 'Колдуем над записью', detail: 'Снимки и детали складываются в запись дня.' },
  computer: { label: 'Компьютерная', waiting: 'Разбираем твою еду', detail: 'Сканер сопоставляет снимки и детали.' },
};

const validPhotos = photos => photos === undefined || (Array.isArray(photos) && photos.length > 0
  && photos.every(photo => typeof photo.id === 'string' && typeof photo.imageKey === 'string' && ['camera', 'gallery'].includes(photo.source))
  && new Set(photos.map(photo => photo.id)).size === photos.length);

// Older saved examples have one imageKey. Keep them usable without a destructive reset.
export function capturePhotos(job, result = false) {
  return (result ? job.result?.photos : job.photos) ?? [{ id: `${job.id}-cover`, imageKey: job.imageKey ?? 'meal', source: job.source ?? 'camera' }];
}

export function completeDueCaptures(jobs, now = Date.now()) {
  return jobs.map(job => job.status === 'processing' && job.readyAt <= now ? {
    ...job, status: 'ready', seen: false,
    result: { name: job.dishName.trim() || 'Овощи с гарниром', notes: job.notes.trim(), portion: job.portion, photos: capturePhotos(job).map(photo => ({ ...photo })) },
  } : job);
}

export function readCaptureSession(storage) {
  const raw = storage.getItem(CAPTURE_STORAGE_KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (parsed.version !== 1 || !Array.isArray(parsed.jobs)) throw new Error('Unsupported capture session');
  const valid = parsed.jobs.every(job => typeof job.id === 'string' && Number.isFinite(job.createdAt) && Number.isFinite(job.readyAt)
    && ['processing', 'ready'].includes(job.status) && Object.hasOwn(CAPTURE_THEMES, job.theme)
    && [0, 1, 2].includes(job.portion) && typeof job.notes === 'string' && typeof job.dishName === 'string' && validPhotos(job.photos)
    && (job.result === null || (typeof job.result?.name === 'string' && typeof job.result?.notes === 'string' && [0, 1, 2].includes(job.result?.portion) && validPhotos(job.result?.photos))));
  if (!valid) throw new Error('Invalid capture session');
  return completeDueCaptures(parsed.jobs);
}

export function writeCaptureSession(storage, jobs) {
  storage.setItem(CAPTURE_STORAGE_KEY, JSON.stringify({ version: 1, jobs }));
}

export function createCapture({ source, theme, portion, notes, delay, photos }, now = Date.now()) {
  if (!validPhotos(photos)) throw new Error('Invalid capture photos');
  return { id: crypto.randomUUID(), createdAt: now, readyAt: now + delay, status: 'processing', seen: false, source, theme, portion, notes, dishName: '', result: null,
    ...(photos ? { photos: photos.map(photo => ({ ...photo })), imageKey: photos[0].imageKey } : {}) };
}

export function reviseCapture(job, { dishName, notes, portion, photos }, delay, now = Date.now()) {
  if (!validPhotos(photos)) throw new Error('Invalid capture photos');
  return { ...job, dishName, notes, portion, readyAt: now + delay, status: 'processing', seen: false,
    result: job.result ? { ...job.result, photos: capturePhotos(job, true).map(photo => ({ ...photo })) } : null,
    ...(photos ? { photos: photos.map(photo => ({ ...photo })), imageKey: photos[0].imageKey } : {}) };
}

export function captureDay(jobs, date = new Date()) {
  const dayKey = date.toDateString();
  let plate = { ...EMPTY_PLATE };
  const preset = MEAL_PRESETS.find(meal => meal.id === 'salad');
  const meals = jobs.filter(job => job.result && new Date(job.createdAt).toDateString() === dayKey).map((job, index) => {
    plate = scoreMeal(plate, preset, job.result.portion, index).plateAfter;
    const photos = capturePhotos(job, true);
    return { id: job.id, name: job.result.name, notes:job.result.notes, portion:job.result.portion, imageKey:photos[0].imageKey, photos, emoji: preset.emoji, time: new Date(job.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) };
  });
  return { plate, meals };
}
