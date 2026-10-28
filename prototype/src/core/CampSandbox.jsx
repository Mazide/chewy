import { useEffect, useRef, useState } from 'react';
import { SANDBOX_LAYERS } from './sandbox-assets.js';
import { SANDBOX_DEVICES, getSandboxLayout, viewportFrame, croppedImageStyle } from './sandbox-scene-layout.js';
import imageBounds from './sandbox-image-bounds.js';
import { CoreSkeleton } from './CoreSkeleton.jsx';
import { PLACEMENT_STORAGE_KEY, readPlacements, clampMovement, moveSandboxLayout, getMovableFrame, getCurrentPlacement, getResizeLimits } from './sandbox-placement.js';
import { getOwnerCompositionPlacements } from './sandbox-owner-preset.js';
import { CAMP_COMPOSITIONS, getCampCompositionPlacements } from './camp-composition-presets.js';
import { FoodJournal, JOURNAL_DAYS } from './FoodJournal.jsx';
import './camp-sandbox.css';
import { CampSupplyMoment } from './CampSupplyMoment.jsx';
import { WorldLighting } from './WorldLighting.jsx';
import { CAMP_GROWTH_STAGES, campGrowthLayers } from './camp-growth.js';

function ScreenPreview({ screen, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element.open) element.showModal();
    return () => element.close();
  }, []);
  return <dialog ref={dialog} className="sandbox-screen-preview" onClose={onClose}>
    <header><span>Проба перехода</span><button onClick={onClose} aria-label="Вернуться к аппликации">×</button></header>
    <CoreSkeleton initialScreen={screen} seeded initialCoins={6} presentation={screen === 'add' ? 'canvas' : 'skeleton'} compact={screen === 'add'} />
  </dialog>;
}

function GroundGrass({ frame, object }) {
  return <svg className="sandbox-ground-grass" viewBox="0 0 16 10" aria-hidden="true" style={{ left: `${frame[0] / object.frame[2] * 100}%`, top: `${frame[1] / object.frame[3] * 100}%`, width: `${frame[2] / object.frame[2] * 100}%`, height: `${frame[3] / object.frame[3] * 100}%` }}>
    <path d="M1 9 C3 8 3 5 2 3 C6 4 7 7 7 9 C6 5 7 2 10 1 C10 5 9 7 10 9 C11 6 13 5 15 5 L13 9" />
  </svg>;
}

