import { VariantMotionPicker, VARIANT_DEFAULTS } from './VariantMotion.jsx';
import { useEffect, useRef, useState } from 'react';
import { OnboardingExample } from './OnboardingExample.jsx';
import { OnboardingIntro } from './OnboardingIntro.jsx';
import { CampSandbox } from './CampSandbox.jsx';
import { Backpack } from './Backpack.jsx';
import { HeroMirror, DEFAULT_HERO_APPEARANCE } from './HeroMirror.jsx';
import { HeroAppearance } from './Headwear.jsx';
import { ExplorationControls, ExplorationView } from './ExplorationStudy.jsx';
import { GardenAppearance } from './GardenAppearance.jsx';
import { DEMO_GARDEN_ITEMS, gardenAppearance } from './demo-inventory.js';
import { AddFoodCanvas } from './AddFoodCanvas.jsx';
import { CaptureNotice } from './CaptureNotice.jsx';
import { ForestPath } from './ForestPath.jsx';
import { JourneyDay } from './JourneyDay.jsx';
import { sessionJourneyHistory } from './journey-history.js';
import { journeyExampleSession } from './journey-fixtures.js';
import { DAY_PHASES, JOURNEY_BIOMES, JOURNEY_STOPS, journeyBiome, resolveDayPhase } from './journey-world.js';
import { SANDBOX_DEVICES } from './sandbox-scene-layout.js';
import { STUDY_ITEMS, STUDY_SCREENS, STATUS_COPY } from './screen-study-data.js';
import { captureDay, createCapture, completeDueCaptures, prepareCaptureReply } from './capture-session.js';
import { createDemoSession, sessionWithJobs, sessionJourneyStep } from './demo-session.js';
import { effectiveMultiplier } from './demo-rewards.js';
import { RewardWallet } from './RewardWallet.jsx';
import { useDemoSession } from './use-demo-session.js';
import { StudyContentContext, StudyMedia } from './StudyMedia.jsx';
import { resolveHeroState } from './hero-state.js';
import { NUTRITION_DAY_EXAMPLES, nutritionExampleMeals, dailyCampContributions } from './food-assessment.js';
import { CAPTURE_THEMES, CAPTURE_OUTCOMES } from './capture-session.js';
import { CAMP_GROWTH_STAGES } from './camp-growth.js';
import { CAMP_SUPPLY_METAPHORS } from './camp-supply-metaphors.js';
import { ReviewScreenPicker } from './ReviewScreenPicker.jsx';
import './screen-study.css';
import './screen-study-content.css';
import './camp-ui.css';

function MiniCamp({ selected, applied, heroOnly = false }) {
  const item = selected ?? STUDY_ITEMS.find(entry => entry.id === applied.decor);
  return <div className={`study-mini-camp${heroOnly ? ' study-mini-hero' : ''}`}>
    <div className="study-mini-ground" />
    {!heroOnly && <StudyMedia kind="tent" label="Палатка" />}
    <StudyMedia kind="hero" label="Герой" />
    {!heroOnly && <StudyMedia kind="fire" label="Костёр" />}
    {item && item.id !== 'tent' && <StudyMedia kind={item.id} label={item.name} className="study-preview-item" />}
  </div>;
}

function StudyDialog({ title, children, onClose }) {
  const ref = useRef(null);
  useEffect(() => { const el = ref.current; el.showModal(); return () => el.close(); }, []);
  return <dialog ref={ref} className="study-dialog" aria-labelledby="study-dialog-title" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}><h2 id="study-dialog-title">{title}</h2>{children}</dialog>;
}

