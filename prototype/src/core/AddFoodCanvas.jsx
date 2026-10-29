import { useContext, useEffect, useRef, useState } from 'react';
import { SANDBOX_DEVICES } from './sandbox-scene-layout.js';
import { CampSandbox } from './CampSandbox.jsx';
import { createCampSupplyMoment } from './camp-supply-metaphors.js';
import { MealFoodAssessment } from './FoodAssessment.jsx';
import { CAPTURE_THEMES, CAPTURE_OUTCOMES, localDayKey, captureDay, capturePhotos, completeDueCaptures, createCapture, reviseCapture, retryCapture } from './capture-session.js';
import { createDemoSession, sessionWithJobs, WORKBENCH_STORAGE_KEY } from './demo-session.js';
import { effectiveMultiplier } from './demo-rewards.js';
import { dailyCampContributions } from './food-assessment.js';
import { HeroState } from './HeroState.jsx';
import { resolveHeroState } from './hero-state.js';
import { RewardWallet, RewardReceipt } from './RewardWallet.jsx';
import { useDemoSession } from './use-demo-session.js';
import './add-food-canvas.css';
import { StudyContentContext } from './StudyMedia.jsx';
import { PHOTO_SAMPLES, samplePhoto } from './study-content.js';
import { CaptureFinder, CaptureIcon } from './CaptureInstrument.jsx';
import { CaptureDetails, CapturePhotoStrip, Portions } from './CapturePhotoSet.jsx';
import { CaptureProcessing } from './CaptureProcessing.jsx';
import { CaptureConfirmation } from './CaptureConfirmation.jsx';
import { CaptureNotice } from './CaptureNotice.jsx';
import { CapturePhotoFlight } from './CapturePhotoFlight.jsx';
import { moveCapturePhoto } from './capture-motion.js';
import './capture-flow.css';
import './result-journal.css';

