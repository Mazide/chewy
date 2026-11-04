import { useEffect, useLayoutEffect, useRef } from 'react';
import { DayFoodAssessment } from './FoodAssessment.jsx';
import { FoodJournalEntries } from './FoodJournal.jsx';
import { capturePhotos } from './capture-session.js';
import { formatJourneyDay } from './journey-history.js';
import './journey-day.css';

export function JourneyDay({ day, days, todayKey, onSelectDay, onMealSelect, onBack }) {
  const backButton = useRef(null);
  const scroll = useRef(null);
  useLayoutEffect(() => { backButton.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => { if (scroll.current) scroll.current.scrollTop = 0; }, [day.dayKey]);
  const orderedDays = [...days].sort((left, right) => right.dayKey.localeCompare(left.dayKey));
  const hasFailure = day.jobs.some(job => ['failed','notFood'].includes(job.status) && !job.result);
  // A revision keeps its existing meal visible. Only first analyses need an extra row.
  const pendingMeals = day.jobs.filter(job => ['processing', 'failed', 'notFood'].includes(job.status) && !job.result).map(job => ({
    id: job.id, imageKey: capturePhotos(job)[0]?.imageKey, emoji: '◌',
    name: job.status === 'notFood' ? 'Снимки · еду не удалось узнать' : `${job.dishName.trim() || 'Снимки еды'}${job.status === 'failed' ? ' · нужен повтор' : ''}`,
    time: new Date(job.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
  }));
  return <section className="journey-day food-journal-quiet" aria-label="История дня" data-history-day={day.dayKey}>
    <header className="journey-day-header">
      <button ref={backButton} type="button" className="journey-day-back" onClick={onBack}><span aria-hidden="true">←</span> К пути</button>
      <div><p>Записи по дороге</p><h1>{formatJourneyDay(day.dayKey)}</h1></div>
    </header>
    <label className="journey-day-picker">День истории
      <select value={day.dayKey} onChange={event => onSelectDay(event.target.value)}>{orderedDays.map(row => <option key={row.dayKey} value={row.dayKey}>{formatJourneyDay(row.dayKey)}{row.dayKey === todayKey ? ' · текущий день' : ''}</option>)}</select>
    </label>
    <div ref={scroll} className="journey-day-scroll">
      <DayFoodAssessment key={day.dayKey} meals={day.meals} binaryContributions historical />
      <section className="food-journal-entries journey-day-entries" aria-labelledby="journey-day-meals-title">
        <h2 id="journey-day-meals-title">Еда за этот день</h2>
        {day.meals.length ? <FoodJournalEntries meals={day.meals} onMealSelect={onMealSelect} label="Еда за выбранный день" /> : <p className="journey-day-empty">Готовых записей еды за этот день пока нет.</p>}
      </section>
      {!!pendingMeals.length && <section className="food-journal-entries journey-day-entries journey-day-pending" aria-labelledby="journey-day-pending-title">
        <h2 id="journey-day-pending-title">Без готового разбора</h2>
        <p>Снимки сохранены. Можно открыть запись и продолжить разбор.</p>
        <FoodJournalEntries meals={pendingMeals} onMealSelect={onMealSelect} label={hasFailure ? 'Записи без готового разбора за выбранный день' : 'Записи в обработке за выбранный день'} />
      </section>}
    </div>
  </section>;
}