export function CampSandbox({ initialDevice = 'standard', initialPreset = 'growth', presentation = 'art', foodLayout = 'stacked', foodPresentation = 'block', initialEditing = true, onDeviceChange, onAddFood, onNavigate, activity, journalData, wallet, sceneOverlay, supplyMoment, objectReplacements = {}, initialJournalOpen = false, worldBackground, worldLabel, dayPhase = 'day', campStage, showZoneLabels = true }) {
  const blocks = presentation === 'blocks';
  const growth = initialPreset === 'growth';
  const [localStage, setLocalStage] = useState('initial');
  const stage = campStage ?? localStage;
  const layers = growth ? [...SANDBOX_LAYERS.filter(layer => !['tent', 'fire', 'kettle'].includes(layer.id)), ...campGrowthLayers(stage)] : SANDBOX_LAYERS;
  const journal = foodPresentation === 'journal';
  const inlineFood = foodLayout === 'inline';
  const separateFood = foodLayout === 'separate';
  const compactAction = inlineFood || separateFood;
  const composition = CAMP_COMPOSITIONS[initialPreset] ?? null;
  const ownerPreset = initialPreset === 'owner';
  const storageKey = growth ? `${PLACEMENT_STORAGE_KEY}.growth.v1.${foodLayout}` : (blocks || composition) ? `${PLACEMENT_STORAGE_KEY}.blocks.${initialPreset}${separateFood ? '.separate-food' : inlineFood ? '.inline-food' : ''}` : ownerPreset ? `${PLACEMENT_STORAGE_KEY}.owner-composition` : PLACEMENT_STORAGE_KEY;
  const defaultPlacements = () => composition ? getCampCompositionPlacements(initialPreset, foodLayout) : ownerPreset ? getOwnerCompositionPlacements() : {};
  const [hidden, setHidden] = useState([]);
  const [bounds, setBounds] = useState(false);
  const [grounded, setGrounded] = useState(true);
  const [selected, setSelected] = useState(null);
  const [deviceKey, setDeviceKey] = useState(initialDevice);
  const [preview, setPreview] = useState(null);
  const [editing, setEditing] = useState(initialEditing);
  const [journalDay, setJournalDay] = useState('day');
  const [journalOpen, setJournalOpen] = useState(initialJournalOpen);
  const [placements, setPlacements] = useState(() => {
    const preset = defaultPlacements();
    try {
      const saved = readPlacements(window.localStorage.getItem(storageKey));
      return ownerPreset || composition ? Object.fromEntries(Object.keys(SANDBOX_DEVICES).map((key) => [key, { ...preset[key], ...saved[key] }])) : saved;
    } catch { return preset; }
  });
  const [saveStatus, setSaveStatus] = useState('');
  const phone = useRef(null);
  const drag = useRef(null);
  const [dragging, setDragging] = useState(null);
  const device = SANDBOX_DEVICES[deviceKey];
  const baseLayout = getSandboxLayout(device, { foodLayout, growthStage: growth ? stage : undefined });
  const layout = moveSandboxLayout(baseLayout, placements[deviceKey]);
  const background = layers.find((layer) => layer.id === 'background');
  const objects = layout.objects.filter((object) => !hidden.includes(object.id));
  const toggle = (id) => setHidden((current) => current.includes(id) ? current.filter((key) => key !== id) : [...current, id]);
  const visibleFrame = (id) => layout.objects.find((object) => object.id === id)?.frame ?? layout.controls.find((control) => control.id === id)?.frame ?? [0, 0, device.width, device.height];
  const selectedFrame = getMovableFrame(layout, selected);
  const selectedPlacement = getCurrentPlacement(baseLayout, layout, selected);
  const resizeLimits = getResizeLimits(baseLayout, selected);
  const selectedIsObject = layout.objects.some((object) => object.id === selected);
  const resizeCorner = selectedFrame ? [selectedFrame[0] + selectedFrame[2], selectedIsObject ? selectedFrame[1] : selectedFrame[1] + selectedFrame[3]] : null;

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ version: 1, devices: placements }));
      setSaveStatus('Раскладка сохранена в этом браузере · отдельно для каждого размера.');
    } catch { setSaveStatus('Раскладка работает до перезагрузки: локальное сохранение недоступно.'); }
  }, [placements, storageKey]);

  const setPlacement = (id, placement) => setPlacements((current) => ({ ...current, [deviceKey]: { ...current[deviceKey], [id]: placement } }));
  const setScale = (id, scale) => {
    const current = getCurrentPlacement(baseLayout, layout, id);
    const limits = getResizeLimits(baseLayout, id);
    if (current && limits) setPlacement(id, [current[0], current[1], Math.max(limits.min, Math.min(limits.max, scale))]);
  };
  const startDrag = (event, id, mode = 'move') => {
    if (!editing || event.button !== 0 || !event.isPrimary || drag.current) return;
    const frame = getMovableFrame(layout, id);
    if (!frame) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.focus({ preventScroll: true });
    const rect = phone.current.getBoundingClientRect();
    drag.current = { id, mode, isObject: layout.objects.some((object) => object.id === id), pointerId: event.pointerId, x: event.clientX, y: event.clientY, rect, frame, placement: getCurrentPlacement(baseLayout, layout, id) };
    phone.current.setPointerCapture(event.pointerId);
    setSelected(id);
    setDragging({ id, mode });
  };
  const moveDrag = (event) => {
    const active = drag.current;
    if (!active || event.pointerId !== active.pointerId) return;
    event.preventDefault();
    const delta = [(event.clientX - active.x) * device.width / active.rect.width, (event.clientY - active.y) * device.height / active.rect.height];
    if (active.mode === 'resize') {
      const vx = active.frame[2] * (active.isObject ? .5 : 1), vy = active.frame[3] * (active.isObject ? -1 : 1);
      const factor = 1 + (delta[0] * vx + delta[1] * vy) / (vx * vx + vy * vy);
      const limits = getResizeLimits(baseLayout, active.id);
      setPlacement(active.id, [active.placement[0], active.placement[1], Math.max(limits.min, Math.min(limits.max, active.placement[2] * factor))]);
    } else {
      const shift = clampMovement(active.frame, delta, device);
      setPlacement(active.id, [active.placement[0] + shift[0], active.placement[1] + shift[1], active.placement[2]]);
    }
  };
  const endDrag = (event, cancelled = false) => {
    const active = drag.current;
    if (!active || (event.pointerId != null && event.pointerId !== active.pointerId)) return;
    if (cancelled) setPlacement(active.id, active.placement);
    drag.current = null;
    setDragging(null);
    if (phone.current.hasPointerCapture(active.pointerId)) phone.current.releasePointerCapture(active.pointerId);
    phone.current.querySelector(`[data-move-id="${active.id}"]`)?.focus({ preventScroll: true });
  };
  const moveWithKeys = (event, id) => {
    if (!editing || !getMovableFrame(layout, id)) return;
    if (event.key === 'Escape') { endDrag(event, true); return; }
    const step = event.shiftKey ? 10 : 2;
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (!delta) {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(id); }
      return;
    }
    event.preventDefault();
    const frame = getMovableFrame(layout, id);
    const placement = getCurrentPlacement(baseLayout, layout, id);
    const shift = clampMovement(frame, delta, device);
    setSelected(id);
    setPlacement(id, [placement[0] + shift[0], placement[1] + shift[1], placement[2]]);
  };
  const movableProps = (id) => ({
    'data-move-id': id,
    onPointerDown: (event) => startDrag(event, id),
    onKeyDown: (event) => moveWithKeys(event, id),
  });
  const reset = () => {
    setPlacements((current) => {
      const next = { ...current };
      if (ownerPreset || composition) next[deviceKey] = defaultPlacements()[deviceKey];
      else delete next[deviceKey];
      return next;
    });
    setHidden([]); setSelected(null); setBounds(false); setGrounded(true);
  };

  return <section className={`camp-sandbox${growth ? ' camp-growth-layout' : ''}${blocks ? ` camp-sandbox-blocks camp-composition-${initialPreset}` : ''}${separateFood ? ' sandbox-food-separate' : inlineFood ? ' sandbox-food-inline' : ''}`} onKeyDown={(event) => {
    if (!event.defaultPrevented && selected && !['INPUT', 'SELECT'].includes(event.target.tagName) && (event.key.startsWith('Arrow') || event.key === 'Escape')) moveWithKeys(event, selected);
  }}>
    <header className="sandbox-heading">{!blocks && <p>ПЕСОЧНИЦА / ПЛОСКИЙ АРТ ПО АРХИВНОМУ ГЕРОЮ</p>}<h1>{journal ? 'Сегодня · походный дневник' : blocks ? `Лагерь · ${composition?.label ?? 'блоки'}` : ownerPreset ? 'Композиция по твоей раскладке' : growth ? 'Лагерь · четыре зоны' : 'Лагерь как аппликация'}</h1><p>{journal ? 'Маленькая страница дня: тарелка и последние добавления. Нажми на неё — страница приблизится и раскроет записи; закрытие вернёт её на место.' : blocks ? composition?.description : growth ? 'Меньше герой, больше места для жизни лагеря. Обустройство, топливо, свет и сад сохраняют места в обеих стадиях; каждый слой можно двигать и масштабировать.' : ownerPreset ? 'Проба по скрину: крупный герой впереди, палатка позади, костёр с чайником слева, пёс рядом. Можно продолжать двигать и масштабировать; сброс вернёт этот пример.' : 'Оригинальный герой и новый набор с простой линией и плоскими заливками. Сцена масштабируется целиком, а кнопки и область еды размещаются относительно краёв экрана.'}</p></header>
    <div className="sandbox-layout">
      <div ref={phone} className={`sandbox-phone${!blocks ? ` sandbox-time-${dayPhase}` : ''}${bounds ? ' sandbox-show-bounds' : ''}${editing ? ' sandbox-edit-mode' : ''}${dragging ? ' sandbox-dragging' : ''}${dragging?.mode === 'resize' ? ' sandbox-resizing' : ''}`} style={{ '--phone-width': `${device.width}px`, '--resize-cursor': selectedIsObject ? 'nesw-resize' : 'nwse-resize', aspectRatio: `${device.width} / ${device.height}` }} aria-label={`${blocks ? 'Блочная композиция' : 'Пробная аппликация'} лагеря, ${device.width} на ${device.height}`} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={(event) => endDrag(event, true)} onLostPointerCapture={endDrag}>
        {!hidden.includes('background') && <div className={`sandbox-layer sandbox-background${selected === 'background' ? ' sandbox-layer-selected' : ''}`}>{blocks ? <div className="sandbox-block-background"><span>Спокойный фон</span></div> : <img src={worldBackground ?? background.src} alt={worldLabel ? `Лагерь: ${worldLabel}` : background.label} draggable="false" />}</div>}
        {!blocks && <WorldLighting phase={dayPhase} />}
        {!blocks && objects.flatMap((object) => object.shadows.map((shadow, index) => <div key={`shadow-${object.id}-${index}`} className="sandbox-contact-shadow" style={viewportFrame(shadow, device)} aria-hidden="true" />))}
        {!blocks && grounded && objects.flatMap((object) => object.contacts.map((contact, index) => <div key={`contact-${object.id}-${index}`} className="sandbox-contact-shadow sandbox-contact-shadow-dense" style={viewportFrame(contact, device)} aria-hidden="true" />))}
        {objects.map((object) => {
          const layer = layers.find((entry) => entry.id === object.id);
          return <div key={object.id} className={`sandbox-layer sandbox-world-object${selected === object.id ? ' sandbox-layer-selected' : ''}`} style={viewportFrame(object.frame, device)} {...movableProps(object.id)} role={editing ? 'button' : undefined} tabIndex={editing ? 0 : undefined} aria-label={editing ? `Переместить: ${layer.label}. Можно двигать стрелками.` : undefined}>
            {objectReplacements[object.id] || (blocks ? <div className={`sandbox-block sandbox-block-${object.id}`}><span>{({ hero: 'Герой', tent: 'Палатка', fire: 'Костёр', kettle: 'Чайник', pet: 'Пёс', workshop: 'Обустройство', fuel: 'Топливо', light: 'Свет', garden: 'Сад' })[object.id]}</span>{object.id === 'hero' && <small>главный акцент</small>}</div> : <div className="sandbox-sprite-crop"><img src={layer.src} alt={layer.label} style={croppedImageStyle(object.id, layer.bounds ?? imageBounds[object.id])} draggable="false" /></div>)}
            {growth && !blocks && !bounds && showZoneLabels && layer.bounds && <span className="sandbox-zone-label">{layer.label}</span>}
            {!blocks && grounded && object.grass.map((frame, index) => <GroundGrass key={index} frame={frame} object={object} />)}
            {bounds && <>{!blocks && <span className="sandbox-bound-label">{layer.label}</span>}<span className="sandbox-ground-anchor" /></>}
          </div>;
        })}
        {supplyMoment && growth && !editing && <CampSupplyMoment moment={supplyMoment} objects={objects} device={device} />}
        {sceneOverlay}
        <div className="sandbox-status" style={{ top: `${Math.max(6, device.safeTop / 2 - 8) / device.height * 100}%` }} aria-hidden="true" />
        <header className="sandbox-camp-header" style={viewportFrame(layout.header, device)}><span className={worldLabel ? 'sandbox-camp-place' : undefined}>{worldLabel ? <><strong>chewy</strong><small>{worldLabel}</small></> : 'chewy'}</span><span>{wallet == null ? 'Монеты' : `${wallet} монет`}</span></header>
        {activity && <div className="sandbox-capture-activity" style={viewportFrame([layout.header[0], layout.header[1] + layout.header[3] + 8, device.width - layout.header[0] - 96, 68], device)}>{activity}</div>}
        <nav aria-label="Экраны лагеря">{layout.controls.filter((control) => !hidden.includes(control.id)).map((control) => {
          const layer = layers.find((entry) => entry.id === control.id);
          const trim = imageBounds[control.id];
          return <button key={control.id} className={`sandbox-nav-control${selected === control.id ? ' sandbox-layer-selected' : ''}`} style={viewportFrame(control.frame, device)} {...movableProps(control.id)} onClick={() => editing ? setSelected(control.id) : onNavigate ? onNavigate(control.screen) : setPreview(control.screen)}>
            {!blocks && <span className="sandbox-nav-icon"><span className="sandbox-control-crop" style={{ aspectRatio: `${trim.width} / ${trim.height}` }}><img src={layer.src} alt="" style={croppedImageStyle(control.id)} draggable="false" /></span></span>}<span>{control.label}</span>
          </button>;
        })}</nav>
        {journal ? <FoodJournal onAddFood={onAddFood ?? (() => setPreview('add'))} frame={layout.food} device={device} dayKey={journalDay} dayData={journalData} editing={editing} selected={selected === 'food'} movableProps={movableProps('food')} onSelect={() => setSelected('food')} open={journalOpen} onOpen={() => setJournalOpen(true)} onClose={() => setJournalOpen(false)} /> : <section className={`sandbox-food-area${selected === 'food' ? ' sandbox-layer-selected' : ''}`} style={viewportFrame(layout.food, device)} {...movableProps('food')} role={editing ? 'button' : undefined} tabIndex={editing ? 0 : undefined} aria-label="Переместить область еды"><strong>{compactAction ? 'Сегодня' : blocks ? 'Сегодня · еда и тарелка' : 'Сегодня'}</strong><span>{compactAction ? 'Тарелка и записи' : blocks ? 'Место под будущую композицию' : 'Оформление еды пока выбираем'}</span></section>}
        <button className={`sandbox-add-food${selected === 'action' ? ' sandbox-layer-selected' : ''}`} style={viewportFrame(layout.action, device)} {...movableProps('action')} aria-label="Добавить еду" onClick={() => editing ? setSelected('action') : onAddFood ? onAddFood() : setPreview('add')}>{compactAction ? '+ Еда' : 'Добавить еду'}</button>
        {editing && resizeCorner && !hidden.includes(selected) && <button className={`sandbox-resize-handle${selectedIsObject ? ' sandbox-resize-top' : ''}`} style={viewportFrame([Math.max(0, Math.min(device.width - 44, resizeCorner[0] - 22)), Math.max(0, Math.min(device.height - 44, resizeCorner[1] - 22)), 44, 44], device)} onPointerDown={(event) => startDrag(event, selected, 'resize')} onKeyDown={(event) => {
          if (event.key === 'Escape') { endDrag(event, true); return; }
          if (event.key.startsWith('Arrow')) { event.preventDefault(); event.stopPropagation(); setScale(selected, selectedPlacement[2] + (['ArrowUp', 'ArrowRight'].includes(event.key) ? .02 : -.02)); }
        }} aria-label="Изменить размер выбранного предмета" title="Тяни угол, чтобы изменить размер"><span /></button>}
        <div className="sandbox-home-indicator" />
      </div>
      <aside className="sandbox-inspector">
        {growth && campStage == null && <label className="sandbox-device-label">Стадия лагеря<select value={stage} onChange={event => setLocalStage(event.target.value)}>{Object.entries(CAMP_GROWTH_STAGES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>}
        {journal && <section className="sandbox-journal-tools"><label className="sandbox-device-label">День в примере<select value={journalDay} onChange={(event) => setJournalDay(event.target.value)}>{Object.entries(JOURNAL_DAYS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label><button onClick={() => setJournalOpen(true)}>Посмотреть переход</button><p>Проба метафоры и движения. Вместо фото — условные значки; записи демонстрационные, отдельно от потока добавления еды.</p></section>}
        <label className="sandbox-device-label">Размер экрана<select value={deviceKey} onChange={(event) => { endDrag(event, true); setDeviceKey(event.target.value); onDeviceChange?.(event.target.value); }}>{Object.entries(SANDBOX_DEVICES).map(([key, value]) => <option key={key} value={key}>{value.label} · {value.width} × {value.height}</option>)}</select></label>
        <label className="sandbox-edit-toggle"><input type="checkbox" checked={editing} onChange={(event) => { endDrag(event, true); setEditing(event.target.checked); }} />Перетаскивать предметы и кнопки</label>
        <p className="sandbox-edit-help">Тяни мышью или пальцем. У выбранного предмета тяни угол рамки или меняй размер ползунком ниже. Стрелки двигают предмет, Shift — шаг побольше. Для пробы переходов выключи перетаскивание.</p>
        <div className="sandbox-tools"><button aria-pressed={bounds} onClick={() => setBounds(!bounds)}>Рамки и опоры</button>{!blocks && <button aria-pressed={grounded} onClick={() => setGrounded(!grounded)}>Контакт с землёй</button>}<button onClick={reset}>Сбросить этот экран</button></div>
        <p className="sandbox-save-status" role="status">{saveStatus}</p>
        {editing && selectedPlacement && <section className="sandbox-scale-panel"><label>Размер · {Math.round(selectedPlacement[2] * 100)}%<input type="range" min={resizeLimits.min} max={resizeLimits.max} step=".01" value={selectedPlacement[2]} onChange={(event) => setScale(selected, Number(event.target.value))} /></label><div><span>{selectedFrame.slice(2).map(Math.round).join(' × ')}</span><button onClick={() => setScale(selected, 1)}>Исходный размер</button></div></section>}
        {blocks && <section className="composition-principles"><h2>На что смотрим</h2><ul><li>Герой заметен первым.</li><li>Крупные и мелкие массы различаются.</li><li>Костёр и чайник читаются группой.</li><li>Палатка позади; силуэты разделяются.</li><li>Между группами есть воздух.</li><li>Еда и действие легко находятся.</li></ul></section>}
        <h2>Слои сцены</h2><p>{blocks ? 'Серые блоки показывают размеры и перекрытия. Выбирай блок на сцене или в списке; положение и размер можно менять. Пример декора не определяет число активных вещей.' : 'Пробуем участок «ноги → чайник → костёр»: плотные тени у каждого основания, перекрытие предметов и немного травы перед краями. «Контакт с землёй» выключает эти детали для сравнения. Розовые точки показывают опоры.'}</p>
        <ul>{layers.map((layer) => <li key={layer.id}>
          <input type="checkbox" checked={!hidden.includes(layer.id)} onChange={() => toggle(layer.id)} aria-label={`Показать: ${layer.label}`} />
          <button aria-pressed={selected === layer.id} onClick={() => setSelected(selected === layer.id ? null : layer.id)}><span>{layer.label}</span><small>{visibleFrame(layer.id).slice(2).map(Math.round).join(' × ')}</small></button>
        </li>)}</ul>
        {selected && <p className="sandbox-selection-note">{blocks ? 'Черновая область: ищем масштаб и место. Детали содержимого уточним после выбора композиции.' : layers.find((layer) => layer.id === selected)?.content ?? (selected === 'food' ? 'Область сегодняшней еды: компоновка ещё обсуждается.' : 'Основное действие — добавить еду.')}</p>}
        <p className="sandbox-footnote">Размеры телефонов — контрольные макеты. Боковые кнопки и «Добавить еду» открывают соответствующий экран скелета для пробы нажатия. Арт и размещение ещё на ревью.</p>
      </aside>
    </div>
    {!blocks && <details className="sandbox-asset-gallery"><summary>Отдельные картинки · весь пробный набор</summary><div>{layers.map((layer) => <figure key={layer.id}><div>{layer.id === 'background' ? <img src={layer.src} alt={layer.label} loading="lazy" /> : <span className="sandbox-gallery-crop" style={{ aspectRatio: `${(layer.bounds ?? imageBounds[layer.id]).width} / ${(layer.bounds ?? imageBounds[layer.id]).height}` }}><img src={layer.src} alt={layer.label} style={croppedImageStyle(layer.id, layer.bounds ?? imageBounds[layer.id])} loading="lazy" /></span>}</div><figcaption>{layer.label}{layer.id === 'hero' ? ' · оригинал из архива' : ''}</figcaption></figure>)}</div></details>}
    {preview && <ScreenPreview key={preview} screen={preview} onClose={() => setPreview(null)} />}
  </section>;
}