export function AddFoodCanvas({ compact = false, initialView, initialJobId, deviceOverride, onCamp, sessionStore, returnLabel = 'В лагерь', dayPhase = 'day', themeOverride, outcomeOverride, cameraAccessOverride, previewSample = 'meal', previewDishName, previewNotes = 'Соус отдельно', previewOtherMeals = [], pausePreview = false }) {
  const content = useContext(StudyContentContext);
  const fixture = ['waiting', 'result', 'offline', 'notFood', 'uncertain'].includes(initialView) && !initialJobId;
  const [initialSession] = useState(() => {
    if (!fixture) return createDemoSession();
    const job = createCapture({ source:'camera', theme:'science', portion:1, notes:previewNotes, delay:20000, outcome:['offline', 'notFood', 'uncertain'].includes(initialView) ? initialView : 'success' });
    job.imageKey = previewSample; job.dishName = previewDishName || samplePhoto(previewSample).name;
    return sessionWithJobs(createDemoSession(), ['result', 'offline', 'notFood', 'uncertain'].includes(initialView) ? completeDueCaptures([job], Infinity) : [job]);
  });
  const { store, session, hero, error } = useDemoSession({
    store: fixture ? undefined : sessionStore,
    storage: !fixture && !sessionStore ? () => window.localStorage : undefined,
    storageKey: WORKBENCH_STORAGE_KEY,
    initialSession,
    paused: fixture && pausePreview && initialView === 'waiting',
  });
  const jobs = session.jobs;
  const heroState = resolveHeroState({ ...hero, phase: dayPhase, now: store.now() });
  const draftEntry = useRef(null);
  const shotLock = useRef(false);
  const workbench = useRef(null);
  const [photoFlight, setPhotoFlight] = useState(null);
  const [view, setView] = useState(initialView ? ['waiting', 'result', 'offline', 'notFood', 'uncertain'].includes(initialView) ? 'analysis' : initialView === 'cameraDenied' ? 'camera' : initialView : jobs.length ? 'camp' : 'camera');
  const [selectedId, setSelectedId] = useState(initialJobId ?? (fixture ? jobs[0]?.id : null));
  const [deviceKey, setDeviceKey] = useState('standard');
  const [theme, setTheme] = useState(jobs.at(-1)?.theme ?? 'science');
  const [delay, setDelay] = useState(20000);
  const [outcome, setOutcome] = useState('success');
  const nextOutcome = outcomeOverride ?? outcome;
  const [cameraAccess, setCameraAccess] = useState(initialView === 'cameraDenied' ? 'denied' : 'allowed');
  const cameraDenied = (cameraAccessOverride ?? cameraAccess) === 'denied';
  const [confirmation, setConfirmation] = useState(null);
  const [confirmationError, setConfirmationError] = useState(null);
  const [portion, setPortion] = useState(1);
  const [notes, setNotes] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [correction, setCorrection] = useState(() => { const job = jobs.find(item => item.id === initialJobId) ?? (fixture ? jobs[0] : null); return { dishName: job?.dishName || job?.result?.name || 'Овощи с гарниром', notes:job?.notes ?? '', portion:job?.portion ?? 1 }; });
  const [gallerySelection, setGallerySelection] = useState([]);
  const [draftPhotos, setDraftPhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [retakeId, setRetakeId] = useState(null);
  const [editingResult, setEditingResult] = useState(false);
  const [photoRevision, setPhotoRevision] = useState(false);
  const [resultPhoto, setResultPhoto] = useState(null);
  const [showPrevious, setShowPrevious] = useState(false);
  const [supplyMoment, setSupplyMoment] = useState(null);
  const currentDevice = deviceOverride ?? deviceKey;
  const device = SANDBOX_DEVICES[currentDevice];
  const active = jobs.find(job => job.id === selectedId);
  const resultPhotos = active?.result ? capturePhotos(active, true) : [];
  const shownResultPhoto = resultPhotos.find(photo => photo.id === resultPhoto) ?? resultPhotos[0];
  const shownDraftPhoto = draftPhotos.find(photo => photo.id === selectedPhoto) ?? draftPhotos[0];
  const showResult = editingResult || active?.status === 'ready' || (showPrevious && !!active?.result);
  const activePhoto = samplePhoto(showResult ? shownResultPhoto?.imageKey : active?.imageKey);
  const day = { ...captureDay(jobs, new Date(store.now())), onMealSelect: (id) => { const job = jobs.find(item => item.id === id); if (job) openAnalysis(job); } };
  const attention = [...jobs].reverse().find(job => job.status === 'processing' || job.status === 'failed' || job.status === 'notFood' || (job.status === 'ready' && !job.seen));
  const reward = session.rewardEvents.find(event => event.entryId === draftEntry.current?.id);
  const walletControl = <RewardWallet coins={session.inventory.coins} multiplier={effectiveMultiplier(session, store.now())} />;
  const pending = jobs.some(job => job.status === 'processing');
  useEffect(() => { if (themeOverride) setTheme(themeOverride); }, [themeOverride]);
  useEffect(() => { if (view !== 'camera') setPhotoFlight(null); }, [view]);
  useEffect(() => {
    if (view === 'analysis') workbench.current?.querySelector('.capture-analysis .capture-top button')?.focus({ preventScroll:true });
  }, [view, selectedId, active?.status, showPrevious, editingResult]);

  const commit = next => store.replaceJobs(next);
  const exitCapture = () => { onCamp ? onCamp() : setView('camp'); };
  const askConfirmation = kind => { setConfirmationError(null); setConfirmation({ kind, id:active?.id, updating:!!active?.result }); };
  const closeConfirmation = () => { setConfirmation(null); setConfirmationError(null); };
  const confirmAction = () => {
    if (confirmation.kind === 'draft') {
      draftEntry.current = null; setDraftPhotos([]); setNotes(''); setPortion(1); setRetakeId(null);
      closeConfirmation(); exitCapture(); return;
    }
    const saved = confirmation.kind === 'delete' ? store.deleteCapture(confirmation.id) : store.cancelCapture(confirmation.id);
    if (!saved) {
      const current = store.getSnapshot();
      setConfirmationError(current.error || 'Запись уже изменилась. Вернись к ней и проверь результат.');
      return;
    }
    closeConfirmation(); setEditingResult(false); setPhotoRevision(false); setDraftPhotos([]); setShowPrevious(false); setResultPhoto(null);
    if (confirmation.kind === 'delete' || !confirmation.updating) exitCapture();
  };

  const openCamera = () => {
    draftEntry.current = null;
    shotLock.current = false; setPortion(1); setNotes(''); setDetailsOpen(false);
    setDraftPhotos([]); setSelectedPhoto(null); setRetakeId(null); setPhotoRevision(false); setEditingResult(false); setView('camera');
  };
  const addPhotos = samples => {
    if (!samples.length) return;
    if (!photoRevision && !draftEntry.current) {
      const entry = store.startEntry();
      if (!entry) return;
      draftEntry.current = entry;
    }
    store.reactToPhoto();
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
    const job = createCapture({ source:draftPhotos[0].source, theme, portion, notes, delay, photos:draftPhotos, outcome:nextOutcome }, store.now());
    if (draftEntry.current) Object.assign(job, { id: draftEntry.current.id, createdAt: draftEntry.current.firstPhotoAt, dayKey: draftEntry.current.dayKey });
    job.dishName = sample.name;
    if (commit([...store.getSnapshot().session.jobs, job])) {
      const source = workbench.current.querySelector(`[data-photo-id="${draftPhotos[0].id}"]`);
      const host = workbench.current.closest('.screen-study') ?? workbench.current;
      moveCapturePhoto(source, () => { draftEntry.current = null; setDraftPhotos([]); setSelectedId(job.id); onCamp ? onCamp() : setView('camp'); }, () => host.querySelector(`[data-capture-id="${job.id}"]`));
    }
    else shotLock.current = false;
  };
  const finishPhotoRevision = () => {
    setCorrection(current => ({...current,notes,portion})); setPhotoRevision(false); setEditingResult(true); setView('analysis');
  };
  const closeCamera = () => {
    if (retakeId) { setRetakeId(null); setView('review'); return; }
    if (photoRevision) { finishPhotoRevision(); return; }
    if (draftPhotos.length) { askConfirmation('draft'); return; }
    exitCapture();
  };
  const editResult = () => {
    const source = active.status === 'ready' ? active.result : { name:active.dishName, notes:active.notes, portion:active.portion };
    setCorrection({ dishName:source.name, notes:source.notes, portion:source.portion });
    setDraftPhotos(capturePhotos(active, active.status === 'ready').map(photo => ({...photo})));
    draftEntry.current = null; setSelectedPhoto(null); setShowPrevious(false); setPhotoRevision(false); setRetakeId(null); setEditingResult(true);
  };
  const editResultPhotos = () => {
    setNotes(correction.notes); setPortion(correction.portion); setPhotoRevision(true); setRetakeId(null); setView(draftPhotos.length ? 'review' : 'camera');
  };
  const openAnalysis = (job) => {
    setSelectedId(job.id);
    setTheme(job.theme);
    setCorrection({ dishName: job.dishName || job.result?.name || 'Овощи с гарниром', notes: job.notes, portion: job.portion });
    draftEntry.current = null; setPhotoRevision(false); setRetakeId(null); setDraftPhotos([]);
    setEditingResult(false); setShowPrevious(false); setResultPhoto(null); setView('analysis');
  };
  const returnToCamp = () => {
    const moment = active?.status === 'ready' && !active.seen && (active.dayKey ?? localDayKey(active.createdAt)) === localDayKey(store.now()) ? createCampSupplyMoment({ ...active.result, id:active.id, imageKey:resultPhotos[0]?.imageKey }) : null;
    if (active?.status === 'ready' && !active.seen && !commit(store.getSnapshot().session.jobs.map(job => job.id === active.id ? { ...job, seen: true } : job))) return;
    setSupplyMoment(moment);
    onCamp ? onCamp({ supplyMoment:moment }) : setView('camp');
  };
  const revise = () => {
    if (!active || !['ready', 'notFood'].includes(active.status)) return;
    if (commit(store.getSnapshot().session.jobs.map(job => job.id === active.id ? reviseCapture(job, {...correction, photos:draftPhotos}, delay, store.now(), nextOutcome) : job))) { setEditingResult(false); setShowPrevious(false); setResultPhoto(null); }
  };
  const retry = () => {
    const current = store.getSnapshot().session.jobs.find(job => job.id === active?.id);
    if (!current || current.status !== 'failed') return;
    if (commit(store.getSnapshot().session.jobs.map(job => job.id === current.id ? retryCapture(job, { outcome:nextOutcome, delay }, store.now()) : job))) {
      setShowPrevious(false); setResultPhoto(null);
    }
  };
  const reset = () => { if (store.reset()) { setSelectedId(null); openCamera(); } };
  const editBaseline = active?.status === 'notFood' ? { name:active.dishName, notes:active.notes, portion:active.portion, photos:capturePhotos(active) } : active?.result;
  const dirty = editBaseline && (correction.dishName.trim() !== editBaseline.name || correction.notes.trim() !== editBaseline.notes || correction.portion !== editBaseline.portion || JSON.stringify(draftPhotos) !== JSON.stringify(editBaseline.photos ?? resultPhotos));

  return <section ref={workbench} className={`capture-workbench${compact ? ' capture-workbench-compact' : ''}`}>
    {!compact && <header className="capture-heading"><h1>Добавить еду · камера и анализ</h1><p>Снимки одной еды, детали по желанию и одна запись. После сохранения можно убрать телефон.</p></header>}
    <div className="capture-layout">
      <div className="capture-preview" style={{ '--capture-width': `${device.width}px` }}>
        {view === 'camp' ? <div className="capture-camp-host"><CampSandbox supplyMoment={supplyMoment} key={currentDevice} presentation={content ? 'art' : 'blocks'} initialPreset="growth" initialDevice={currentDevice} foodLayout="separate" foodPresentation="journal" initialEditing={false} onAddFood={openCamera} journalData={day} dailyContributions={dailyCampContributions(day.meals)} heroState={heroState} dayPhase={dayPhase} walletControl={walletControl} activity={attention && <CaptureNotice job={attention} now={store.now()} onOpen={openAnalysis} />} /></div> : <div className={`capture-phone capture-flow capture-stage-${view} capture-theme-${theme}${view === 'camera' && cameraDenied ? ' capture-camera-denied' : ''}${content ? ' capture-camp-style' : ''}${content && ['camera','review'].includes(view) ? ' capture-instrument' : ''}${currentDevice === 'compact' ? ' capture-small' : ''}`} style={{ aspectRatio: `${device.width} / ${device.height}`, '--capture-safe-top': `${device.safeTop / device.width * 100}cqw`, '--capture-safe-bottom': `${device.safeBottom / device.width * 100}cqw` }} aria-label={view === 'camera' ? 'Экран камеры' : view === 'review' ? 'Просмотр снимков' : view === 'gallery' ? 'Галерея' : 'Обработка и результат'}>
          <div className="capture-camera-world" aria-hidden="true">{view === 'camera' && cameraDenied ? null : content ? <img className="capture-live-photo" src={view === 'review' ? samplePhoto(shownDraftPhoto?.imageKey).src : PHOTO_SAMPLES[0].src} alt="" /> : <div className="capture-dish"><i /><i /><i /></div>}</div>
          <div className="capture-home-indicator" aria-hidden="true" />
          {view === 'camera' && <><div className="capture-reward"><RewardReceipt event={reward} />{walletControl}</div>{draftPhotos.length > 0 && <div className="capture-hero-reaction"><HeroState state={heroState} compact /></div>}</>}
          {view === 'camera' ? <>
            <header className="capture-top"><button type="button" aria-label={retakeId ? 'Отменить пересъёмку' : photoRevision ? 'К уточнению' : draftPhotos.length ? 'Выйти из добавления' : 'Вернуться в лагерь'} onClick={closeCamera}>{content ? <CaptureIcon kind="back" /> : '←'}</button><div className="capture-instrument-title"><h2>{retakeId ? 'Переснять кадр' : 'Добавить еду'}</h2></div><span className="capture-top-spacer" /></header>
            {cameraDenied ? <section className="capture-camera-permission"><h3>Камера недоступна</h3><p>Можно выбрать фото этой еды из галереи или вернуться позже.</p><button type="button" onClick={openGallery}>Выбрать из галереи</button></section> : content ? <CaptureFinder theme={theme} /> : <div className="capture-viewfinder" aria-hidden="true"><span /><span /><span /><span /></div>}
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
                <button type="button" className="capture-shutter" aria-label={retakeId ? 'Снять новый кадр' : 'Сфотографировать еду'} disabled={cameraDenied} onClick={() => addPhotos([{...PHOTO_SAMPLES[0],source:'camera'}])}><span><CaptureIcon kind="camera" /></span></button>
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
          </> : view === 'gallery' ? <div className="capture-gallery-screen"><header className="capture-top"><button aria-label="Назад к камере" onClick={() => setView('camera')}>←</button><div><h2>{retakeId ? 'Замена снимка' : 'Фото этой еды'}</h2><small>{retakeId ? 'Выбери один кадр' : 'Можно выбрать несколько'}</small></div></header><div className="capture-gallery-grid">{PHOTO_SAMPLES.map(({label,src},index) => <button key={label} aria-label={`Выбрать фото: ${label}`} aria-pressed={gallerySelection.includes(index)} onClick={() => setGallerySelection(current => retakeId ? [index] : current.includes(index) ? current.filter(item => item !== index) : [...current,index])}><span className={`capture-gallery-photo capture-gallery-photo-${index}`}>{content && <img src={src} alt="" />}</span><span>{label}</span>{gallerySelection.includes(index) && <strong>✓</strong>}</button>)}</div><footer className="capture-gallery-actions"><button className="capture-primary" disabled={!gallerySelection.length} onClick={() => addPhotos(gallerySelection.map(index => ({...PHOTO_SAMPLES[index],source:'gallery'})))}>Добавить фото{gallerySelection.length ? ` · ${gallerySelection.length}` : ''}</button><p>Фото добавятся в ленту камеры.</p></footer></div> : active && <div className={`capture-analysis${showResult ? ' capture-result-screen' : ' capture-processing-screen'}`}>
            <header className="capture-top"><button type="button" aria-label={editingResult ? active.status === 'notFood' ? "Вернуться к разбору" : "Вернуться к результату" : showPrevious && active.status !== 'ready' ? "Вернуться к разбору" : returnLabel === "В лагерь" ? "Вернуться в лагерь" : "Вернуться к дню"} onClick={() => editingResult ? setEditingResult(false) : showPrevious && active.status !== 'ready' ? setShowPrevious(false) : returnToCamp()}>←</button><h2>{editingResult ? 'Уточнение' : 'Разбор еды'}</h2></header>
            {!showResult ? <CaptureProcessing key={`${active.id}-${active.attempt}-${active.status}`} job={active} theme={theme} onCamp={returnToCamp} onRetry={retry} onEdit={editResult} onPrevious={() => setShowPrevious(true)} onCancel={() => askConfirmation('cancel')} exitLabel={returnLabel} /> : <>
              <div key={editingResult ? "editing" : "summary"} className={`capture-result-content${editingResult ? '' : ' capture-result-journal'}`}>
                {editingResult ? <>
                  <div className="capture-edit-heading"><h3>Уточним запись</h3><p>Добавь то, чего не видно на фото, или поправь ответ.</p></div>
                  <button type="button" className="capture-edit-photos" onClick={editResultPhotos}><span>{content && draftPhotos[0] && <img src={samplePhoto(draftPhotos[0].imageKey).src} alt="" />}</span><div><strong>Снимки · {draftPhotos.length}</strong><small>Добавить, переснять или убрать</small></div><b aria-hidden="true">›</b></button>
                  <label>Название блюда<input value={correction.dishName} maxLength={100} onChange={event => setCorrection({ ...correction, dishName:event.target.value })} /></label>
                  <label>Что уточнить?<textarea value={correction.notes} maxLength={500} onChange={event => setCorrection({ ...correction, notes:event.target.value })} placeholder="Например: это нут, а не картофель. Соус с йогуртом." /></label>
                  <Portions value={correction.portion} onChange={value => setCorrection({ ...correction, portion:value })} />
                  <p className="capture-edit-explanation">{active.result ? "Обновим эту запись. Пока готовится уточнение, в дневнике останется прежний результат." : "Уточним эти же снимки. Новая запись и повторная награда не появятся."}</p>
                </> : <>
                  {active.status !== 'ready' && <p className="capture-edit-explanation">Это прежний результат. {active.status === 'notFood' ? 'Новые снимки не удалось распознать. Прежний вклад сохранён.' : active.status === 'failed' ? 'Правки сохранены и ждут повтора.' : 'Уточнение ещё разбирается.'}</p>}
                  <MealFoodAssessment binaryContributions meal={{ ...active.result, id:active.id, imageKey:resultPhotos[0]?.imageKey }} otherMeals={fixture ? previewOtherMeals : captureDay(jobs, active.dayKey ? new Date(`${active.dayKey}T12:00:00`) : new Date(active.createdAt)).meals.filter(meal => meal.id !== active.id)} pendingEdits={false}
                    photo={<div className="capture-result-photo" role="img" aria-label="Сохранённый снимок блюда">{content ? <img src={activePhoto.src} alt="" /> : <span />}</div>}
                    photoPicker={resultPhotos.length > 1 && <details className="capture-result-photos"><summary>Снимки · {resultPhotos.length}</summary><CapturePhotoStrip photos={resultPhotos} selected={shownResultPhoto?.id} onSelect={setResultPhoto} /></details>} />
                  <button type="button" className="capture-record-action" onClick={() => askConfirmation('delete')}>Удалить запись</button>
                </>}
              </div>
              <footer className={`capture-result-actions${editingResult ? '' : ' capture-result-journal-actions'}`}>{editingResult ? <><button type="button" className="capture-primary" disabled={(!correction.dishName.trim() && active.status !== 'notFood') || !draftPhotos.length} onClick={revise}>{dirty ? 'Повторить анализ' : 'Разобрать ещё раз'}</button><button type="button" onClick={() => setEditingResult(false)}>Отменить правки</button></> : <>{active.status === 'ready' ? <button type="button" className="capture-result-edit" aria-label="Уточнить результат" onClick={editResult}><CaptureIcon kind="notes" /><span>Уточнить</span></button> : <button type="button" className="capture-result-edit" onClick={() => setShowPrevious(false)}>К разбору</button>}<button type="button" className="capture-primary" onClick={returnToCamp}>{returnLabel}</button></>}</footer>
            </>}
          </div>}
          {content && view === 'camera' && photoFlight && <CapturePhotoFlight key={photoFlight.id} photo={photoFlight} />}
          {confirmation && <CaptureConfirmation
            title={confirmation.kind === 'draft' ? 'Уйти без разбора?' : confirmation.kind === 'delete' ? 'Удалить запись?' : confirmation.updating ? 'Отменить уточнение?' : 'Отменить разбор?'}
            action={confirmation.kind === 'draft' ? 'Уйти без разбора' : confirmation.kind === 'delete' ? 'Удалить запись' : confirmation.updating ? 'Отменить уточнение' : 'Отменить разбор'}
            cancelLabel={confirmation.kind === 'draft' ? 'Остаться' : 'Оставить запись'} error={confirmationError} onConfirm={confirmAction} onClose={closeConfirmation}>
            {confirmation.kind === 'draft' ? 'Эти снимки и детали не сохранятся. Монеты и засчитанный день останутся.' : confirmation.kind === 'delete' ? 'Запись и её вклад исчезнут из дневника и запасов лагеря. Монеты, вещи и пройденный путь останутся.' : confirmation.updating ? 'Останется прежний результат с его снимками и вкладом. Отправленные правки будут отменены.' : 'Снимки этой записи больше не будут разбираться. Монеты и засчитанный день останутся.'}
          </CaptureConfirmation>}
          {detailsOpen && <CaptureDetails notes={notes} portion={portion} onNotes={setNotes} onPortion={setPortion} onClose={() => setDetailsOpen(false)} />}
        </div>}
        {error && <p className="capture-error" role="alert">{error}</p>}
      </div>
      {!compact && <aside className="capture-inspector">
        <label>Оформление<select value={theme} onChange={(event) => setTheme(event.target.value)}>{Object.entries(CAPTURE_THEMES).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></label>
        <label>Размер экрана<select value={deviceKey} onChange={(event) => setDeviceKey(event.target.value)}>{Object.entries(SANDBOX_DEVICES).map(([key, item]) => <option key={key} value={key}>{item.label} · {item.width} × {item.height}</option>)}</select></label>
        <label>Ответ анализа<select aria-label="Ответ анализа" value={outcome} onChange={event => setOutcome(event.target.value)}>{Object.entries(CAPTURE_OUTCOMES).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>Доступ к камере<select aria-label="Доступ к камере" value={cameraAccess} onChange={event => setCameraAccess(event.target.value)}><option value="allowed">Разрешён</option><option value="denied">Нет доступа</option></select></label>
        <label>Ожидание в примере<select value={delay} onChange={(event) => setDelay(Number(event.target.value))}><option value={8000}>Короткое · 8 секунд</option><option value={20000}>Обычное · 20 секунд</option><option value={90000}>Долгое · полторы минуты</option></select></label>
        <div className="capture-demo-actions"><button type="button" onClick={openCamera}>Открыть камеру</button><button type="button" disabled={!pending} onClick={() => store.completeAnalysis()}>Завершить обработку</button><button type="button" onClick={reset}>Сбросить демо</button></div>
        <h2>Проба сценария</h2><ol><li>Снимай подряд: фото собираются в ленте над затвором.</li><li>Нажми миниатюру для просмотра или сразу «Разобрать» — теперь можно уйти.</li><li>Перезагрузи страницу: задача сохранится.</li><li>Открой результат из лагеря и попробуй уточнение.</li></ol>
        <p>Три оформления меняют только вид камеры и ожидания. Кнопки и сценарий одинаковые.</p>
        <p>Камера, снимки и анализ — заглушки. В браузере сохраняются демозадачи и текст. Таймер моделирует задержку; реальных фоновых запросов нет.</p>
        <p>Уточнение обновляет ту же запись и может менять набор фото. Оценка задана примером по первому снимку; реального совместного анализа изображений здесь нет.</p>
      </aside>}
    </div>
  </section>;
}