function Path({ state, onCamp, onAdd }) {
  const initial = state === 'first';
  const stops = initial ? [{ label: 'Сегодня', x: 53, y: 70, state: 'today' }] : [
    { label: 'Понедельник', x: 28, y: 18, state: 'lit' },
    { label: 'Вторник', x: 70, y: 34, state: 'lit' },
    { label: 'Среда', x: 33, y: 53, state: state === 'return' ? 'quiet' : 'lit' },
    { label: 'Сегодня', x: 60, y: 77, state: 'today' },
  ];
  const [selected, setSelected] = useState(stops.at(-1));
  return <>
    <header className="study-top"><button onClick={onCamp} aria-label="В лагерь">←</button><h1>Твой путь</h1></header>
    <div className="study-path-heading"><h2>{initial ? 'Начинается с одной встречи' : state === 'return' ? 'Рад снова тебя видеть' : 'Маленькие встречи остаются'}</h2><p>{initial ? 'Здесь появятся дни, когда ты заглядывал.' : 'Каждый костёр — часть вашей истории.'}</p></div>
    <div className={`study-trail-map${initial ? ' study-trail-first' : ''}`}>
      <svg viewBox="0 0 300 400" preserveAspectRatio="none" aria-hidden="true"><path d={initial ? 'M159 280 C 210 210,70 180,160 80' : 'M84 72 C20 120,240 75,210 136 S25 170,99 212 S270 260,180 308 L150 390'} /></svg>
      {stops.map(stop => <button key={stop.label} className={`study-trail-stop study-stop-${stop.state}`} style={{ left:`${stop.x}%`, top:`${stop.y}%` }} aria-pressed={selected.label === stop.label} onClick={() => setSelected(stop)}><StudyMedia kind={stop.state === 'quiet' ? 'embers' : initial ? 'camp-stones' : 'fire'} label={stop.state === 'quiet' ? 'Тихий день' : stop.label === 'Сегодня' ? 'Сегодня' : 'Костёр'} /><span>{stop.label}</span>{stop.state === 'today' && <i>Ты здесь</i>}</button>)}
    </div>
    <footer className="study-path-detail"><h3>{selected.label}</h3><p>{initial ? 'Первый снимок станет первой записью.' : selected.state === 'quiet' ? 'День без записи. Прошлые встречи на месте.' : 'Заглянул, записал еду, побыл у костра.'}</p><button className="study-primary" onClick={initial ? onAdd : onCamp}>{initial ? 'Добавить еду' : 'В лагерь'}</button></footer>
  </>;
}

function ReminderStudy({ onNavigate, name, onFinish }) {
  const [permission, setPermission] = useState(false);
  const [reminderTime, setReminderTime] = useState('18:00');
  return <>
    <header className="study-top study-intro-top"><button aria-label="Назад" onClick={() => onNavigate('name')}>←</button><span>chewy</span><button className="study-text-button" onClick={onFinish}>Позже</button></header>
    <div className="study-intro-scene"><MiniCamp applied={{}} /></div>
    <div className="study-intro-copy"><h1>Иногда заглядывай</h1><p>Хочешь, напомним о лагере? Время можно выбрать, а напоминания — отключить.</p><div className="study-notification"><strong>chewy</strong><span>{name.trim() || 'Твой друг'} ждёт у костра. Заглянешь?</span></div></div>
    <footer className="study-intro-actions"><label className="study-reminder-time">Напоминать в<input type="time" value={reminderTime} onChange={event => setReminderTime(event.target.value)} /></label><button className="study-primary" onClick={() => setPermission(true)}>Настроить напоминания</button><button onClick={onFinish}>Пока без напоминаний</button></footer>
    {permission && <StudyDialog title="Напоминать о лагере?" onClose={() => setPermission(false)}><p>Пример системного разрешения. В прототипе уведомления не включаются.</p><button className="study-primary" onClick={onFinish}>Разрешить в примере</button><button onClick={onFinish}>Не сейчас</button></StudyDialog>}
  </>;
}

function Status({ screen, onNavigate }) {
  const copy = STATUS_COPY[screen];
  return <><header className="study-top"><button onClick={() => onNavigate('camp')} aria-label="В лагерь">←</button><h1>{screen === 'cameraDenied' ? 'Добавить еду' : 'Снимок'}</h1></header><div className="study-status-content"><StudyMedia kind={copy.media} label={copy.media === 'camera' ? 'Камера' : 'Сохранённый снимок'} /><h2>{copy.title}</h2><p>{copy.text}</p></div><footer className="study-status-actions"><button className="study-primary" onClick={() => onNavigate(copy.next)}>{copy.action}</button><button onClick={() => onNavigate('camp')}>В лагерь</button></footer></>;
}

