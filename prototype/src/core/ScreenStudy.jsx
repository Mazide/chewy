import { useCallback, useEffect, useRef, useState } from 'react';
import { CampSandbox } from './CampSandbox.jsx';
import { AddFoodCanvas } from './AddFoodCanvas.jsx';
import { CaptureNotice } from './CaptureNotice.jsx';
import { ForestPath } from './ForestPath.jsx';
import { DAY_PHASES, JOURNEY_BIOMES, JOURNEY_STOPS, journeyBiome, resolveDayPhase } from './journey-world.js';
import { SANDBOX_DEVICES } from './sandbox-scene-layout.js';
import { STUDY_ITEMS, STUDY_SCREENS, STATUS_COPY } from './screen-study-data.js';
import { captureDay, completeDueCaptures, readCaptureSession, writeCaptureSession } from './capture-session.js';
import { StudyContentContext, StudyMedia } from './StudyMedia.jsx';
import { NUTRITION_DAY_EXAMPLES, nutritionExampleMeals } from './food-assessment.js';
import { CAPTURE_THEMES } from './capture-session.js';
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

function Backpack({ inventory, setInventory, onCamp }) {
  const [category, setCategory] = useState('decor');
  const [selectedId, setSelectedId] = useState('flowers');
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState('');
  const selected = STUDY_ITEMS.find(item => item.id === selectedId);
  const owned = inventory.owned.includes(selectedId);
  const equipped = inventory.applied[selected.kind] === selectedId;
  const enough = inventory.coins >= selected.cost;
  const choose = item => { setSelectedId(item.id); setNotice(''); };
  const buy = () => {
    setInventory(current => current.owned.includes(selected.id) || current.coins < selected.cost ? current : { ...current, coins: current.coins - selected.cost, owned: [...current.owned, selected.id] });
    setConfirm(false); setNotice(`${selected.name} теперь в рюкзаке.`);
  };
  const equip = () => {
    setInventory(current => ({ ...current, applied: { ...current.applied, [selected.kind]: equipped ? null : selected.id } }));
    setNotice(equipped ? 'Вещь осталась в рюкзаке.' : selected.kind === 'theme' ? 'Оформление выбрано.' : 'Теперь в твоём лагере.');
  };
  return <>
    <header className="study-top"><button onClick={onCamp} aria-label="В лагерь">←</button><h1>Рюкзак</h1><span className="study-wallet" aria-label={`Баланс: ${inventory.coins} монет`}>{inventory.coins}<small>монет</small></span></header>
    <div className="study-bag-preview">{selected.kind === 'theme' ? <div className={`study-theme-preview study-theme-preview-${selected.id}`}><StudyMedia kind="meal" label="Снимок блюда" /><StudyMedia kind={selected.id} label={selected.name} /><span>Оформление анализа</span></div> : <MiniCamp selected={selected} applied={inventory.applied} />}<span className="study-preview-label">{equipped ? 'Уже у тебя' : 'Примерка'}</span></div>
    <nav className="study-categories" aria-label="Категории вещей">{[['decor','Для лагеря'],['pet','Друзья'],['theme','Темы']].map(([id,label]) => <button key={id} aria-pressed={category === id} onClick={() => { setCategory(id); choose(STUDY_ITEMS.find(item => item.kind === id)); }}>{label}</button>)}</nav>
    <div className="study-catalog" aria-label="Вещи">{STUDY_ITEMS.filter(item => item.kind === category).map(item => <button key={item.id} aria-pressed={selectedId === item.id} onClick={() => choose(item)}><StudyMedia kind={item.id} label={item.name} /><strong>{item.name}</strong><small>{inventory.applied[item.kind] === item.id ? 'Используется' : inventory.owned.includes(item.id) ? 'В рюкзаке' : `${item.cost} монет`}</small></button>)}</div>
    <footer className="study-item-detail"><div><h2>{selected.name}</h2><p>{selected.description}</p></div><p className="study-notice" role="status">{notice || (!owned && !enough ? 'Пока не хватает монет. Можно вернуться позже.' : owned ? equipped ? 'Можно убрать и поставить снова.' : 'Готово к примерке и установке.' : 'Покупка добавит вещь в рюкзак.')}</p><button className="study-primary" disabled={!owned && !enough} onClick={owned ? equip : () => setConfirm(true)}>{owned ? equipped ? selected.kind === 'theme' ? 'Вернуть базовую тему' : 'Убрать в рюкзак' : selected.kind === 'theme' ? 'Выбрать тему' : 'Поставить в лагере' : `Купить · ${selected.cost} монет`}</button></footer>
    {confirm && <StudyDialog title={`Купить «${selected.name}»?`} onClose={() => setConfirm(false)}><p>Стоимость — {selected.cost} монет.<br />После покупки останется {inventory.coins - selected.cost}.</p><button className="study-primary" onClick={buy}>Купить за {selected.cost} монет</button><button onClick={() => setConfirm(false)}>Продолжить примерку</button></StudyDialog>}
  </>;
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

function Intro({ step, onNavigate, name, setName, onFinish }) {
  const [permission, setPermission] = useState(false);
  const [reminderTime, setReminderTime] = useState('18:00');
  return <>
    <header className="study-top study-intro-top">{step !== 'welcome' && <button aria-label="Назад" onClick={() => onNavigate(step === 'name' ? 'welcome' : 'name')}>←</button>}<span>chewy</span><button className="study-text-button" onClick={onFinish}>Позже</button></header>
    <div className="study-intro-scene"><MiniCamp applied={{}} heroOnly={step === 'name'} /></div>
    <div className="study-intro-copy">
      {step === 'welcome' ? <><h1>Маленький лагерь.<br />Друг рядом.</h1><p>Сфоткай еду и возвращайся к своим делам. Мы сохраним запись, а лагерь понемногу станет твоим.</p><div className="study-intro-cycle"><span>Снимок</span><i>→</i><span>Запись</span><i>→</i><span>Вещи</span></div></> : step === 'name' ? <><h1>Как его зовут?</h1><p>Можно придумать имя сейчас или познакомиться поближе позже.</p><label className="study-name-field">Имя друга<input maxLength={24} placeholder="Например, Чуви" value={name} onChange={event => setName(event.target.value)} autoComplete="off" /></label></> : <><h1>Иногда заглядывай</h1><p>Хочешь, напомним о лагере? Время можно выбрать, а напоминания — отключить.</p><div className="study-notification"><strong>chewy</strong><span>{name.trim() || 'Твой друг'} ждёт у костра. Заглянешь?</span></div></>}
    </div>
    <footer className="study-intro-actions">{step === 'reminders' && <label className="study-reminder-time">Напоминать в<input type="time" value={reminderTime} onChange={event => setReminderTime(event.target.value)} /></label>}<button className="study-primary" onClick={() => step === 'reminders' ? setPermission(true) : onNavigate(step === 'welcome' ? 'name' : 'reminders')}>{step === 'welcome' ? 'Познакомиться' : step === 'name' ? name.trim() ? 'Продолжить' : 'Пока без имени' : 'Настроить напоминания'}</button>{step === 'reminders' && <button onClick={onFinish}>Пока без напоминаний</button>}</footer>
    {permission && <StudyDialog title="Напоминать о лагере?" onClose={() => setPermission(false)}><p>Пример системного разрешения. В прототипе уведомления не включаются.</p><button className="study-primary" onClick={onFinish}>Разрешить в примере</button><button onClick={onFinish}>Не сейчас</button></StudyDialog>}
  </>;
}

function Status({ screen, onNavigate }) {
  const copy = STATUS_COPY[screen];
  return <><header className="study-top"><button onClick={() => onNavigate('camp')} aria-label="В лагерь">←</button><h1>{screen === 'cameraDenied' ? 'Добавить еду' : 'Снимок'}</h1></header><div className="study-status-content"><StudyMedia kind={copy.media} label={copy.media === 'camera' ? 'Камера' : 'Сохранённый снимок'} /><h2>{copy.title}</h2><p>{copy.text}</p></div><footer className="study-status-actions"><button className="study-primary" onClick={() => onNavigate(copy.next)}>{copy.action}</button><button onClick={() => onNavigate('camp')}>В лагерь</button></footer></>;
}

export function ScreenStudy({ initialScreen = 'backpack', initialPath = 'week', initialCoins = 12, initialEmpty = false, presentation = 'canvas', initialTheme = 'science' }) {
  const content = presentation === 'content';
  const [screen, setScreen] = useState(initialScreen);
  const [deviceKey, setDeviceKey] = useState('standard');
  const [pathState, setPathState] = useState(initialPath);
  const [journeyStep, setJourneyStep] = useState(initialPath === 'first' ? 0 : 2);
  const [dayMode, setDayMode] = useState('day');
  const [previewTime, setPreviewTime] = useState(() => new Date());
  const biome = journeyBiome(journeyStep);
  const phase = resolveDayPhase(dayMode, previewTime);
  useEffect(() => {
    if (dayMode !== 'auto') return;
    setPreviewTime(new Date());
    const timer = window.setInterval(() => setPreviewTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, [dayMode]);
  const [name, setName] = useState('');
  const [empty, setEmpty] = useState(initialEmpty);
  const [campStage, setCampStage] = useState(initialEmpty ? 'initial' : 'developed');
  const [showZoneLabels, setShowZoneLabels] = useState(true);
  const [inventory, setInventory] = useState({ coins: initialCoins, owned: [], applied: {} });
  const [jobId, setJobId] = useState(null);
  const [sampleKey, setSampleKey] = useState('meal');
  const [sampleMeal, setSampleMeal] = useState(null);
  const [supplyMoment, setSupplyMoment] = useState(null);
  const [dayExample, setDayExample] = useState(initialScreen === 'journal' ? 'mixed' : 'auto');
  const [themeKey, setThemeKey] = useState(initialTheme);
  const [jobs, setJobs] = useState(() => { try { return readCaptureSession(window.localStorage); } catch { return []; } });
  const updateJobs = useCallback(next => { setJobs(next); if (next.length) setEmpty(false); }, []);
  useEffect(() => {
    const settle = () => { const next = completeDueCaptures(jobs); if (next.some((job,index) => job !== jobs[index])) { try { writeCaptureSession(window.localStorage,next); setJobs(next); } catch { /* The original saved capture remains available for retry. */ } } };
    const timer = window.setInterval(settle, 500); window.addEventListener('pageshow',settle);
    return () => { clearInterval(timer); window.removeEventListener('pageshow',settle); };
  }, [jobs]);
  const device = SANDBOX_DEVICES[deviceKey];
  useEffect(() => { setThemeKey(inventory.applied.theme === 'theme_magic' ? 'alchemy' : inventory.applied.theme === undefined ? initialTheme : 'science'); }, [inventory.applied.theme, initialTheme]);
  const navigate = next => { setSupplyMoment(null); setJobId(null); setScreen(next); if (['camera','gallery'].includes(next)) setDayExample('auto'); };
  const onCamp = payload => { navigate('camp'); setSupplyMoment(payload?.supplyMoment ?? null); };
  const captureScreens = ['camera','gallery','waiting','result'];
  const openJob = id => { setJobId(id); setScreen('result'); };
  const demoMeals = nutritionExampleMeals(dayExample);
  const demoDay = { meals:demoMeals, onMealSelect:id => { const meal = demoMeals.find(item => item.id === id); setSampleKey(meal.imageKey); setSampleMeal(meal); setJobId(null); setScreen('result'); } };
  const day = dayExample !== 'auto' ? demoDay : empty ? { meals: [] } : jobs.length ? { ...captureDay(jobs), onMealSelect: openJob } : content ? demoDay : undefined;
  const attention = !empty && ([...jobs].reverse().find(job => job.status === 'processing' || (job.status === 'ready' && !job.seen)));
  return <StudyContentContext.Provider value={content}><section className={`screen-study${content ? ' screen-study-content' : ''}`}>
    <header className="study-workbench-heading"><h1>{content ? 'Sandbox · экраны с контентом' : 'Канвасы экранов'}</h1><p>Композиция, состояния и переходы. Выбери экран или пройди сценарий внутри телефона.</p></header>
    <div className="study-workbench-layout"><div className={`study-device-host study-device-${deviceKey}`} style={{ '--study-width': `${device.width}px` }}>
      {['camp','journal'].includes(screen) ? <div className="study-camp-host"><CampSandbox supplyMoment={screen === 'camp' ? supplyMoment : null} key={`${deviceKey}-${screen}`} presentation={content ? 'art' : 'blocks'} initialPreset="growth" campStage={campStage} showZoneLabels={showZoneLabels} initialDevice={deviceKey} foodLayout="separate" foodPresentation="journal" initialEditing={false} initialJournalOpen={screen === 'journal'} worldBackground={content ? biome.background : undefined} worldLabel={content ? `${biome.name} · ${DAY_PHASES[phase]}` : undefined} dayPhase={phase} onAddFood={() => navigate('camera')} onNavigate={navigate} journalData={day} wallet={inventory.coins} activity={attention && <CaptureNotice job={attention} onOpen={job => openJob(job.id)} />} objectReplacements={{ pet: inventory.applied.pet && <StudyMedia kind={inventory.applied.pet} label={STUDY_ITEMS.find(item => item.id === inventory.applied.pet)?.name} />, garden: inventory.applied.decor === 'flowers' && <StudyMedia kind="flowers" label="Выбранные цветы" />, light: inventory.applied.decor === 'lantern' && <StudyMedia kind="lantern" label="Выбранный фонарь" /> }} /></div> : captureScreens.includes(screen) ? <AddFoodCanvas key={`${screen}-${jobId}`} compact initialView={screen} initialJobId={jobId} pausePreview={screen === 'waiting'} deviceOverride={deviceKey} themeOverride={themeKey} previewSample={sampleKey} previewDishName={sampleMeal?.name} previewNotes={sampleMeal?.notes} previewOtherMeals={sampleMeal ? demoMeals.filter(meal => meal.id !== sampleMeal.id) : []} onCamp={onCamp} onJobsChange={updateJobs} /> : <div className={`study-phone study-screen-${screen}`} style={{ aspectRatio: `${device.width}/${device.height}`, '--study-safe-top': `${device.safeTop}px`, '--study-safe-bottom': `${device.safeBottom}px` }}>
        {screen === 'backpack' ? <Backpack inventory={inventory} setInventory={setInventory} onCamp={onCamp} /> : screen === 'path' ? content ? <ForestPath key={pathState} state={pathState} progress={journeyStep} phase={phase} onCamp={onCamp} onAdd={() => navigate('camera')} /> : <Path key={pathState} state={pathState} onCamp={onCamp} onAdd={() => navigate('camera')} /> : ['welcome','name','reminders'].includes(screen) ? <Intro step={screen} onNavigate={navigate} name={name} setName={setName} onFinish={() => { setEmpty(true); setPathState('first'); setJourneyStep(0); onCamp(); }} /> : <Status screen={screen} onNavigate={navigate} />}
        <div className="study-home-indicator" aria-hidden="true" />
      </div>}
    </div><aside className="study-inspector"><ReviewScreenPicker screen={screen} onNavigate={navigate} /><label>Размер телефона<select value={deviceKey} onChange={event => setDeviceKey(event.target.value)}>{Object.entries(SANDBOX_DEVICES).map(([id,data]) => <option key={id} value={id}>{data.label}</option>)}</select></label>
      {['camera','gallery','waiting','result'].includes(screen) && <label>Тема анализа<select value={themeKey} onChange={event => setThemeKey(event.target.value)}>{Object.entries(CAPTURE_THEMES).map(([key,theme]) => <option key={key} value={key}>{theme.label}</option>)}</select></label>}<h2>Композиция и UX</h2><p>{STUDY_SCREENS[screen].principle}</p>
      {screen === 'waiting' && <><button type="button" onClick={() => navigate('result')}>Показать результат</button><p>Обработка зафиксирована для примерки. В сценарии из камеры завершится сама.</p></>}
      {screen === 'backpack' && <><h2>Состояния покупки</h2><div className="study-inspector-actions"><button onClick={() => setInventory({ coins:12, owned:[], applied:{} })}>Есть монеты</button><button onClick={() => setInventory({ coins:0, owned:[], applied:{} })}>Пустой рюкзак</button><button onClick={() => setInventory({ coins:80, owned:STUDY_ITEMS.map(item => item.id), applied:{} })}>Все вещи куплены</button></div><p>Одна активная вещь каждого типа — условность этой пробы. Цены из старого демо; количество активных вещей и экономика ещё обсуждаются.</p></>}
      {screen === 'path' && <label>История в примере<select value={pathState} onChange={event => { const value = event.target.value; setPathState(value); setJourneyStep(current => value === 'first' ? 0 : Math.max(current, 2)); }}><option value="first">Первая встреча</option><option value="week">Несколько встреч</option><option value="return">Возвращение после пропуска</option></select></label>}
      {['camp','journal'].includes(screen) && <><h2>Раскладка лагеря</h2><label>Стадия лагеря<select value={campStage} onChange={event => setCampStage(event.target.value)}>{Object.entries(CAMP_GROWTH_STAGES).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="study-zone-label-toggle"><input type="checkbox" checked={showZoneLabels} onChange={event => setShowZoneLabels(event.target.checked)} />Подписи зон</label><p>Четыре зоны сохраняют места, герой остаётся в центре. Стадия задана для примерки и не зависит от записей еды или стоянки.</p></>}
      {content && ['camp','journal','path'].includes(screen) && <><h2>Мир лагеря · проба</h2><label>Продвижение по пути<select value={journeyStep} onChange={event => { setJourneyStep(Number(event.target.value)); setPathState('week'); }}>{JOURNEY_STOPS.map((stop,index) => <option key={stop.name} value={index}>{JOURNEY_BIOMES[stop.biome].name}: {stop.name}</option>)}</select></label><button type="button" className="journey-demo-next" disabled={journeyStep === JOURNEY_STOPS.length-1} onClick={() => {setJourneyStep(current => Math.min(current+1,JOURNEY_STOPS.length-1));setPathState('week');}}>Следующая стоянка · демо</button><label>Время суток<select value={dayMode} onChange={event => setDayMode(event.target.value)}><option value="auto">По часам · Europe/London</option>{Object.entries(DAY_PHASES).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label><p>Стоянка меняет окружение лагеря. Просмотр дороги не перемещает героя. Продвижение и время можно переключать для ревью; пороги переходов пока не заданы.</p></>}
      {['camp','journal','result'].includes(screen) && <><h2>Оценка питания · проба</h2>{screen !== 'result' && <label>День в примере<select value={dayExample} onChange={event => setDayExample(event.target.value)}>{Object.entries(NUTRITION_DAY_EXAMPLES).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>}<p>ВОЗ + Гарвардская тарелка. Оценки заданы для примерки, это не работающий анализ. Четыре запаса заполняются от блюд; веса и пределы демонстрационные, не суточные нормы. Пример «масло уточнено» показывает вклад жиров. Открой блюдо, чтобы увидеть добавленный участок. Монеты и состояние героя не меняются.</p></>}
      {screen === 'camp' && <><h2>Отклик запасов · демо</h2><div className="study-inspector-actions">{Object.entries(CAMP_SUPPLY_METAPHORS).map(([metric,{ label }]) => <button key={metric} onClick={() => setSupplyMoment({ metric, createdAt:Date.now() })}>{label}</button>)}</div><p>Короткий отклик зоны после результата. Предметы и рост лагеря не начисляются.</p></>}
      {screen === 'camp' && <button onClick={() => { setJobs([]); setEmpty(!empty); }}>{empty ? 'Показать день с едой' : 'Показать пустой день'}</button>}
      <h2>Ориентиры</h2><p>Haven: спокойный мир и отдельные поверхности для записей. Focus Friend: крупный персонаж и видимый результат обустройства.</p><a href="https://havenhabits.app/" target="_blank" rel="noreferrer">Haven</a> · <a href="https://www.yourfocusfriend.com/" target="_blank" rel="noreferrer">Focus Friend</a><p>Черновик для ревью. Камера, покупки, разрешения и история — демонстрационные. Состояние рюкзака живёт в этой пробе до перезагрузки.</p>
    </aside></div>
  </section></StudyContentContext.Provider>;
}
