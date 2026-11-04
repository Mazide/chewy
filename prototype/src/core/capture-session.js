import { demoMealName, mealAssessment, snapshotMealAssessment, snapshotUncertainAssessment, validMealAssessment } from './food-assessment.js';

export const CAPTURE_STORAGE_KEY = 'chewy.capture-study.v1';
export const localDayKey = (time = Date.now()) => {
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
export const CAPTURE_THEMES = {
  science: { label: 'Научная лаборатория', waiting: 'Исследуем твою еду', detail: 'Собираем снимки и детали в одну запись.' },
  alchemy: { label: 'Алхимическая', waiting: 'Колдуем над записью', detail: 'Снимки и детали складываются в запись дня.' },
  computer: { label: 'Компьютерная', waiting: 'Разбираем твою еду', detail: 'Сканер сопоставляет снимки и детали.' },
};
export const CAPTURE_OUTCOMES = {
  success: 'Готовый результат',
  notFood: 'Не-еда',
  uncertain: 'Состав неясен',
  offline: 'Нет сети',
  error: 'Ошибка анализа',
  timeout: 'Долго нет ответа',
};

const validOutcome = outcome => Object.hasOwn(CAPTURE_OUTCOMES, outcome);
const validFailure = failure => ['offline', 'error', 'timeout'].includes(failure);

const validPhotos = photos => photos === undefined || (Array.isArray(photos) && photos.length > 0
  && photos.every(photo => photo && typeof photo.id === 'string' && typeof photo.imageKey === 'string' && ['camera', 'gallery'].includes(photo.source))
  && new Set(photos.map(photo => photo.id)).size === photos.length);
const validResult = result => typeof result?.name === 'string' && typeof result?.notes === 'string'
  && [0, 1, 2].includes(result?.portion) && validPhotos(result?.photos)
  && (result.assessment === undefined || validMealAssessment(result.assessment));

// Older saved examples have one imageKey. Keep them usable without a destructive reset.
export function capturePhotos(job, result = false) {
  return (result ? job.result?.photos : job.photos) ?? [{ id: `${job.id}-cover`, imageKey: job.imageKey ?? 'meal', source: job.source ?? 'camera' }];
}

// A response belongs to the submitted attempt, not whichever task happens to be
// open when it arrives. Keeping the envelope separate also models queued replies.
export function prepareCaptureReply(job) {
  if (!job || job.status !== 'processing') return null;
  const outcome = job.mockOutcome ?? 'success';
  if (!validOutcome(outcome)) throw new Error('Invalid capture outcome');
  const reply = { id: job.id, attempt: job.attempt ?? 1, outcome };
  if (validFailure(outcome) || outcome === 'notFood') return reply;
  const photos = capturePhotos(job).map(photo => ({ ...photo }));
  // Extra views of one dish never multiply its contribution.
  const result = { name: job.dishName.trim() || demoMealName(photos[0].imageKey), notes: job.notes.trim(), portion: job.portion, photos };
  return { ...reply, result: { ...result,
    assessment: (outcome === 'uncertain' ? snapshotUncertainAssessment : snapshotMealAssessment)({ ...result, imageKey: photos[0].imageKey }) } };
}

export function applyCaptureReply(jobs, reply) {
  if (!reply) return jobs;
  const index = jobs.findIndex(job => job.id === reply.id && job.status === 'processing' && (job.attempt ?? 1) === reply.attempt);
  if (index === -1) return jobs;
  if (!validOutcome(reply.outcome)) return jobs;
  let result;
  if (['success', 'uncertain'].includes(reply.outcome)) {
    // New responses require complete snapshots. Optional photos/assessment are
    // supported only when loading legacy saves, never as a partial new answer.
    // Copy at delivery so mutating a queued envelope cannot change saved state.
    try { result = JSON.parse(JSON.stringify(reply.result)); } catch { return jobs; }
    if (!validResult(result) || !Array.isArray(result.photos) || !validMealAssessment(result.assessment)) return jobs;
  }
  const job = jobs[index];
  // Failures and non-food answers keep an earlier confirmed result intact.
  const next = validFailure(reply.outcome) ? { ...job, status: 'failed', failure: reply.outcome, mockOutcome: reply.outcome, seen: false }
    : reply.outcome === 'notFood' ? { ...job, status: 'notFood', mockOutcome: reply.outcome, seen: false }
    : { ...job, status: 'ready', mockOutcome: reply.outcome, result, seen: false };
  return jobs.map((current, currentIndex) => currentIndex === index ? next : current);
}

export function completeDueCaptures(jobs, now = Date.now()) {
  return jobs.reduce((current, job) => job.status === 'processing' && job.readyAt <= now
    ? applyCaptureReply(current, prepareCaptureReply(job)) : current, jobs);
}

export function cancelCapture(jobs, id) {
  const job = jobs.find(current => current.id === id);
  // A confirmation opened during processing must never delete a finished meal.
  if (!job || !['processing', 'failed', 'notFood'].includes(job.status)) return jobs;
  if (!job.result) return jobs.filter(current => current.id !== id);
  const { failure, mockOutcome, ...previous } = job;
  const photos = capturePhotos(job, true).map(photo => ({ ...photo }));
  // Keep the cancelled attempt number. The next revision must move beyond it,
  // so an old reply cannot match a new revision after cancellation or restart.
  const restored = { ...previous, status: 'ready', seen: true, photos,
    source: photos[0].source, imageKey: photos[0].imageKey,
    dishName: job.result.name, notes: job.result.notes, portion: job.result.portion };
  return jobs.map(current => current.id === id ? restored : current);
}

export function deleteCapture(jobs, id) {
  return jobs.some(job => job.id === id && job.result) ? jobs.filter(job => job.id !== id) : jobs;
}

export function readCaptureSession(storage) {
  const raw = storage.getItem(CAPTURE_STORAGE_KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (parsed.version !== 1 || !Array.isArray(parsed.jobs)) throw new Error('Unsupported capture session');
  validateCaptureJobs(parsed.jobs);
  return completeDueCaptures(parsed.jobs);
}

export function validateCaptureJobs(jobs) {
  const valid = Array.isArray(jobs) && jobs.every(job => job && typeof job.id === 'string' && Number.isFinite(job.createdAt) && Number.isFinite(job.readyAt)
    && ['processing', 'ready', 'failed', 'notFood'].includes(job.status) && Object.hasOwn(CAPTURE_THEMES, job.theme)
    && (job.mockOutcome === undefined || validOutcome(job.mockOutcome))
    && (job.attempt === undefined || (Number.isSafeInteger(job.attempt) && job.attempt > 0))
    && (job.status === 'failed' ? validFailure(job.failure) && (job.mockOutcome === undefined || job.mockOutcome === job.failure) : job.failure === undefined)
    && (job.status !== 'notFood' || job.mockOutcome === undefined || job.mockOutcome === 'notFood')
    && [0, 1, 2].includes(job.portion) && typeof job.notes === 'string' && typeof job.dishName === 'string' && validPhotos(job.photos)
    && (job.result === null || validResult(job.result)));
  if (!valid) throw new Error('Invalid capture session');
  if (new Set(jobs.map(job => job.id)).size !== jobs.length) throw new Error('Duplicate captures');
}

export function writeCaptureSession(storage, jobs) {
  storage.setItem(CAPTURE_STORAGE_KEY, JSON.stringify({ version: 1, jobs }));
}

export function createCapture({ source, theme, portion, notes, delay, photos, outcome = 'success' }, now = Date.now()) {
  if (!validPhotos(photos)) throw new Error('Invalid capture photos');
  if (!validOutcome(outcome)) throw new Error('Invalid capture outcome');
  return { id: crypto.randomUUID(), createdAt: now, readyAt: now + delay, status: 'processing', mockOutcome: outcome, attempt: 1, seen: false, source, theme, portion, notes, dishName: '', result: null,
    ...(photos ? { photos: photos.map(photo => ({ ...photo })), imageKey: photos[0].imageKey } : {}) };
}

export function reviseCapture(job, { dishName, notes, portion, photos }, delay, now = Date.now(), outcome = 'success') {
  if (!validPhotos(photos)) throw new Error('Invalid capture photos');
  if (!validOutcome(outcome)) throw new Error('Invalid capture outcome');
  const { failure, ...previous } = job;
  return { ...previous, dishName, notes, portion, readyAt: now + delay, status: 'processing', mockOutcome: outcome, attempt: (job.attempt ?? 1) + 1, seen: false,
    result: job.result ? { ...job.result, photos: capturePhotos(job, true).map(photo => ({ ...photo })) } : null,
    ...(photos ? { photos: photos.map(photo => ({ ...photo })), imageKey: photos[0].imageKey } : {}) };
}

export function retryCapture(job, { outcome = 'success', delay }, now = Date.now()) {
  if (job.status !== 'failed') throw new Error('Only failed captures can be retried');
  if (!validOutcome(outcome)) throw new Error('Invalid capture outcome');
  const { failure, ...previous } = job;
  return { ...previous, readyAt: now + delay, status: 'processing', mockOutcome: outcome, attempt: (job.attempt ?? 1) + 1, seen: false };
}

export function captureDay(jobs, date = new Date()) {
  // A saved calendar date is already the entry's identity. Parsing it as a UTC
  // instant would move that date in some browser time zones.
  const dayKey = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : localDayKey(date);
  const meals = jobs.filter(job => job.result && (job.dayKey ?? localDayKey(job.createdAt)) === dayKey).map(job => {
    const photos = capturePhotos(job, true);
    const meal = { id: job.id, name: job.result.name, notes:job.result.notes, portion:job.result.portion, imageKey:photos[0].imageKey, photos,
      emoji: { meal: '🥗', breakfast: '🥣', chicken: '🍗', apple: '🍎' }[photos[0].imageKey] ?? '🍽️',
      time: new Date(job.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) };
    return { ...meal, assessment: job.result.assessment ?? mealAssessment(meal) };
  });
  return { meals };
}
