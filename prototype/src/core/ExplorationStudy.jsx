import { useEffect, useRef, useState } from 'react';
import { StudyContentContext, StudyMedia } from './StudyMedia.jsx';
import { HeroAppearance } from './Headwear.jsx';
import { FoundWardrobe } from './FoundWardrobe.jsx';
import { SANDBOX_DEVICES } from './sandbox-scene-layout.js';
import { JOURNEY_STOPS } from './journey-world.js';
import { createExplorationStudy, EXPLORATION_ACTIVITIES, EXPLORATION_DEMO, EXPLORATION_ROUTES, observeExplorationActivity, placeExplorationFinding, selectExplorationRoute } from './exploration-study.js';
import './screen-study.css';
import './screen-study-content.css';
import './exploration-study.css';

export function ExplorationControls({ state, dayKey, onActivity, source, onSource }) {
  const [kind, setKind] = useState('steps');
  const [amount, setAmount] = useState('0');
  const [error, setError] = useState('');
  const activity = EXPLORATION_ACTIVITIES.find(item => item.id === kind);
  const peak = state.activityPeaks[dayKey]?.[kind] ?? 0;
  useEffect(() => { setAmount(String(peak)); setError(''); }, [kind, dayKey, peak]);
  const send = value => {
    const total = Number(value);
    if (String(value).trim() === '' || total < 0 || !Number.isSafeInteger(total)
      || !Number.isSafeInteger(total * (EXPLORATION_DEMO.progressPerDiscovery / activity.samplePerDiscovery))) {
      setError('Введи допустимое целое неотрицательное значение.'); return;
    }
    if (onActivity({ kind, amount: total }) === false) { setError('Активность не сохранена. Проверь доступ к сессии и попробуй ещё раз.'); return; }
    setAmount(String(total)); setError('');
  };
  return <section className="exploration-inspector" aria-label="Подставная активность">
    <h2>Активность · демо</h2>
    <label>Вид активности<select value={kind} onChange={event => setKind(event.target.value)}>{EXPLORATION_ACTIVITIES.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
    <label>Состояние источника<select value={source} onChange={event => onSource(event.target.value)}><option value="sample">Пример активности доступен</option><option value="not-connected">Данные не подключены</option><option value="no-data">Новых данных нет</option></select></label>
    <form onSubmit={event => { event.preventDefault(); if (source === 'sample') send(amount); }}><label>{activity.inputLabel}<input type="number" min="0" step="1" value={amount} onChange={event => setAmount(event.target.value)} /></label><button type="submit" disabled={source !== 'sample'}>Передать активность</button></form>
    <p>{dayKey}. {activity.label}: уже учтено {peak} {activity.unit}.</p>
    <button type="button" disabled={source !== 'sample'} onClick={() => send(peak + activity.increment)}>Ещё {activity.increment} {activity.unit}</button>
    {error && <p role="alert">{error}</p>}
    <p>Условный пример открытия: {activity.samplePerDiscovery} {activity.unit}. Это тюнинг пробы, не норма нагрузки. Health не подключён.</p>
    <p>Виды пока не складываются: учитываем наибольший условный вклад за день. Объединение независимых занятий и реальных источников ещё открыто.</p>
  </section>;
}

function VicinityMap({ route, progress, found, headwearId }) {
  const ratio = Math.min(1, progress / EXPLORATION_DEMO.progressPerDiscovery);
  return <div className={`exploration-map exploration-map-${route?.id ?? 'all'}`} role="img" aria-label={found ? 'Место исследовано' : ratio ? 'Чуви идёт по тропинке' : 'Две тропинки рядом с лагерем'}>
    <svg viewBox="0 0 340 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <path d="M-20 45Q70 15 130 60T365 35V240H-20Z" fill="#c2d1a0" />
      <path d="M-15 178Q58 107 160 164T360 132V245H-15Z" fill="#a4bc81" />
      <path d="M-15 97Q52 74 93 99T191 86" fill="none" stroke="#8fb9bc" strokeWidth="35" />
      <path d="M-15 91Q53 69 92 94T189 81" fill="none" stroke="#c3ded9" strokeWidth="3" />
      <g fill="#638565" stroke="#47694f" strokeWidth="2"><path d="M254 32L231 78H242L225 108H285L270 78H280Z" /><path d="M303 62L283 104H292L279 129H327L315 104H323Z" /></g>
      <path d="M167 218Q180 168 141 145T93 116M167 218Q180 168 220 145T259 119" fill="none" stroke="#e9dfba" strokeWidth="12" strokeLinecap="round" />
      {route && <path d={route.id === 'brook' ? 'M167 218Q180 168 141 145T93 116' : 'M167 218Q180 168 220 145T259 119'} pathLength="1" strokeDasharray={`${ratio} 1`} fill="none" stroke="#47694f" strokeWidth="4" strokeLinecap="round" />}
      <circle cx="93" cy="113" r="12" fill={route?.id === 'brook' && found ? '#38594b' : '#f3eedc'} stroke="#47694f" strokeWidth="2" />
      <circle cx="260" cy="117" r="12" fill={route?.id === 'pines' && found ? '#38594b' : '#f3eedc'} stroke="#47694f" strokeWidth="2" />
    </svg>
    <span className="exploration-map-label exploration-map-label-brook">Тихий берег</span><span className="exploration-map-label exploration-map-label-pines">Сосновая тропа</span>
    <HeroAppearance headwearId={headwearId} className="exploration-map-hero" />
  </div>;
}

export function ExplorationView({ state, headwearId, source = 'sample', onSelectRoute, onFindings, onBack, currentStopIndex = 0 }) {
  const heading = useRef(null);
  const [error, setError] = useState('');
  useEffect(() => { heading.current?.focus(); }, []);
  const route = EXPLORATION_ROUTES.find(item => item.id === state.selectedRouteId);
  const found = route && state.found.includes(route.findingId);
  const progress = route ? state.progress[route.id] : 0;
  const origin = route ? state.originStops?.[route.id] : null;
  const oldStop = origin != null && origin !== currentStopIndex;
  const sourceCopy = source === 'not-connected' ? 'Данные активности пока не подключены. Можно осмотреть окрестности и свои находки.' : source === 'no-data' ? 'Новых данных об активности пока нет. Всё, что уже открыли, остаётся с нами.' : 'Прогулки, велосипед, плавание и другие занятия помогают Чуви исследовать окрестности.';
  return <>
    <header className="study-top"><button type="button" aria-label="К карте" onClick={onBack}>←</button><h1 ref={heading} tabIndex={-1}>Окрестности</h1></header>
    <div className="exploration-scroll">
      <VicinityMap route={route} progress={progress} found={found} headwearId={headwearId} />
      <div className="exploration-routes" aria-label="Места рядом с лагерем">{EXPLORATION_ROUTES.map(item => <button type="button" key={item.id} aria-pressed={item.id === state.selectedRouteId} onClick={() => { setError(onSelectRoute(item.id) === false ? 'Не удалось сохранить выбор места. Попробуй ещё раз.' : ''); }}><strong>{item.name}</strong><span>{state.found.includes(item.findingId) ? 'Исследовано' : item.id === state.selectedRouteId ? 'Идём сюда' : state.progress[item.id] ? 'Тропинка уже знакома' : 'Пока незнакомое место'}</span></button>)}</div>
      <div className="exploration-copy" aria-live="polite"><h2>{found ? 'Смотри, что нашлось!' : !route ? 'Выберем, куда заглянуть' : progress ? progress >= EXPLORATION_DEMO.progressPerDiscovery / 2 ? 'Уже виднеется за поворотом' : 'Тропинка становится знакомой' : 'Начало маленького приключения'}</h2><p>{found ? `${route.findingName}. Она уже в рюкзаке — можно примерить.` : sourceCopy}</p>{oldStop && <p className="exploration-origin">Начали у стоянки «{JOURNEY_STOPS[Math.min(origin, JOURNEY_STOPS.length - 1)]?.name}». Можно закончить эту тропу и после переезда.</p>}{route && !found && <p className="exploration-gentle">Спешить некуда. Продолжим, когда захочется.</p>}</div>
    </div>
    <footer className="exploration-actions">{error && <p role="alert">{error}</p>}<button type="button" className="study-primary" onClick={() => found ? onFindings(route.findingId) : onBack()}>{found ? 'Рассмотреть находку' : 'Вернуться к карте'}</button><button type="button" onClick={() => onFindings()}>Мои находки</button></footer>
  </>;
}

export function ExplorationStudy() {
  const [state, setState] = useState(createExplorationStudy);
  const [screen, setScreen] = useState('camp');
  const [initialFindingId, setInitialFindingId] = useState(null);
  const [deviceKey, setDeviceKey] = useState('standard');
  const [source, setSource] = useState('sample');
  const [day, setDay] = useState(0);
  const [revision, setRevision] = useState(0);
  const device = SANDBOX_DEVICES[deviceKey];
  const dayKey = new Date(Date.UTC(2026, 9, 29 + day)).toISOString().slice(0, 10);
  const inventory = { coins: 0, owned: state.found, applied: { headwear: state.placedId } };
  const store = { applyHeadwear: id => { setState(current => placeExplorationFinding(current, id)); return true; } };
  const openFindings = id => { setInitialFindingId(id ?? null); setScreen('findings'); };
  const reset = () => { setInitialFindingId(null); setState(createExplorationStudy()); setDay(0); setSource('sample'); setScreen('camp'); setRevision(value => value + 1); };
  return <StudyContentContext.Provider value><section className="screen-study screen-study-content exploration-study">
    <header className="study-workbench-heading"><h1>Активность и окрестности · проба</h1><p>Место → активность → находка → шляпа на Чуви. Подставные данные, черновые вещи. Основной прототип сохраняет этот цикл; здесь независимая проба до перезагрузки.</p></header>
    <div className="study-workbench-layout"><div className={`study-device-host study-device-${deviceKey}`} style={{ '--study-width': `${device.width}px` }}>
      <div className="study-phone exploration-phone" style={{ aspectRatio: `${device.width}/${device.height}`, '--study-safe-top': `${device.safeTop}px`, '--study-safe-bottom': `${device.safeBottom}px` }}>
        {screen === 'vicinity' ? <ExplorationView state={state} headwearId={state.placedId} source={source} onSelectRoute={id => { setState(current => selectExplorationRoute(current, id)); return true; }} onFindings={openFindings} onBack={() => setScreen('camp')} /> : screen === 'findings' ? <FoundWardrobe initialFindingId={initialFindingId} inventory={inventory} store={store} onCamp={() => setScreen('camp')} onExplore={() => setScreen('vicinity')} /> : <>
          <header className="study-top"><h1>Лесная стоянка</h1></header>
          <div className="exploration-scroll"><div className="study-mini-camp exploration-camp" aria-label="Лагерь Чуви"><StudyMedia kind="tent" label="Палатка" /><HeroAppearance headwearId={state.placedId} /><StudyMedia kind="fire" label="Костёр" /></div><div className="exploration-copy"><h2>{state.placedId ? 'Теперь у Чуви новая шляпа' : 'Что там за деревьями?'}</h2><p>Рядом с лагерем есть тихий берег и тропа среди сосен. Заглянем?</p></div></div>
          <footer className="exploration-actions"><button type="button" className="study-primary" onClick={() => setScreen('vicinity')}>Исследовать окрестности</button><button type="button" onClick={() => openFindings()}>Мои находки</button></footer>
        </>}<div className="study-home-indicator" aria-hidden="true" />
      </div></div>
      <aside className="study-inspector" aria-label="Инструменты пробы активности"><label>Размер телефона<select value={deviceKey} onChange={event => setDeviceKey(event.target.value)}>{Object.entries(SANDBOX_DEVICES).map(([id,data]) => <option value={id} key={id}>{data.label}</option>)}</select></label>
        <ExplorationControls key={revision} state={state} dayKey={dayKey} source={source} onSource={setSource} onActivity={sample => { setState(current => observeExplorationActivity(current, { ...sample, dayKey })); return true; }} />
        <button type="button" onClick={() => setDay(value => value + 1)}>Следующий день</button>
        <h2>Находки · черновик</h2><p>Два головных убора для проверки примерки и сохранения выбора. Названия и рисунки не финальные. Одежду для других частей тела пока не добавляем.</p><button type="button" onClick={reset}>Начать пробу заново</button>
      </aside>
    </div>
  </section></StudyContentContext.Provider>;
}
