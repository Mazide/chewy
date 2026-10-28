import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { SANDBOX_DEVICES } from './sandbox-scene-layout.js';
import { CampSandbox } from './CampSandbox.jsx';
import { createCampSupplyMoment } from './camp-supply-metaphors.js';
import { MealFoodAssessment } from './FoodAssessment.jsx';
import { CAPTURE_THEMES, captureDay, capturePhotos, completeDueCaptures, createCapture, readCaptureSession, reviseCapture, writeCaptureSession } from './capture-session.js';
import './add-food-canvas.css';
import { StudyContentContext } from './StudyMedia.jsx';
import { PHOTO_SAMPLES, samplePhoto } from './study-content.js';
import { CaptureFinder, CaptureIcon } from './CaptureInstrument.jsx';
import { CaptureDetails, CapturePhotoStrip, Portions } from './CapturePhotoSet.jsx';
import { CaptureProcessing } from './CaptureProcessing.jsx';
import { CaptureNotice } from './CaptureNotice.jsx';
import { CapturePhotoFlight } from './CapturePhotoFlight.jsx';
import { moveCapturePhoto } from './capture-motion.js';
import './capture-flow.css';
import './result-journal.css';

export function AddFoodCanvas({ compact = false, initialView, initialJobId, deviceOverride, onCamp, onJobsChange, themeOverride, previewSample = 'meal', previewDishName, previewNotes = 'Соус отдельно', previewOtherMeals = [], pausePreview = false }) {
  const content = useContext(StudyContentContext);
  const fixture = ['waiting', 'result'].includes(initialView) && !initialJobId;
  const [initial] = useState(() => {
    if (fixture) {
      const job = createCapture({ source:'camera', theme:'science', portion:1, notes:previewNotes, delay:20000 });
      job.imageKey = previewSample; job.dishName = previewDishName || samplePhoto(previewSample).name;
      return { jobs: initialView === 'result' ? completeDueCaptures([job], Infinity) : [job], error:false };
    }
    try { return { jobs: readCaptureSession(window.localStorage), error: false }; }
    catch { return { jobs: [], error: true }; }
  });
  const [jobs, setJobs] = useState(initial.jobs);
  const jobsRef = useRef(initial.jobs);
  const blocked = useRef(initial.error);
  const shotLock = useRef(false);
  const workbench = useRef(null);
  const [photoFlight, setPhotoFlight] = useState(null);
  const [error, setError] = useState(initial.error ? 'Не удалось прочитать сохранённый пример. Можно начать новое демо в инспекторе.' : '');
  const [view, setView] = useState(initialView ? ['waiting', 'result'].includes(initialView) ? 'analysis' : initialView : initial.jobs.length ? 'camp' : 'camera');
  const [selectedId, setSelectedId] = useState(initialJobId ?? (fixture ? initial.jobs[0]?.id : null));
  const [deviceKey, setDeviceKey] = useState('standard');
  const [theme, setTheme] = useState(initial.jobs.at(-1)?.theme ?? 'science');
  const [delay, setDelay] = useState(20000);
  const [portion, setPortion] = useState(1);
  const [notes, setNotes] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [correction, setCorrection] = useState(() => { const job = initial.jobs.find(item => item.id === initialJobId) ?? (fixture ? initial.jobs[0] : null); return { dishName: job?.dishName || job?.result?.name || 'Овощи с гарниром', notes:job?.notes ?? '', portion:job?.portion ?? 1 }; });
  const [gallerySelection, setGallerySelection] = useState([]);
  const [draftPhotos, setDraftPhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [retakeId, setRetakeId] = useState(null);
  const [editingResult, setEditingResult] = useState(false);
  const [photoRevision, setPhotoRevision] = useState(false);
  const [resultPhoto, setResultPhoto] = useState(null);
  const [supplyMoment, setSupplyMoment] = useState(null);
  const currentDevice = deviceOverride ?? deviceKey;
  const device = SANDBOX_DEVICES[currentDevice];
  const active = jobs.find(job => job.id === selectedId);
  const resultPhotos = active?.result ? capturePhotos(active, true) : [];
  const shownResultPhoto = resultPhotos.find(photo => photo.id === resultPhoto) ?? resultPhotos[0];
  const shownDraftPhoto = draftPhotos.find(photo => photo.id === selectedPhoto) ?? draftPhotos[0];
  const activePhoto = samplePhoto(active?.status === 'ready' ? shownResultPhoto?.imageKey : active?.imageKey);
  const day = { ...captureDay(jobs), onMealSelect: (id) => { const job = jobs.find(item => item.id === id); if (job) openAnalysis(job); } };
  const attention = [...jobs].reverse().find(job => job.status === 'processing' || (job.status === 'ready' && !job.seen));
  const pending = jobs.some(job => job.status === 'processing');
  useEffect(() => { if (themeOverride) setTheme(themeOverride); }, [themeOverride]);
  useEffect(() => { if (view !== 'camera') setPhotoFlight(null); }, [view]);

  const commit = useCallback((next, force = false) => {
    if (blocked.current && !force) return false;
    try {
      if (!fixture) writeCaptureSession(window.localStorage, next);
      blocked.current = false;
      jobsRef.current = next;
      setJobs(next);
      if (!fixture) onJobsChange?.(next);
      setError('');
      return true;
    } catch {
      setError('Не удалось сохранить снимок в этом браузере. Пока не закрывай страницу — попробуй ещё раз.');
      return false;
    }
  }, [fixture, onJobsChange]);

  useEffect(() => {
    if (!blocked.current) commit(jobsRef.current);
    const settle = () => {
      if (fixture && pausePreview && initialView === 'waiting') return;
      const next = completeDueCaptures(jobsRef.current);
      if (next.some((job, index) => job !== jobsRef.current[index])) commit(next);
    };
    const timer = window.setInterval(settle, 500);
    document.addEventListener('visibilitychange', settle);
    window.addEventListener('pageshow', settle);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', settle); window.removeEventListener('pageshow', settle); };
  }, [commit, fixture, pausePreview, initialView]);

  const openCamera = () => {
    shotLock.current = false; setPortion(1); setNotes(''); setDetailsOpen(false);
    setDraftPhotos([]); setSelectedPhoto(null); setRetakeId(null); setPhotoRevision(false); setEditingResult(false); setView('camera');
  };
  const addPhotos = samples => {
    const added = samples.map(sample => ({ id:crypto.randomUUID(), imageKey:sample.key, source:sample.source }));
    setDraftPhotos(current => retakeId ? current.flatMap(photo => photo.id === retakeId ? added : [photo]) : [...current,...added]);
    setSelectedPhoto(added.at(-1).id); setRetakeId(null); setView('camera');
    setPhotoFlight(content && view === 'camera' ? added.at(-1) : null);
  };
  const openGallery = () => { setGallerySelection([]); setView('gallery'); };
  const removePhoto = () => {
    const next = draftPhotos.filter(photo => photo.id !== shownDraftPhoto.id);
    setDraftPhotos(next); setSelectedPhoto(next[0]?.id ?? null);
    if (!next.length) setView('camera');
  };
  const capture = () => {
    if (shotLock.current || !draftPhotos.length) return;
    shotLock.current = true;
    const sample = samplePhoto(draftPhotos[0].imageKey);
    const job = createCapture({ source:draftPhotos[0].source, theme, portion, notes, delay, photos:draftPhotos });
    job.dishName = sample.name;
    if (commit([...jobsRef.current, job])) {
      const source = workbench.current.querySelector(`[data-photo-id="${draftPhotos[0].id}"]`);
      const host = workbench.current.closest('.screen-study') ?? workbench.current;
      moveCapturePhoto(source, () => { setDraftPhotos([]); setSelectedId(job.id); onCamp ? onCamp() : setView('camp'); }, () => host.querySelector(`[data-capture-id="${job.id}"]`));
    }
    else shotLock.current = false;
  };
  const finishPhotoRevision = () => {
    setCorrection(current => ({...current,notes,portion})); setPhotoRevision(false); setEditingResult(true); setView('analysis');
  };
  const closeCamera = () => {
    if (retakeId) { setRetakeId(null); setView('review'); return; }
    if (photoRevision) { finishPhotoRevision(); return; }
    if (draftPhotos.length) { setRetakeId(null); setView('review'); return; }
    onCamp ? onCamp() : setView('camp');
  };
  const editResult = () => {
    setCorrection({ dishName:active.result.name, notes:active.result.notes, portion:active.result.portion });
    setDraftPhotos(capturePhotos(active,true).map(photo => ({...photo}))); setSelectedPhoto(null); setEditingResult(true);
  };
  const editResultPhotos = () => {
    setNotes(correction.notes); setPortion(correction.portion); setPhotoRevision(true); setRetakeId(null); setView(draftPhotos.length ? 'review' : 'camera');
  };
  const openAnalysis = (job) => {
    setSelectedId(job.id);
    setTheme(job.theme);
    setCorrection({ dishName: job.dishName || job.result?.name || 'Овощи с гарниром', notes: job.notes, portion: job.portion });
    setEditingResult(false); setResultPhoto(null); setView('analysis');
  };
  const returnToCamp = () => {
    const moment = active?.status === 'ready' && !active.seen ? createCampSupplyMoment({ ...active.result, id:active.id, imageKey:resultPhotos[0]?.imageKey }) : null;
    if (active?.status === 'ready') commit(jobsRef.current.map(job => job.id === active.id ? { ...job, seen: true } : job));
    setSupplyMoment(moment);
    onCamp ? onCamp({ supplyMoment:moment }) : setView('camp');
  };
  const revise = () => {
    if (!active || active.status !== 'ready') return;
    if (commit(jobsRef.current.map(job => job.id === active.id ? reviseCapture(job, {...correction, photos:draftPhotos}, delay) : job))) { setEditingResult(false); setResultPhoto(null); }
  };
  const reset = () => { if (commit([], true)) { setSelectedId(null); openCamera(); } };
  const dirty = active?.result && (correction.dishName.trim() !== active.result.name || correction.notes.trim() !== active.result.notes || correction.portion !== active.result.portion || JSON.stringify(draftPhotos) !== JSON.stringify(resultPhotos));

  return <section ref={workbench} className={`capture-workbench${compact ? ' capture-workbench-compact' : ''}`}>
    {!compact && <header className="capture-heading"><h1>Добавить еду · камера и анализ</h1><p>Снимки одной еды, детали по желанию и одна запись. После сохранения можно убрать телефон.</p></header>}
    <div className="capture-layout">
      <div className="capture-preview" style={{ '--capture-width': `${device.width}px` }}>
        {view === 'camp' ? <div className="capture-camp-host"><CampSandbox supplyMoment={supplyMoment} key={currentDevice} presentation={content ? 'art' : 'blocks'} initialPreset="growth" initialDevice={currentDevice} foodLayout="separate" foodPresentation="journal" initialEditing={false} onAddFood={openCamera} journalData={day} activity={attention && <CaptureNotice job={attention} onOpen={openAnalysis} />} /></div> : <div className={`capture-phone capture-flow capture-stage-${view} capture-theme-${theme}${content ? ' capture-camp-style' : ''}${content && ['camera','review'].includes(view) ? ' capture-instrument' : ''}${currentDevice === 'compact' ? ' capture-small' : ''}`} style={{ aspectRatio: `${device.width} / ${device.height}`, '--capture-safe-top': `${device.safeTop / device.width * 100}cqw`, '--capture-safe-bottom': `${device.safeBottom / device.width * 100}cqw` }} aria-label={view === 'camera' ? 'Экран камеры' : view === 'review' ? 'Просмотр снимков' : view === 'gallery' ? 'Галерея' : 'Обработка и результат'}>
          <div className="capture-camera-world" aria-hidden="true">{content ? <img className="capture-live-photo" src={view === 'review' ? samplePhoto(shownDraftPhoto?.imageKey).src : PHOTO_SAMPLES[0].src} alt="" /> : <div className="capture-dish"><i /><i /><i /></div>}</div>
          <div className="capture-home-indicator" aria-hidden="true" />
          {view === 'camera' ? <>
            <header className="capture-top"><button type="button" aria-label={retakeId ? 'Отменить пересъёмку' : photoRevision ? 'К уточнению' : draftPhotos.length ? 'Вернуться к снимкам' : 'Вернуться в лагерь'} onClick={closeCamera}>{content ? <CaptureIcon kind="back" /> : '←'}</button><div className="capture-instrument-title"><h2>{retakeId ? 'Переснять кадр' : 'Добавить еду'}</h2></div><span className="capture-top-spacer" /></header>
            {content ? <CaptureFinder theme={theme} /> : <div className="capture-viewfinder" aria-hidden="true"><span /><span /><span /><span /></div>}
            <div className="capture-camera-controls">
              {draftPhotos.length > 0 && <div className="capture-photo-tray">
                <p role="status" className={retakeId ? undefined : 'capture-sr-only'}>{retakeId ? `Заменяем фото ${draftPhotos.findIndex(photo => photo.id === retakeId) + 1}` : `Фото этой еды · ${draftPhotos.length}`}</p>
                <div className="capture-photo-tray-row">
                  <CapturePhotoStrip photos={draftPhotos} selected={shownDraftPhoto?.id} revealSelected onSelect={id => { setSelectedPhoto(id); setRetakeId(null); setView('review'); }} />
                  {retakeId ? <button type="button" className="capture-tray-submit" onClick={() => { setRetakeId(null); setView('review'); }}>Отмена</button> : <button type="button" className="capture-tray-submit" aria-label={photoRevision ? 'Готово, к уточнению' : 'Сохранить и разобрать'} onClick={photoRevision ? finishPhotoRevision : capture}><span>{photoRevision ? 'Готово' : 'Разобрать'}</span><span aria-hidden="true">→</span></button>}
                </div>
              </div>}
              <div className="capture-shutter-row">
                <button type="button" className="capture-gallery" aria-label="Галерея" onClick={openGallery}><span className="capture-instrument-side-icon"><CaptureIcon kind="gallery" /></span></button>
                <button type="button" className="capture-shutter" aria-label={retakeId ? 'Снять новый кадр' : 'Сфотографировать еду'} onClick={() => addPhotos([{...PHOTO_SAMPLES[0],source:'camera'}])}><span><CaptureIcon kind="camera" /></span></button>
                <button type="button" className="capture-details-toggle" aria-label={notes || portion !== 1 ? 'Детали добавлены' : 'Детали'} aria-expanded={detailsOpen} onClick={() => setDetailsOpen(true)}><span className="capture-instrument-side-icon"><CaptureIcon kind="notes" />{(notes || portion !== 1) && <i className="capture-details-mark" aria-hidden="true" />}</span></button>
              </div>
            </div>
          </> : view === 'review' ? <>
            <header className="capture-top"><button type="button" aria-label={photoRevision ? 'К уточнению' : 'Назад к камере'} onClick={() => photoRevision ? finishPhotoRevision() : setView('camera')}>{content ? <CaptureIcon kind="back" /> : '←'}</button><div className="capture-instrument-title"><h2>{photoRevision ? 'Фото записи' : 'Снимок еды'}</h2><small>Всё в одной записи</small></div><span className="capture-top-spacer" /></header>
            <div className="capture-photo-tools"><button type="button" onClick={() => { setRetakeId(shownDraftPhoto.id); setView('camera'); }}>↻ Переснять</button><button type="button" onClick={removePhoto}>Убрать фото</button></div>
            <div className="capture-review-controls">
              <CapturePhotoStrip photos={draftPhotos} selected={shownDraftPhoto?.id} onSelect={setSelectedPhoto} onAdd={() => { setRetakeId(null); setView('camera'); }} />
              <button type="button" className="capture-review-details" onClick={() => setDetailsOpen(true)}><CaptureIcon kind="notes" /><span>{notes ? notes : 'Добавить детали'}<small>{portion === 1 ? 'Состав, соус или размер порции' : `Порция: ${['небольшая','обычная','большая'][portion]}`}</small></span><b aria-hidden="true">›</b></button>
              <button type="button" className="capture-primary" onClick={photoRevision ? finishPhotoRevision : capture}>{photoRevision ? 'Готово, к уточнению' : 'Сохранить и разобрать'}</button>
              {!photoRevision && <p>После сохранения можно убрать телефон</p>}
            </div>
          </> : view === 'gallery' ? <div className="capture-gallery-screen"><header className="capture-top"><button aria-label="Назад к камере" onClick={() => setView('camera')}>←</button><div><h2>{retakeId ? 'Замена снимка' : 'Фото этой еды'}</h2><small>{retakeId ? 'Выбери один кадр' : 'Можно выбрать несколько'}</small></div></header><div className="capture-gallery-grid">{PHOTO_SAMPLES.map(({label,src},index) => <button key={label} aria-label={`Выбрать фото: ${label}`} aria-pressed={gallerySelection.includes(index)} onClick={() => setGallerySelection(current => retakeId ? [index] : current.includes(index) ? current.filter(item => item !== index) : [...current,index])}><span className={`capture-gallery-photo capture-gallery-photo-${index}`}>{content && <img src={src} alt="" />}</span><span>{label}</span>{gallerySelection.includes(index) && <strong>✓</strong>}</button>)}</div><footer className="capture-gallery-actions"><button className="capture-primary" disabled={!gallerySelection.length} onClick={() => addPhotos(gallerySelection.map(index => ({...PHOTO_SAMPLES[index],source:'gallery'})))}>Добавить фото{gallerySelection.length ? ` · ${gallerySelection.length}` : ''}</button><p>Фото добавятся в ленту камеры.</p></footer></div> : active && <div className={`capture-analysis${active.status === 'ready' ? ' capture-result-screen' : ' capture-processing-screen'}`}>
            <header className="capture-top"><button type="button" aria-label={editingResult ? "Вернуться к результату" : "Вернуться в лагерь"} onClick={() => editingResult ? setEditingResult(false) : returnToCamp()}>←</button><h2>{editingResult ? 'Уточнение' : 'Разбор еды'}</h2></header>
            {active.status === 'processing' ? <CaptureProcessing key={active.id} job={active} theme={theme} onCamp={returnToCamp} /> : <>
              <div key={editingResult ? "editing" : "summary"} className={`capture-result-content${editingResult ? '' : ' capture-result-journal'}`}>
                {editingResult ? <>
                  <div className="capture-edit-heading"><h3>Уточним запись</h3><p>Добавь то, чего не видно на фото, или поправь ответ.</p></div>
                  <button type="button" className="capture-edit-photos" onClick={editResultPhotos}><span>{content && draftPhotos[0] && <img src={samplePhoto(draftPhotos[0].imageKey).src} alt="" />}</span><div><strong>Снимки · {draftPhotos.length}</strong><small>Добавить, переснять или убрать</small></div><b aria-hidden="true">›</b></button>
                  <label>Название блюда<input value={correction.dishName} maxLength={100} onChange={event => setCorrection({ ...correction, dishName:event.target.value })} /></label>
                  <label>Что уточнить?<textarea value={correction.notes} maxLength={500} onChange={event => setCorrection({ ...correction, notes:event.target.value })} placeholder="Например: это нут, а не картофель. Соус с йогуртом." /></label>
                  <Portions value={correction.portion} onChange={value => setCorrection({ ...correction, portion:value })} />
                  <p className="capture-edit-explanation">Обновим эту запись. Пока готовится уточнение, в дневнике останется прежний результат.</p>
                </> : <>
                  <MealFoodAssessment meal={{ ...active.result, id:active.id, imageKey:resultPhotos[0]?.imageKey }} otherMeals={fixture ? previewOtherMeals : day.meals.filter(meal => meal.id !== active.id)} pendingEdits={false}
                    photo={<div className="capture-result-photo" role="img" aria-label="Сохранённый снимок блюда">{content ? <img src={activePhoto.src} alt="" /> : <span />}</div>}
                    photoPicker={resultPhotos.length > 1 && <details className="capture-result-photos"><summary>Снимки · {resultPhotos.length}</summary><CapturePhotoStrip photos={resultPhotos} selected={shownResultPhoto?.id} onSelect={setResultPhoto} /></details>} />
                </>}
              </div>
              <footer className={`capture-result-actions${editingResult ? '' : ' capture-result-journal-actions'}`}>{editingResult ? <><button type="button" className="capture-primary" disabled={!correction.dishName.trim() || !draftPhotos.length} onClick={revise}>{dirty ? 'Повторить анализ' : 'Разобрать ещё раз'}</button><button type="button" onClick={() => setEditingResult(false)}>Отменить правки</button></> : <><button type="button" className="capture-result-edit" aria-label="Уточнить результат" onClick={editResult}><CaptureIcon kind="notes" /><span>Уточнить</span></button><button type="button" className="capture-primary" onClick={returnToCamp}>В лагерь</button></>}</footer>
            </>}
          </div>}
          {content && view === 'camera' && photoFlight && <CapturePhotoFlight key={photoFlight.id} photo={photoFlight} />}
          {detailsOpen && <CaptureDetails notes={notes} portion={portion} onNotes={setNotes} onPortion={setPortion} onClose={() => setDetailsOpen(false)} />}
        </div>}
        {error && <p className="capture-error" role="alert">{error}</p>}
      </div>
      {!compact && <aside className="capture-inspector">
        <label>Оформление<select value={theme} onChange={(event) => setTheme(event.target.value)}>{Object.entries(CAPTURE_THEMES).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></label>
        <label>Размер экрана<select value={deviceKey} onChange={(event) => setDeviceKey(event.target.value)}>{Object.entries(SANDBOX_DEVICES).map(([key, item]) => <option key={key} value={key}>{item.label} · {item.width} × {item.height}</option>)}</select></label>
        <label>Ожидание в примере<select value={delay} onChange={(event) => setDelay(Number(event.target.value))}><option value={8000}>Короткое · 8 секунд</option><option value={20000}>Обычное · 20 секунд</option><option value={90000}>Долгое · полторы минуты</option></select></label>
        <div className="capture-demo-actions"><button type="button" onClick={openCamera}>Открыть камеру</button><button type="button" disabled={!pending} onClick={() => commit(completeDueCaptures(jobsRef.current, Infinity))}>Завершить обработку</button><button type="button" onClick={reset}>Сбросить демо</button></div>
        <h2>Проба сценария</h2><ol><li>Снимай подряд: фото собираются в ленте над затвором.</li><li>Нажми миниатюру для просмотра или сразу «Разобрать» — теперь можно уйти.</li><li>Перезагрузи страницу: задача сохранится.</li><li>Открой результат из лагеря и попробуй уточнение.</li></ol>
        <p>Три оформления меняют только вид камеры и ожидания. Кнопки и сценарий одинаковые.</p>
        <p>Камера, снимки и анализ — заглушки. В браузере сохраняются демозадачи и текст. Таймер моделирует задержку; реальных фоновых запросов нет.</p>
        <p>Уточнение обновляет ту же запись и может менять набор фото. Оценка задана примером по первому снимку; реального совместного анализа изображений здесь нет.</p>
      </aside>}
    </div>
  </section>;
}
