import { useContext } from 'react';
import { StudyContentContext } from './StudyMedia.jsx';
import { capturePhotos } from './capture-session.js';
import { samplePhoto } from './study-content.js';
import { moveCapturePhoto } from './capture-motion.js';
import './capture-notice.css';

export function CaptureNotice({ job, onOpen }) {
  const content = useContext(StudyContentContext);
  if (!job) return null;
  const photos = capturePhotos(job, job.status === 'ready');
  const ready = job.status === 'ready';
  const title = ready ? 'Результат готов' : job.result ? 'Уточняем разбор' : 'Разбираем еду';
  const date = new Date(job.createdAt);
  const time = date.toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' });
  const stamp = date.toDateString() === new Date().toDateString() ? time : `${date.toLocaleDateString('ru-RU', { day:'numeric', month:'short' })} · ${time}`;
  const open = event => {
    const source = event.currentTarget.querySelector('.capture-notice-photo');
    const host = event.currentTarget.closest('.screen-study') ?? event.currentTarget.closest('.capture-workbench');
    moveCapturePhoto(source, () => onOpen(job), () => host?.querySelector('.capture-result-photo, .processing-photo-image'));
  };
  return <button type="button" className={`capture-notice ${ready ? 'capture-notice-ready' : 'capture-notice-processing'}`} onClick={open} aria-label={`${title}, ${stamp}, ${photos.length} фото`}>
    <span className="capture-notice-photo" data-capture-id={job.id} aria-hidden="true">{content ? <img src={samplePhoto(photos[0].imageKey).src} alt="" /> : <span>Фото</span>}{photos.length > 1 && <small>{photos.length}</small>}</span>
    <span className="capture-notice-copy"><strong key={job.status} role="status">{title}</strong><span><time dateTime={date.toISOString()}>{stamp}</time>{!ready && ' · сохранено'}</span></span>
    <span className="capture-notice-state" aria-hidden="true">{ready ? '›' : <i />}</span>
  </button>;
}
