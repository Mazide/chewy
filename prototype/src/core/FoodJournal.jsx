import { useContext, useEffect, useLayoutEffect, useRef } from 'react';
import { StudyContentContext } from './StudyMedia.jsx';
import { samplePhoto } from './study-content.js';
import { EMPTY_PLATE, MEAL_PRESETS, scoreMeal } from '../data/game.js';
import { DayFoodAssessment, MiniSupplies } from './FoodAssessment.jsx';
import { dayAssessment } from './food-assessment.js';
import { CaptureIcon } from './CaptureInstrument.jsx';
import { viewportFrame } from './sandbox-scene-layout.js';
import './food-journal.css';

const DEMO_MEALS = [
  { preset: 'oatmeal', name: 'Овсянка с ягодами', time: '08:40' },
  { preset: 'apple', name: 'Яблоко', time: '11:15' },
  { preset: 'chicken', name: 'Курица с гречкой', time: '13:20' },
  { preset: 'salad', name: 'Овощной салат', time: '16:10' },
  { preset: 'pizza', name: 'Пицца', time: '19:30' },
  { preset: 'apple', name: 'Яблоко', time: '21:10' },
];

function MealPicture({ meal }) {
  const content = useContext(StudyContentContext);
  return content && meal.imageKey ? <img src={samplePhoto(meal.imageKey).src} alt="" /> : meal.emoji;
}

export const JOURNAL_DAYS = {
  empty: { label: 'Утро · пока пусто', indices: [] },
  first: { label: 'Первая еда', indices: [0] },
  day: { label: 'Несколько приёмов', indices: [0, 2, 4] },
  busy: { label: 'Много записей', indices: [0, 1, 2, 3, 4, 5] },
};

function makeDay(key) {
  let plate = { ...EMPTY_PLATE };
  const meals = JOURNAL_DAYS[key].indices.map((index, position) => {
    const meal = DEMO_MEALS[index];
    const preset = MEAL_PRESETS.find((item) => item.id === meal.preset);
    plate = scoreMeal(plate, preset, 1, position).plateAfter;
    return { ...meal, id: index, emoji: preset.emoji };
  });
  return { plate, meals };
}

function JournalPage({ source, device, day, onClose, onMealSelect, onAddFood }) {
  const content = useContext(StudyContentContext);
  const dialog = useRef(null);
  const closeButton = useRef(null);
  const animation = useRef(null);
  const closing = useRef(false);
  const originTransform = useRef('none');
  const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 420;

  useLayoutEffect(() => {
    const element = dialog.current;
    const from = source.current.getBoundingClientRect();
    const phone = source.current.closest('.sandbox-phone').getBoundingClientRect();
    const scale = phone.width / device.width;
    const width = Math.min(phone.width - 24, window.innerWidth - 24);
    const height = Math.min(phone.height - (device.safeTop + device.safeBottom) * scale - 24, window.innerHeight - 24);
    const left = Math.max(12, Math.min(phone.left + 12, window.innerWidth - width - 12));
    const top = Math.max(12, Math.min(phone.top + device.safeTop * scale + 12, window.innerHeight - height - 12));
    Object.assign(element.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
    element.showModal();
    const to = element.getBoundingClientRect();
    originTransform.current = `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;
    animation.current = element.animate([
      { transform: originTransform.current }, { transform: 'none' },
    ], { duration, easing: 'cubic-bezier(.2,.75,.25,1)' });
    closeButton.current.focus({ preventScroll: true });
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      animation.current?.cancel();
      element.close();
      document.body.style.overflow = originalOverflow;
    };
  }, [device, duration, source]);

  const close = (afterClose) => {
    if (closing.current) return;
    closing.current = true;
    const currentTransform = getComputedStyle(dialog.current).transform;
    animation.current?.cancel();
    animation.current = dialog.current.animate([
      { transform: currentTransform }, { transform: originTransform.current },
    ], { duration: duration ? 300 : 0, easing: 'cubic-bezier(.4,0,.65,1)', fill: 'forwards' });
    animation.current.finished.then(() => { onClose(); if (typeof afterClose === 'function') afterClose(); }).catch(() => {});
  };

  return <dialog ref={dialog} className={`food-journal-page food-journal-quiet${content ? ' food-journal-paper' : ''}`} aria-labelledby="food-journal-title" onKeyDown={(event) => event.stopPropagation()} onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
  }}>
    <header className="food-journal-page-heading"><h2 id="food-journal-title">Сегодня</h2><button ref={closeButton} type="button" onClick={close} aria-label="Свернуть дневник">×</button></header>
    <div className="food-journal-scroll"><DayFoodAssessment meals={day.meals} />
    <div className="food-journal-entries">
      {day.meals.length ? <ol aria-label="Еда сегодня">{day.meals.map((meal) => {
        const entry = <><span className="food-journal-photo" aria-hidden="true"><MealPicture meal={meal} /></span><time>{meal.time}</time><strong>{meal.name}</strong></>;
        return <li key={meal.id}>{onMealSelect ? <button type="button" className="food-journal-entry" onClick={() => close(() => onMealSelect(meal.id))}>{entry}</button> : <div className="food-journal-entry">{entry}</div>}</li>;
      })}</ol> : <div className="food-journal-empty"><CaptureIcon kind="camera" /><p>Начнём с первого снимка</p>{onAddFood && <button type="button" onClick={() => close(onAddFood)}>Добавить еду</button>}</div>}
    </div></div>
  </dialog>;
}

export function FoodJournal({ frame, device, dayKey, dayData, editing, selected, movableProps, onSelect, open, onOpen, onClose, onAddFood }) {
  const source = useRef(null);
  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current && !open) source.current?.focus({ preventScroll:true });
    wasOpen.current = open;
  }, [open]);
  const day = dayData ?? makeDay(dayKey);
  const assessment = dayAssessment(day.meals);
  return <>
    <button ref={source} type="button" className={`food-journal-summary${selected ? ' sandbox-layer-selected' : ''}`} style={{ ...viewportFrame(frame, device), visibility: open ? 'hidden' : undefined }} {...movableProps} onClick={() => editing ? onSelect() : onOpen()} aria-label={editing ? 'Переместить дневник еды' : 'Открыть дневник еды за сегодня'} aria-haspopup={editing ? undefined : 'dialog'}>
      <MiniSupplies meals={day.meals} />
      <span className="food-journal-summary-copy"><strong>Сегодня</strong><small className="food-journal-summary-verdict">{assessment.short}</small></span>
      <span className="food-journal-fold" aria-hidden="true" />
    </button>
    {open && <><div className="food-journal-shade" aria-hidden="true" /><JournalPage source={source} device={device} day={day} onClose={onClose} onMealSelect={dayData?.onMealSelect} onAddFood={onAddFood} /></>}
  </>;
}
