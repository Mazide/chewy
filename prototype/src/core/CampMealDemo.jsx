import { useCallback, useEffect, useMemo, useState } from 'react';
import { RiveCampObject } from './RiveCampObject.jsx';
import { CampLog } from './CampLog.jsx';
import { VariantMotion, VARIANT_DEFAULTS } from './VariantMotion.jsx';
import { WorldLighting } from './WorldLighting.jsx';
import { SANDBOX_LAYERS } from './sandbox-assets.js';
import { SANDBOX_DEVICES, getSandboxLayout, viewportFrame, croppedImageStyle } from './sandbox-scene-layout.js';
import { getOwnerCampPlacements } from './camp-owner-layout.js';
import { moveSandboxLayout } from './sandbox-placement.js';
import { CAMP_DAILY_OBJECTS as COMPONENTS, dailyCampObjectFrame } from './camp-daily-states.js';
import { DEMO_SESSION_KEY, emptyMealDemo, randomDemoContribution, demoStages, addDemoMeal, restoreMealDemo, changedDemoComponents } from './camp-meal-demo.js';
import './camp-meal-demo.css';

const LABELS = Object.fromEntries(COMPONENTS.map(item => [item.metric, item.name.toLowerCase()]));
const readSession = () => { try { return restoreMealDemo(sessionStorage.getItem(DEMO_SESSION_KEY)); } catch { return emptyMealDemo(); } };
const mealWord = count => count % 10 === 1 && count % 100 !== 11 ? 'приём пищи' : count % 10 >= 2 && count % 10 <= 4 && !(count % 100 >= 12 && count % 100 <= 14) ? 'приёма пищи' : 'приёмов пищи';

function Plate({ filled = false }) {
  return <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" fill={filled ? '#fffbeb' : '#e7e9d9'} stroke="#a8ae88" strokeWidth="1.5" /><circle cx="16" cy="16" r="10" fill="none" stroke="#c9cdb4" />{filled && <><path d="M17 7a9 9 0 0 1 0 18Z" fill="#b1c476"/><path d="M14 7v8H7a9 9 0 0 1 7-8Z" fill="#e0b779"/><path d="M7 18h7v7a9 9 0 0 1-7-7Z" fill="#d6936d"/></>}</svg>;
}

