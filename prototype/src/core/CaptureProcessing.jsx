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

export function CaptureProcessing({ job, theme, onCamp }) {
  const content = useContext(StudyContentContext);
  const photos = capturePhotos(job);
  const [selected, setSelected] = useState(null);
  const photo = photos.find(item => item.id === selected) ?? photos[0];
  const index = photos.indexOf(photo);
  const updating = Boolean(job.result);
  return <>
    <section className="capture-processing" aria-label={updating ? 'Повторный анализ еды' : 'Анализ отправленной еды'}>
      <p className="processing-receipt"><span aria-hidden="true">✓</span>{updating ? 'Правки сохранены' : photos.length > 1 ? 'Снимки сохранены' : 'Фото сохранено'}</p>
      <figure className="processing-photo" aria-label={`Отправленное фото ${index + 1} из ${photos.length}`}>
        <div className="processing-photo-image">{content ? <img src={samplePhoto(photo.imageKey).src} alt="" /> : <span>Фото еды</span>}<InspectionTool theme={theme} /></div>
      </figure>
      {photos.length > 1 && <CapturePhotoStrip photos={photos} selected={photo.id} onSelect={setSelected} revealSelected />}
      <h3 className="processing-status" role="status"><span className="processing-pulse" aria-hidden="true" />{updating ? 'Уточняем разбор' : 'Разбираем еду'}</h3>
      <details className="processing-details"><summary>Что разбираем</summary><p>{photos.length === 1 ? 'Снимок этой еды' : `${photos.length} фото одной еды`}{job.notes?.trim() ? ' и твои уточнения.' : '.'}</p>{job.notes?.trim() && <p className="processing-user-note">{job.notes.trim()}</p>}{updating && <p>Пока готовится уточнение, в дневнике остаётся прежний результат.</p>}<p>Готовый разбор появится здесь и в лагере.</p></details>
    </section>
    <footer className="processing-exit"><p>Можно закрыть приложение.<br />Результат будет в лагере.</p><button type="button" className="capture-primary" onClick={onCamp}>В лагерь</button></footer>
  </>;
}