export function ScreenStudy({ initialScreen = 'backpack', initialPath = 'week', initialCoins = 12, initialInventory, initialEmpty = false, presentation = 'canvas', initialTheme = 'science', reviewMode = 'states' }) {
  const content = presentation === 'content';
  const persistent = reviewMode === 'prototype';
  const [motionVariants, setMotionVariants] = useState(() => persistent ? { ...VARIANT_DEFAULTS } : {});
  const onboarding = reviewMode === 'onboarding';
  const deviceHost = useRef(null);
  const focusCamp = useRef(false);
  const focusMirror = useRef(false);
  const [mirrorAppearance, setMirrorAppearance] = useState(DEFAULT_HERO_APPEARANCE);
  const [seed] = useState(() => !persistent && ['offline','notFood','uncertain'].includes(initialScreen) ? sessionWithJobs(createDemoSession(), completeDueCaptures([createCapture({ source:'camera', theme:initialTheme, portion:1, notes:'Соус отдельно', delay:20000, outcome:initialScreen })], Infinity)) : !persistent && initialScreen === 'path' ? journeyExampleSession(initialPath) : ({ ...createDemoSession(), inventory: persistent ? { coins: 0, owned: [], applied: {} } : initialInventory ?? { coins: initialCoins, owned: [], applied: {} } }));
  const { store, session, hero, dayKey: sessionDay, error: sessionError } = useDemoSession({
    storage: persistent ? () => window.localStorage : undefined,
    migrateLegacy: persistent,
    initialSession: seed,
  });
  const { jobs, inventory, exploration } = session;
  const [activitySource, setActivitySource] = useState('sample');
  const [backpackSection, setBackpackSection] = useState('owned');
  const [findingId, setFindingId] = useState(null);
  const unseenFindings = exploration.found.filter(id => !exploration.seenFindings.includes(id));
  const multiplier = effectiveMultiplier(session, store.now());
  const [backpackRevision, setBackpackRevision] = useState(0);
  const setInventory = next => { const saved = store.setInventory({ ...next, owned: [...new Set([...next.owned, ...exploration.found])], applied: { ...next.applied, ...(inventory.applied.headwear ? { headwear: inventory.applied.headwear } : {}) } }); if (saved) setBackpackRevision(value => value + 1); return saved; };
  const [resetConfirm, setResetConfirm] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(!persistent && !onboarding);
  const reviewTitle = reviewMode === 'prototype' ? 'Прототип Chewy' : onboarding ? 'Онбординг · черновик' : reviewMode === 'deferred' ? 'Знакомство · отложено' : content ? 'Состояния приложения' : 'Мастерская · канвас';
  const [screen, setScreen] = useState(initialScreen);
  useEffect(() => {
    if (screen === 'camp' && focusMirror.current) {
      deviceHost.current?.querySelector('[data-camp-control="mirror"]')?.focus({ preventScroll: true });
      focusMirror.current = false;
      return;
    }
    if (screen === 'camp' && focusCamp.current) {
      deviceHost.current?.querySelector('button[aria-label="Добавить еду"]')?.focus({ preventScroll: true });
      focusCamp.current = false;
    }
  }, [screen]);
  const [historyDayKey, setHistoryDayKey] = useState(null);
  const [pathSelection, setPathSelection] = useState(null);
  const [pathDayKey, setPathDayKey] = useState(null);
  const [deviceKey, setDeviceKey] = useState('standard');
  const [previewPathState, setPathState] = useState(initialPath);
  const [previewJourneyStep, setJourneyStep] = useState(initialScreen === 'path' ? sessionJourneyStep(seed) : initialPath === 'first' ? 0 : 2);
  const [dayMode, setDayMode] = useState('auto');
  const [previewTime, setPreviewTime] = useState(() => new Date(store.now()));
  const lastEarnedStep = useRef(sessionJourneyStep(seed));
  useEffect(() => {
    const earned = sessionJourneyStep(session);
    if (earned !== lastEarnedStep.current && !persistent) {
      setJourneyStep(earned);
      setPathState(earned ? 'week' : 'first');
    }
    lastEarnedStep.current = earned;
  }, [session.creditedDays.length, persistent]);
  const journeyStep = persistent ? sessionJourneyStep(session) : previewJourneyStep;
  const pathState = persistent ? journeyStep ? 'week' : 'first' : previewPathState;
  const biome = journeyBiome(journeyStep);
  const phase = resolveDayPhase(dayMode, previewTime);
  const heroState = resolveHeroState({ ...hero, phase, now: store.now() });
  useEffect(() => {
    if (dayMode !== 'auto') return;
    setPreviewTime(new Date(store.now()));
    const timer = window.setInterval(() => setPreviewTime(new Date(store.now())), 60000);
    return () => clearInterval(timer);
  }, [dayMode, store, sessionDay]);
  const [name, setName] = useState('');
  const [empty, setEmpty] = useState(initialEmpty);
  const [campStage, setCampStage] = useState(persistent || initialEmpty ? 'initial' : 'developed');
  const [showZoneLabels, setShowZoneLabels] = useState(true);
  const [jobId, setJobId] = useState(['offline','notFood','uncertain'].includes(initialScreen) ? seed.jobs[0]?.id ?? null : null);
  const [sampleKey, setSampleKey] = useState('meal');
  const [sampleMeal, setSampleMeal] = useState(null);
  const [supplyMoment, setSupplyMoment] = useState(null);
  const [dayExample, setDayExample] = useState(initialScreen === 'journal' ? 'mixed' : 'auto');
  const [themeKey, setThemeKey] = useState(initialTheme);
  const [analysisOutcome, setAnalysisOutcome] = useState('success');
  const [cameraAccess, setCameraAccess] = useState(initialScreen === 'cameraDenied' ? 'denied' : 'allowed');
  const [savedReply, setSavedReply] = useState(null);
  const device = SANDBOX_DEVICES[deviceKey];
  useEffect(() => { setThemeKey(inventory.applied.theme === 'theme_magic' ? 'alchemy' : inventory.applied.theme === undefined ? initialTheme : 'science'); }, [inventory.applied.theme, initialTheme]);
  const navigate = next => { if (next === 'cameraDenied') setCameraAccess('denied'); if (next === 'backpack') { setBackpackSection('owned'); setFindingId(null); } setHistoryDayKey(null); if (next === 'path') { setPathSelection(null); setPathDayKey(null); } setSupplyMoment(null); setJobId(null); setScreen(next); if (['camera','gallery'].includes(next)) setDayExample('auto'); };
  const closeMirror = () => { focusMirror.current = true; navigate('camp'); };
  const openExploration = () => { setHistoryDayKey(null); setScreen('exploration'); };
  const openFindings = id => {
    const selected = typeof id === 'string' ? id : unseenFindings.at(-1) ?? exploration.found.at(-1) ?? null;
    store.markExplorationSeen();
    navigate('backpack'); setBackpackSection('findings'); setFindingId(selected);
    setBackpackRevision(value => value + 1);
  };
  const onCamp = payload => { focusCamp.current = true; navigate('camp'); setSupplyMoment(payload?.supplyMoment ?? null); };
  const finishIntro = () => { focusCamp.current = true; onCamp(); };
  const captureScreens = ['camera','cameraDenied','gallery','waiting','result','offline','notFood','uncertain'];
  const openJob = id => { setHistoryDayKey(null); setJobId(id); setScreen('result'); };
  const historyDays = sessionJourneyHistory(session);
  const historyDay = historyDays.find(day => day.dayKey === historyDayKey);
  const openHistoryDay = key => { const selected = historyDays.find(day => day.dayKey === key); if (selected) { setPathSelection(selected.stopIndex); setPathDayKey(key); setHistoryDayKey(key); } };
  const openHistoryMeal = id => { setJobId(id); setScreen('result'); };
  const returnToHistory = () => { setJobId(null); setScreen('path'); };
  const demoMeals = nutritionExampleMeals(dayExample);
  const demoDay = { meals:demoMeals, onMealSelect:id => { const meal = demoMeals.find(item => item.id === id); setSampleKey(meal.imageKey); setSampleMeal(meal); setJobId(null); setScreen('result'); } };
  const day = persistent ? { ...captureDay(jobs, new Date(store.now())), onMealSelect: openJob } : dayExample !== 'auto' ? demoDay : empty && !jobs.length ? { meals: [] } : jobs.length ? { ...captureDay(jobs, new Date(store.now())), onMealSelect: openJob } : content ? demoDay : undefined;
  const attention = (persistent || !empty || jobs.length > 0) && ([...jobs].reverse().find(job => job.status === 'processing' || job.status === 'failed' || job.status === 'notFood' || (job.status === 'ready' && !job.seen)));
  return <StudyContentContext.Provider value={content}><section className={`screen-study${content ? ' screen-study-content' : ''}`}>
    <header className="study-workbench-heading"><h1>{reviewTitle}</h1><p>{screen === 'mirror' ? 'Черновик редактора: выбор запоминается до перезагрузки. Изображение героя пока не меняется; найденные вещи и основной прогресс сохраняются отдельно.' : reviewMode === 'prototype' ? 'Начни с лагеря и пройди сценарий внутри телефона.' : onboarding ? 'Готовое фото → разбор → отклик примерного лагеря → свой Чуви. Черновик для ревью; имя и прогресс живут до перезагрузки. Напоминания — отдельная проба.' : reviewMode === 'deferred' ? 'Пробы для отдельного этапа; не входят в приёмку основного прототипа.' : 'Прямой вход для ревью. Камера, анализ и прогресс демонстрационные.'}</p>{(persistent || onboarding) && <button type="button" className="study-inspector-toggle" aria-expanded={inspectorOpen} aria-controls="study-inspector" onClick={() => setInspectorOpen(open => !open)}>{inspectorOpen ? 'Скрыть инструменты пробы' : 'Инструменты пробы'}</button>}</header>
    {sessionError && <p className="capture-error" role="alert">{sessionError}</p>}
    {resetConfirm && <StudyDialog title="Сбросить демосессию?" onClose={() => setResetConfirm(false)}><p>Записи, награды, монеты, вещи, путь и исследования этой демосессии будут очищены. Настройки мастерской останутся.</p><button className="study-primary" onClick={() => {
      if (store.reset()) { setMirrorAppearance(DEFAULT_HERO_APPEARANCE); setHistoryDayKey(null); setPathSelection(null); setPathDayKey(null); setJobId(null); setSampleMeal(null); setSupplyMoment(null); setDayExample('auto'); setEmpty(true); setCampStage('initial'); setJourneyStep(0); setPathState('first'); setScreen(onboarding ? 'welcome' : 'camp'); if (onboarding) setName(''); setResetConfirm(false); }
    }}>Сбросить и начать заново</button><button onClick={() => setResetConfirm(false)}>Отмена</button></StudyDialog>}
    <div className="study-workbench-layout"><div ref={deviceHost} className={`study-device-host study-device-${deviceKey}`} style={{ '--study-width': `${device.width}px` }}>
      {['camp','journal'].includes(screen) ? <div className="study-camp-host"><CampSandbox withMirror motionVariants={motionVariants} supplyMoment={screen === 'camp' ? supplyMoment : null} key={`${deviceKey}-${screen}`} presentation={content ? 'art' : 'blocks'} initialPreset="growth" campStage={campStage} animatedLantern={inventory.applied.decor === 'lantern'} showZoneLabels={showZoneLabels} initialDevice={deviceKey} foodLayout="separate" foodPresentation="journal" initialEditing={false} initialJournalOpen={screen === 'journal'} worldBackground={content ? biome.background : undefined} worldLabel={content ? `${biome.name} · ${DAY_PHASES[phase]}` : undefined} dayPhase={phase} onAddFood={() => navigate('camera')} onNavigate={navigate} journalData={day} dailyContributions={day?.meals ? dailyCampContributions(day.meals) : undefined} heroState={heroState} heroName={onboarding ? name.trim() || 'Чуви' : undefined} walletControl={<RewardWallet coins={inventory.coins} multiplier={multiplier} />} activity={attention && <CaptureNotice job={attention} now={store.now()} onOpen={job => openJob(job.id)} />} sceneOverlay={unseenFindings.length > 0 && <button type="button" className="exploration-camp-notice" style={{ top: `${(device.safeTop + 136) / device.height * 100}%` }} onClick={() => openFindings()}>Чуви нашёл новую шляпу<span>Посмотреть находки</span></button>} objectReplacements={{ hero: inventory.applied.headwear && <HeroAppearance headwearId={inventory.applied.headwear} />, pet: inventory.applied.pet && <StudyMedia kind={inventory.applied.pet} label={STUDY_ITEMS.find(item => item.id === inventory.applied.pet)?.name} />, garden: <GardenAppearance appearance={gardenAppearance(inventory)} /> }} /></div> : captureScreens.includes(screen) ? <AddFoodCanvas key={`${screen}-${jobId}`} compact initialView={screen} initialJobId={jobId} pausePreview={screen === 'waiting'} deviceOverride={deviceKey} themeOverride={themeKey} outcomeOverride={analysisOutcome} cameraAccessOverride={cameraAccess} previewSample={sampleKey} previewDishName={sampleMeal?.name} previewNotes={sampleMeal?.notes} previewOtherMeals={sampleMeal ? demoMeals.filter(meal => meal.id !== sampleMeal.id) : []} onCamp={historyDay ? returnToHistory : onCamp} returnLabel={historyDay ? "К дню" : "В лагерь"} sessionStore={store} dayPhase={phase} /> : <div className={`study-phone study-screen-${screen}${screen === 'exploration' ? ' exploration-phone' : ''}`} style={{ aspectRatio: `${device.width}/${device.height}`, '--onboarding-ratio': device.height / device.width, '--study-safe-top': `${device.safeTop}px`, '--study-safe-bottom': `${device.safeBottom}px` }}>
        {screen === 'mirror' ? <HeroMirror value={mirrorAppearance} headwearId={inventory.applied.headwear} onCancel={closeMirror} onApply={value => { setMirrorAppearance(value); closeMirror(); }} /> : screen === 'exploration' ? <ExplorationView state={exploration} headwearId={inventory.applied.headwear} source={activitySource} currentStopIndex={sessionJourneyStep(session)} onSelectRoute={id => store.selectExplorationRoute(id)} onFindings={openFindings} onBack={() => setScreen('path')} /> : screen === 'backpack' ? <Backpack key={backpackRevision} inventory={inventory} multiplier={multiplier} store={store} onCamp={onCamp} onExplore={openExploration} initialSection={backpackSection} initialFindingId={findingId} /> : screen === 'path' ? historyDay ? <JourneyDay day={historyDay} days={historyDays} todayKey={sessionDay} onSelectDay={openHistoryDay} onMealSelect={openHistoryMeal} onBack={() => setHistoryDayKey(null)} /> : content ? <ForestPath key={pathState} state={pathState} progress={journeyStep} phase={phase} onCamp={onCamp} onAdd={() => navigate('camera')} historyDays={historyDays} todayKey={sessionDay} selectedStop={pathSelection} initialDayKey={pathDayKey} onSelectStop={setPathSelection} onOpenDay={openHistoryDay} onExplore={openExploration} headwearId={inventory.applied.headwear} /> : <Path key={pathState} state={pathState} onCamp={onCamp} onAdd={() => navigate('camera')} /> : screen === 'welcome' ? <OnboardingExample onContinue={() => navigate('name')} onSkip={finishIntro} /> : screen === 'name' ? <OnboardingIntro step={screen} onNavigate={navigate} name={name} setName={setName} onFinish={finishIntro} /> : screen === 'reminders' ? <ReminderStudy onNavigate={navigate} name={name} onFinish={finishIntro} /> : <Status screen={screen} onNavigate={navigate} />}
        <div className="study-home-indicator" aria-hidden="true" />
      </div>}
    </div><aside id="study-inspector" className="study-inspector" hidden={!inspectorOpen}><ReviewScreenPicker screen={screen} onNavigate={navigate} includeDeferred={onboarding || reviewMode === 'deferred'} /><label>Размер телефона<select value={deviceKey} onChange={event => setDeviceKey(event.target.value)}>{Object.entries(SANDBOX_DEVICES).map(([id,data]) => <option key={id} value={id}>{data.label}</option>)}</select></label>
      {content && <VariantMotionPicker value={motionVariants} onChange={setMotionVariants} />}
      {onboarding && <section className="onboarding-review-summary"><h2>Первый запуск · черновик</h2><p>Имя в пробе: <strong>{name.trim() || 'Чуви'}</strong>. Никаких начислений за знакомство; первое фото использует обычные правила.</p><p>Напоминания исключены из прохода. Их прежний макет доступен через селектор; разрешения и время не сохраняются и ничего не включают.</p><button type="button" onClick={() => setResetConfirm(true)}>Начать знакомство заново</button></section>}
      {['camera','gallery','waiting','result'].includes(screen) && <label>Тема анализа<select value={themeKey} onChange={event => setThemeKey(event.target.value)}>{Object.entries(CAPTURE_THEMES).map(([key,theme]) => <option key={key} value={key}>{theme.label}</option>)}</select></label>}<h2>Композиция и UX</h2><p>{STUDY_SCREENS[screen].principle}</p>
      {screen === 'waiting' && <><button type="button" onClick={() => navigate('result')}>Показать результат</button><p>Обработка зафиксирована для примерки. В сценарии из камеры завершится сама.</p></>}
      {!persistent && screen === 'backpack' && <><h2>Состояния покупки</h2><div className="study-inspector-actions"><button onClick={() => setInventory({ coins:12, owned:['flowers'], applied:{ garden:'flowers' } })}>Есть купленное</button><button onClick={() => setInventory({ coins:0, owned:[], applied:{} })}>Пустой рюкзак</button><button onClick={() => setInventory({ coins:80, owned:DEMO_GARDEN_ITEMS.filter(item => item.id !== 'garden-base').map(item => item.id), applied:{} })}>Все вещи куплены</button></div><p>Изолированные примеры одного компонента. Цены демонстрационные; покупка, примерка и применение используют те же правила, что в основном прототипе.</p></>}
      {!persistent && screen === 'path' && <label>История в примере<select value={pathState} onChange={event => { const value = event.target.value; const example = journeyExampleSession(value, store.now()); if (store.update(() => example)) { lastEarnedStep.current = sessionJourneyStep(example); setPathState(value); setJourneyStep(sessionJourneyStep(example)); setHistoryDayKey(null); setPathSelection(null); setPathDayKey(null); } }}><option value="first">Первая встреча</option><option value="week">Несколько встреч</option><option value="return">Возвращение после пропуска</option></select></label>}
      {['camp','journal'].includes(screen) && <><h2>Раскладка лагеря</h2><label>Стадия лагеря<select value={campStage} onChange={event => setCampStage(event.target.value)}>{Object.entries(CAMP_GROWTH_STAGES).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="study-zone-label-toggle"><input type="checkbox" checked={showZoneLabels} onChange={event => setShowZoneLabels(event.target.checked)} />Подписи зон</label><p>Четыре зоны сохраняют места, герой остаётся в центре. Стадия выбирает иллюстрацию для примерки. Серый компонент пока без подтверждённого вклада, цветной — вклад за текущий день есть; это не выполнение нормы.</p></>}
      {content && ['camp','journal','path'].includes(screen) && <><h2>Мир лагеря · проба</h2>{!persistent && <><label>Продвижение по пути<select value={journeyStep} onChange={event => { setJourneyStep(Number(event.target.value)); setPathState('week'); }}>{JOURNEY_STOPS.map((stop,index) => <option key={stop.name} value={index}>{JOURNEY_BIOMES[stop.biome].name}: {stop.name}</option>)}</select></label><button type="button" className="journey-demo-next" disabled={journeyStep === JOURNEY_STOPS.length-1} onClick={() => {setJourneyStep(current => Math.min(current+1,JOURNEY_STOPS.length-1));setPathState('week');}}>Следующая стоянка · демо</button></>}<label>Время суток<select value={dayMode} onChange={event => setDayMode(event.target.value)}><option value="auto">По часам · Europe/London</option>{Object.entries(DAY_PHASES).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label><p>Стоянка меняет окружение лагеря. Просмотр дороги не перемещает героя. В основном проходе путь растёт за дни с фото; ручное продвижение оставлено в отдельных историях. Интервалы стоянок демонстрационные.</p></>}
      {['camp','journal','result'].includes(screen) && <><h2>Оценка питания · проба</h2>{!persistent && screen !== 'result' && <label>День в примере<select value={dayExample} onChange={event => setDayExample(event.target.value)}>{Object.entries(NUTRITION_DAY_EXAMPLES).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>}<p>ВОЗ + Гарвардская тарелка. Оценки заданы для примерки, это не работающий анализ. Четыре запаса заполняются от блюд; веса и пределы демонстрационные, не суточные нормы. Пример «масло уточнено» показывает вклад жиров. Открой блюдо, чтобы увидеть добавленный участок. Состав не меняет монеты: награда уже получена за фото. Состав не ухудшает состояние героя. Оценка сохраняется вместе с результатом.</p></>}
      {screen === 'camp' && <><h2>Отклик запасов · демо</h2><div className="study-inspector-actions">{Object.entries(CAMP_SUPPLY_METAPHORS).map(([metric,{ label }]) => <button key={metric} onClick={() => setSupplyMoment({ metric, createdAt:Date.now() })}>{label}</button>)}</div><p>Короткий отклик зоны после результата. Предметы и рост лагеря не начисляются.</p></>}
      {!persistent && screen === 'camp' && <button onClick={() => { store.replaceJobs([]); setEmpty(!empty); }}>{empty ? 'Показать день с едой' : 'Показать пустой день'}</button>}
      <ExplorationControls state={exploration} dayKey={sessionDay} source={activitySource} onSource={setActivitySource} onActivity={sample => store.observeActivity(sample)} />
      <h2>Находки</h2><p>Два черновых головных убора. Окрестности открываются с текущей стоянки карты; найденное хранится в рюкзаке. Примерка обратима, надетый убор сохраняется. Реальный Health и финальный арт ещё не подключены.</p>
      <h2>Оформления</h2><p>Проверяем один компонент — сад. Виды и цены демонстрационные; финальный каталог выбираем на этапе контента. Подготовленный купленный вариант доступен в отдельной истории рюкзака.</p><h2>Разрешения</h2><label>Доступ к камере<select aria-label="Доступ к камере" value={cameraAccess} onChange={event => setCameraAccess(event.target.value)}><option value="allowed">Разрешён</option><option value="denied">Нет доступа</option></select></label><p>Отказ моделируется внутри добавления еды; галерея остаётся доступной.</p><h2>Мок анализа</h2><label>Ответ анализа<select aria-label="Ответ анализа" value={analysisOutcome} onChange={event => setAnalysisOutcome(event.target.value)}>{Object.entries(CAPTURE_OUTCOMES).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label><p>Исход задаётся при отправке и сохраняется с задачей. Выбор применяется к следующему разбору или повтору. При сбое снимки и правки остаются; для успешного повтора выбери «Готовый результат».</p><button type="button" disabled={!jobs.some(job => job.status === 'processing')} onClick={() => store.completeAnalysis()}>Завершить анализ</button><div className="study-inspector-actions"><button type="button" disabled={!jobs.some(job => job.status === 'processing')} onClick={() => setSavedReply(prepareCaptureReply(jobs.find(job => job.id === jobId && job.status === 'processing') ?? [...jobs].reverse().find(job => job.status === 'processing')))}>Запомнить ответ попытки</button><button type="button" disabled={!savedReply} onClick={() => store.deliverCaptureReply(savedReply)}>Доставить сохранённый ответ</button></div><p>Для проверки позднего ответа: запомни текущую попытку, отмени её и доставь ответ. Отменённая или удалённая запись не вернётся.</p><p>Ответ сохраняется даже без открытия результата. Состав задан по первому снимку; детали «С оливковым маслом» у овощного блюда включают пример подтверждённых жиров.</p><h2>Тестовое время</h2><p>{new Date(store.now()).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })}</p><div className="study-inspector-actions"><button type="button" onClick={() => store.advanceDays(1)}>Следующий день</button><button type="button" onClick={() => store.advanceDays(7)}>Пропустить неделю</button></div><p>Тестовая дата сохраняется отдельно от прогресса. Награда, предел множителя, его рост и снижение — демозначения для проверки механики.</p><h2>Демосессия</h2><button type="button" onClick={() => setResetConfirm(true)}>Сбросить демосессию</button><p>{persistent ? 'Записи, баланс и вещи сохраняются в этом браузере. Отдельные истории их не меняют.' : 'Это изолированный пример; основная демосессия не изменяется.'}</p><h2>Ориентиры</h2><p>Haven: спокойный мир и отдельные поверхности для записей. Focus Friend: крупный персонаж и видимый результат обустройства.</p><a href="https://havenhabits.app/" target="_blank" rel="noreferrer">Haven</a> · <a href="https://www.yourfocusfriend.com/" target="_blank" rel="noreferrer">Focus Friend</a><p>Черновик для ревью. Камера, покупки, разрешения и история — демонстрационные. В основном прототипе записи и рюкзак сохраняются вместе; отдельные состояния изолированы. Первое фото даёт монеты; множитель и путь растут один раз за день. Подтверждённый вклад окрашивает компоненты за текущий день. Состояния героя показаны условно; финальные реакции и тексты — этап контента.</p>
    </aside></div>
  </section></StudyContentContext.Provider>;
}