export function CampMealDemo() {
  const [session, setSession] = useState(readSession);
  const [deviceKey, setDeviceKey] = useState(() => window.innerWidth < 360 ? 'compact' : 'standard');
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [paused, setPaused] = useState(false);
  const [statuses, setStatuses] = useState({});
  const [retry, setRetry] = useState(0);
  const [storageError, setStorageError] = useState(false);
  const [pulse, setPulse] = useState(0);
  const [dayNotice, setDayNotice] = useState(false);
  const device = SANDBOX_DEVICES[deviceKey];
  const stages = demoStages(session);
  const changed = changedDemoComponents(session);
  const ready = COMPONENTS.every(item => statuses[item.id] === 'ready');
  const failed = COMPONENTS.some(item => statuses[item.id] === 'error');
  const onStatus = useCallback((id, state) => setStatuses(previous => previous[id] === state ? previous : { ...previous, [id]: state }), []);
  const count = session.meals.length;
  const latest = session.meals.at(-1);
  const dominant = latest ? Object.entries(latest.contribution).sort((a, b) => b[1] - a[1])[0][0] : null;

  useEffect(() => {
    try { sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session)); setStorageError(false); }
    catch { setStorageError(true); }
  }, [session]);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = event => setReduced(event.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const layout = useMemo(() => {
    const source = moveSandboxLayout(getSandboxLayout(device, { foodLayout: 'separate', growthStage: 'initial' }), getOwnerCampPlacements()[deviceKey]);
    const objects = source.objects.filter(item => ['hero', 'pet', 'log'].includes(item.id));
    for (const component of COMPONENTS) {
      const original = source.objects.find(item => item.id === component.zone);
      objects.push({ id: component.id, component, foot: original.foot, frame: dailyCampObjectFrame(original, component) });
    }
    return objects.sort((a, b) => a.foot[1] - b.foot[1]);
  }, [device, deviceKey]);

  function addFood() {
    if (!ready) return;
    const contribution = randomDemoContribution();
    setSession(previous => addDemoMeal(previous, contribution));
    setPulse(value => value + 1); setDayNotice(false);
  }
  function newDay() {
    setSession(previous => emptyMealDemo(previous.day + 1));
    setPulse(0); setDayNotice(true);
  }
  const feedback = dayNotice ? 'Новый день — лагерь снова в начале.' : !count ? 'Добавь еду и посмотри, что изменится.' : changed.length
    ? `После еды изменились: ${changed.map(metric => LABELS[metric]).join(', ')}.`
    : 'Еда добавлена. Вклад сохранился, предметы остаются в текущем состоянии.';

  return <main className="camp-meal-demo">
    <header className="meal-demo-heading"><p className="meal-demo-eyebrow">CHEWY · ПРИМЕРКА В ЛАГЕРЕ</p><h1>День с Чуви</h1><p>Добавь еду несколько раз и посмотри, как лагерь оживает.</p></header>
    <div className="meal-demo-layout">
      <section className="meal-camp-scene" data-meal-count={count} aria-label="Лагерь Чуви" style={{ '--scene-width': `${device.width}px`, '--scene-safe-bottom': `${device.safeBottom / device.height * 100}%`, aspectRatio: `${device.width} / ${device.height}` }}>
        <img className="meal-camp-background" src={SANDBOX_LAYERS.find(item => item.id === 'background').src} alt="" />
        <WorldLighting phase="day" />
        <header className="meal-camp-header"><strong>chewy</strong><span>Лесная стоянка</span></header>
        {layout.map(object => <div key={object.id} className={`meal-camp-object${object.component ? ' meal-camp-component' : ''}`} data-scene-object={object.id} style={viewportFrame(object.frame, device)}>
          {object.component ? <>
            <RiveCampObject id={object.id} board={object.component.board} label={`${object.component.name}: ${object.component.states[stages[object.component.metric]]}`} stage={stages[object.component.metric]} paused={paused || reduced} retry={retry} onStatus={onStatus} />
            {pulse > 0 && <span key={`${session.day}-${pulse}`} className={`meal-camp-arrival${changed.includes(object.component.metric) ? ' meal-camp-arrival-strong' : ''}${paused || reduced ? ' meal-camp-arrival-still' : ''}`} aria-hidden="true" />}
          </> : object.id === 'hero' ? <div className="meal-camp-crop"><img src={SANDBOX_LAYERS.find(item => item.id === 'hero').src} alt="Чуви" style={croppedImageStyle('hero')} draggable="false" /></div> : object.id === 'pet' ? <VariantMotion slug={VARIANT_DEFAULTS.pet} paused={paused || reduced} /> : <CampLog />}
        </div>)}
        <div className="meal-camp-bottom">
          <div className="meal-camp-today"><div><strong>Сегодня</strong><span>{count ? `${count} ${mealWord(count)}` : 'Новый день в лагере'}</span></div><div className="meal-camp-plates" aria-hidden="true">{Array.from({ length: Math.min(3, Math.max(1, count)) }, (_, index) => <Plate key={index} filled={count > index} />)}{count > 3 && <span>+{count - 3}</span>}</div></div>
          <button className="meal-camp-add" onClick={addFood} disabled={!ready}><span aria-hidden="true">＋</span>{ready ? 'Добавить еду' : failed ? 'Предметы не загрузились' : 'Лагерь просыпается…'}</button>
        </div>
      </section>
      <aside className="meal-demo-panel">
        <div className="meal-demo-notice"><span className="meal-demo-tag">ПРОБА С ЕДОЙ</span><h2>{!count ? 'Начнём с завтрака?' : count < 3 ? 'Продолжим день' : 'День получился'}</h2><p>Каждое нажатие добавляет тестовый приём пищи со случайным составом. Попробуй три добавления — предметы меняются постепенно.</p></div>
        <p className="meal-demo-feedback" role="status" aria-live="polite">{feedback}</p>
        {failed && <div className="meal-demo-error" role="alert"><p>Часть лагеря не загрузилась. Еда и выбранные состояния сохранены.</p><button onClick={() => setRetry(value => value + 1)}>Загрузить предметы снова</button></div>}
        {storageError && <p className="meal-demo-error" role="alert">Браузер не сохранил пробу. Сейчас она работает до перезагрузки.</p>}
        <ul className="meal-demo-components" aria-label="Состояния компонентов">{COMPONENTS.map(item => <li key={item.id} data-component={item.metric} data-stage={stages[item.metric]}><div><strong>{item.name}</strong><small>{item.mapping}</small></div><span>{item.states[stages[item.metric]]}</span></li>)}</ul>
        {latest && <section className="meal-demo-latest"><span>Последняя еда</span><p>Больше всего откликнулась {LABELS[dominant] === 'костёр' ? 'зона костра' : LABELS[dominant] === 'растения' ? 'зелень' : LABELS[dominant]}.</p></section>}
        <div className="meal-demo-actions"><button onClick={newDay}>Новый день</button><button onClick={() => setPaused(value => !value)} disabled={reduced}>{reduced ? 'Без движения' : paused ? 'Включить движение' : 'Пауза'}</button></div>
        <label className="meal-demo-device">Размер примерки<select value={deviceKey} onChange={event => setDeviceKey(event.target.value)}>{Object.entries(SANDBOX_DEVICES).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
        <p className="meal-demo-note">Это визуальное демо. Состав случайный, переходы условные. Проба сохраняется в этой вкладке; основной прогресс и оформление не меняются.</p>
        <a className="meal-demo-link" href="/camp-states/compare.html" target="_top">Все состояния отдельно ↗</a>
      </aside>
    </div>
  </main>;
}
