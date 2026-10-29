import { useContext } from 'react';
import { StudyContentContext } from './StudyMedia.jsx';
import { capturePhotos, localDayKey } from './capture-session.js';
import { samplePhoto } from './study-content.js';
import { moveCapturePhoto } from './capture-motion.js';
import './capture-notice.css';

export function CaptureNotice({ job, onOpen, now = Date.now() }) {
  const content = useContext(StudyContentContext);
  if (!job) return null;
  const photos = capturePhotos(job, job.status === 'ready');
  const ready = job.status === 'ready';
  const failed = job.status === 'failed';
  const notFood = job.status === 'notFood';
  const uncertain = ready && job.result?.assessment?.tone === 'unknown';
  const title = notFood ? 'Не удалось узнать еду' : uncertain ? 'Есть что уточнить' : failed ? job.result ? 'Уточнение ждёт повтора' : 'Разбор ждёт повтора' : ready ? 'Результат готов' : job.result ? 'Уточняем разбор' : 'Разбираем еду';
  const date = new Date(job.createdAt);
  const dayKey = job.dayKey ?? localDayKey(job.createdAt);
  const time = date.toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' });
  const dayLabel = new Date(`${dayKey}T00:00:00Z`).toLocaleDateString('ru-RU', { day:'numeric', month:'short', timeZone:'UTC' });
  const stamp = dayKey === localDayKey(now) ? time : `${dayLabel} · ${time}`;
  const open = event => {
    const source = event.currentTarget.querySelector('.capture-notice-photo');
    const host = event.currentTarget.closest('.screen-study') ?? event.currentTarget.closest('.capture-workbench');
    moveCapturePhoto(source, () => onOpen(job), () => host?.querySelector('.capture-result-photo, .processing-photo-image'));
  };
  return <button type="button" className={`capture-notice ${failed || notFood ? 'capture-notice-failed' : ready ? 'capture-notice-ready' : 'capture-notice-processing'}`} onClick={open} aria-label={`${title}, ${stamp}, ${photos.length} фото`}>
    <span className="capture-notice-photo" data-capture-id={job.id} aria-hidden="true">{content ? <img src={samplePhoto(photos[0].imageKey).src} alt="" /> : <span>Фото</span>}{photos.length > 1 && <small>{photos.length}</small>}</span>
    <span className="capture-notice-copy"><strong key={job.status} role="status">{title}</strong><span><time dateTime={date.toISOString()}>{stamp}</time>{!ready && ' · сохранено'}</span></span>
    <span className="capture-notice-state" aria-hidden="true">{failed ? '↻' : ready || notFood ? '›' : <i />}</span>
  </button>;
}
