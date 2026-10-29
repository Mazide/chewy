import { useContext, useState } from 'react';
import { StudyContentContext } from './StudyMedia.jsx';
import { capturePhotos } from './capture-session.js';
import { samplePhoto } from './study-content.js';
import { CapturePhotoStrip } from './CapturePhotoSet.jsx';
import './capture-processing.css';

function InspectionTool({ theme }) {
  return <svg className={`processing-tool processing-tool-${theme}`} viewBox="0 0 84 84" fill="none" stroke="#665039" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {theme === 'computer' ? <>
      <path d="M12 29V13h17m26 0h17v16m0 26v17H55m-26 0H12V55" stroke="#38594b" strokeWidth="4" />
      <path className="processing-scan-line" d="M16 42h52" stroke="#dceebc" strokeWidth="3" />
      <path d="M37 42h10m-5-5v10" stroke="#38594b" />
    </> : theme === 'alchemy' ? <>
      <circle cx="38" cy="36" r="26" fill="#dccbe444" stroke="#84708d" />
      <circle cx="38" cy="36" r="22" stroke="#c0a575" />
      <path d="M24 23q7-6 14-6" stroke="#fff7df" strokeWidth="3" />
      <path d="m58 59 10 13-8 6-10-13Z" fill="#b89e75" />
      <path d="m65 9 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" fill="#f0d18c" />
    </> : <>
      <path d="m54 55 19 18q4 5-1 8l-5-1-18-19Z" fill="#b58b58" />
      <circle cx="35" cy="34" r="28" fill="#dce6cf44" stroke="#665039" strokeWidth="3" />
      <circle cx="35" cy="34" r="23" stroke="#b49a69" strokeWidth="4" />
      <path d="M20 23q4-6 12-7" stroke="#fff7df" strokeWidth="3" />
    </>}
  </svg>;
}

export const CAPTURE_FAILURE_COPY = {
  offline: { title: 'Нет связи', text: 'Не удалось связаться с разбором. Попробуй снова, когда появится связь.' },
  error: { title: 'Не получилось разобрать', text: 'Во время разбора произошёл сбой. Можно повторить с теми же снимками.' },
  timeout: { title: 'Ответ пока не пришёл', text: 'Разбор не ответил вовремя. Можно попробовать ещё раз.' },
};

export function CaptureProcessing({ job, theme, onCamp, onRetry, onEdit, onPrevious, onCancel, exitLabel = 'В лагерь' }) {
  const content = useContext(StudyContentContext);
  const photos = capturePhotos(job);
  const [selected, setSelected] = useState(null);
  const photo = photos.find(item => item.id === selected) ?? photos[0];
  const index = photos.indexOf(photo);
  const updating = Boolean(job.result);
  const failure = job.status === 'failed' ? CAPTURE_FAILURE_COPY[job.failure] : null;
  const notFood = job.status === 'notFood';
  const issue = notFood ? { title:'Не удалось узнать еду', text:'На этих снимках пока не получилось распознать еду. Добавь детали или замени фото.' } : failure;
  return <>
    <section className={`capture-processing${issue ? ' capture-failed' : ''}`} aria-label={notFood ? 'Еда не распознана' : failure ? 'Ошибка разбора еды' : updating ? 'Повторный анализ еды' : 'Анализ отправленной еды'}>
      <p className="processing-receipt"><span aria-hidden="true">✓</span>{updating ? 'Правки сохранены' : photos.length > 1 ? 'Снимки сохранены' : 'Фото сохранено'}</p>
      {issue && <><h3 className="processing-status" aria-live="polite">{issue.title}</h3><p className="processing-failure-copy">{issue.text}</p>{updating && <p className="processing-failure-copy">Прежний результат и его вклад остаются. Правки и новые снимки сохранены для {notFood ? 'уточнения' : 'повтора'}.</p>}</>}
      <figure className="processing-photo" aria-label={`Отправленное фото ${index + 1} из ${photos.length}`}>
        <div className="processing-photo-image">{content ? <img src={samplePhoto(photo.imageKey).src} alt="" /> : <span>Снимок</span>}{!issue && <InspectionTool theme={theme} />}</div>
      </figure>
      {photos.length > 1 && <CapturePhotoStrip photos={photos} selected={photo.id} onSelect={setSelected} revealSelected />}
      {!issue && <h3 className="processing-status" role="status"><span className="processing-pulse" aria-hidden="true" />{updating ? 'Уточняем разбор' : 'Разбираем еду'}</h3>}
      <details className="processing-details"><summary>{issue ? 'Сохранённые детали' : 'Что разбираем'}</summary><p>{photos.length === 1 ? 'Отправленный снимок' : `Отправленные снимки · ${photos.length}`}{job.notes?.trim() ? ' и твои уточнения.' : '.'}</p>{job.dishName?.trim() && <p>{job.dishName.trim()}</p>}{job.notes?.trim() && <p className="processing-user-note">{job.notes.trim()}</p>}{updating && <p>В дневнике остаётся прежний результат.</p>}{!issue && <p>Готовый разбор появится здесь и в лагере.</p>}</details>
      {onCancel && <button type="button" className="capture-record-action" onClick={onCancel}>{updating ? 'Отменить уточнение' : 'Отменить разбор'}</button>}
    </section>
    <footer className={`processing-exit${issue ? ' processing-failed-actions' : ''}`}>
      {!issue && <p>Можно закрыть приложение.<br />Результат будет в лагере.</p>}
      {notFood && <button type="button" className="capture-primary" onClick={onEdit}>Уточнить запись</button>}
      {failure && <button type="button" className="capture-primary" onClick={onRetry}>Повторить</button>}
      <div className="processing-exit-links">{updating && <button type="button" onClick={onPrevious}>Прежний результат</button>}<button type="button" className={issue || updating ? undefined : 'capture-primary'} onClick={onCamp}>{exitLabel}</button></div>
    </footer>
  </>;
}
