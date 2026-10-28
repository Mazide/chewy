import { useId, useRef, useState } from 'react';
import { dayAssessment, mealAssessment, NUTRITION_METRICS, nutritionSupplies } from './food-assessment.js';
import './food-assessment.css';
import './nutrition-compact.css';
import { CampSupplyIcon } from './CampSupplyIcon.jsx';
import { CAMP_SUPPLY_METAPHORS } from './camp-supply-metaphors.js';

const supplyLevel = fill => fill >= 100 ? 'запас наполнен' : fill >= 60 ? 'запас растёт' : fill > 0 ? 'есть вклад' : 'пока нет подтверждённого вклада';

function SupplyIcon({ metric }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {metric === 'protein' ? <><path d="M17 4c6 4 3 13-4 15C5 22 1 15 5 11c3-3 6 0 7-4 1-3 3-4 5-3Z" /><path d="M8 14c4 1 8-3 8-6" /></> : metric === 'carbs' ? <><path d="m6 21 11-18M9 16c-5-1-5-5-4-6 4 0 6 2 4 6Zm3-5c-4-1-4-5-3-6 4 1 4 3 3 6Zm-2 4c3-5 7-5 9-3-2 4-6 5-9 3Zm4-6c2-5 5-5 7-3-1 3-4 4-7 3Z" /></> : metric === 'fats' ? <><path d="M12 3C9 8 5 12 5 16a7 7 0 0 0 14 0c0-4-4-8-7-13Z" /><path d="M9 15c-1 2 0 4 2 4" /></> : <><path d="M5 17C2 8 9 4 21 4c-1 12-6 17-13 14M4 21 16 9M9 16v-5m1 4h5" /></>}
  </svg>;
}

export function MiniSupplies({ meals }) {
  const { values } = nutritionSupplies(meals);
  return <span className="nutrition-mini-supplies" role="img" aria-label={NUTRITION_METRICS.map(({ key, label }) => `${label}: ${supplyLevel(values[key].fill)}`).join('; ')}>
    {NUTRITION_METRICS.map(({ key, color }) => <span key={key} style={{ '--supply-color':color }}><i style={{ height:`${values[key].fill}%` }} /></span>)}
  </span>;
}

function SupplyMeters({ meals, previousMeals, contribution, onSelect, selected, detailId }) {
  const { values } = nutritionSupplies(meals);
  const before = previousMeals ? nutritionSupplies(previousMeals).values : null;
  const current = contribution ? nutritionSupplies([contribution]).values : null;
  return <ul className="nutrition-supplies" aria-label={before ? 'Вклад блюда в запасы героя' : 'Запасы героя сегодня'}>
    {NUTRITION_METRICS.map(({ key, label, color, pale }) => {
      const value = values[key];
      const previous = before?.[key].fill ?? value.fill;
      const added = Math.max(0, value.fill - previous);
      const sources = current?.[key].sources ?? value.sources;
      const description = `${label}: ${supplyLevel(value.fill)}${before && current[key].fill ? added ? '; блюдо пополнило запас' : '; вклад есть, запас уже наполнен' : ''}`;
      const meter = <>
        <span className="nutrition-supply-icon">{onSelect ? <CampSupplyIcon metric={key} /> : <SupplyIcon metric={key} />}</span>
        <div className="nutrition-supply-body"><strong>{onSelect ? ({ carbs:'Углеводы', fats:'Жиры' }[key] ?? label) : label}</strong>
          <span className={`nutrition-supply-track${value.fill ? '' : ' nutrition-supply-unconfirmed'}`} role={onSelect ? undefined : 'img'} aria-label={onSelect ? undefined : description} aria-hidden={onSelect ? true : undefined}>
            <span className="nutrition-supply-existing" style={{ width:`${previous}%` }} />
            {added > 0 && <span className="nutrition-supply-added" style={{ left:`${previous}%`, width:`${added}%` }} />}
          </span>
          {!onSelect && <small>{sources.length ? sources.join(', ') : before ? 'Без подтверждённого вклада' : meals.length ? 'Пока нет данных об источниках' : 'Появится с первой записью'}</small>}
        </div>
      </>;
      return <li key={key} style={{ '--supply-color':color, '--supply-pale':pale }}>
        {onSelect ? <button type="button" className="nutrition-supply-button" aria-label={description} aria-expanded={selected === key} aria-controls={detailId} onClick={event => onSelect(key, event)}>{meter}</button> : meter}
      </li>;
    })}
  </ul>;
}

export function PlateGuide({ small = false }) {
  return <span className={`nutrition-plate${small ? ' nutrition-plate-small' : ''}`} role="img" aria-label="Ориентир Гарвардской тарелки: половина овощей и фруктов, оставшаяся часть — белковые продукты и цельные злаки"><span className="nutrition-plate-veg" aria-hidden="true">✿</span><span className="nutrition-plate-protein" aria-hidden="true">◒</span><span className="nutrition-plate-grain" aria-hidden="true">❧</span></span>;
}

export function AssessmentMethod() {
  return <details className="nutrition-method"><summary>Как устроены запасы</summary><p>Шкалы показывают вклад записанной еды в запасы Чуви. Их заполнение — игровой ориентир, а не измерение суточной нормы. Закрывать все шкалы каждый день не обязательно.</p><p>Качество углеводов смотрим по источникам клетчатки: цельным злакам, бобовым, овощам и цельным фруктам. Один продукт может пополнять несколько запасов. Масло, орехи, семена или рыба могут дать вклад в ненасыщенные жиры, когда состав известен.</p><div className="nutrition-method-plate"><PlateGuide small /><p>Гарвардская тарелка — отдельный ориентир пропорций: половина овощей и фруктов, остальное — белковые продукты и цельные злаки.</p></div><p>ВОЗ добавляет ориентиры по разнообразию, клетчатке, соли, свободным сахарам и жирам. Соль и сахар не нужно накапливать; их оцениваем отдельно, когда есть данные.</p><a href="https://nutritionsource.hsph.harvard.edu/healthy-eating-plate/" target="_blank" rel="noreferrer">Гарвардская тарелка</a><span aria-hidden="true"> · </span><a href="https://www.who.int/news-room/fact-sheets/detail/healthy-diet" target="_blank" rel="noreferrer">Рекомендации ВОЗ</a></details>;
}

export function DayFoodAssessment({ meals }) {
  const assessment = dayAssessment(meals);
  const [expanded, setExpanded] = useState(null);
  const trigger = useRef(null);
  const detailId = useId();
  const selectedMetric = NUTRITION_METRICS.find(metric => metric.key === expanded);
  const sources = selectedMetric ? nutritionSupplies(meals).values[selectedMetric.key].sources : [];
  const toggle = (key, event) => { trigger.current = event.currentTarget; setExpanded(current => current === key ? null : key); };
  return <section className={`nutrition-day nutrition-compact nutrition-tone-${assessment.tone}`} aria-label="Запасы и оценка дня">
    <h3>Запасы Чуви</h3>
    <SupplyMeters meals={meals} onSelect={toggle} selected={expanded} detailId={detailId} />
    {!!meals.length && <button type="button" className="nutrition-day-verdict" aria-expanded={expanded === 'assessment'} aria-controls={detailId} onClick={event => toggle('assessment', event)}><span>{assessment.short}</span><span className="nutrition-disclosure-chevron" aria-hidden="true">⌄</span></button>}
    <section id={detailId} className="nutrition-detail" hidden={!expanded} aria-label={selectedMetric?.label ?? 'Об оценке дня'}>
      {expanded && <><header><h4>{selectedMetric?.label ?? 'О сегодняшнем дне'}</h4><button type="button" aria-label="Свернуть пояснение" onClick={() => { trigger.current?.focus({ preventScroll:true }); setExpanded(null); }}>×</button></header>
        {selectedMetric ? <><p className="nutrition-metaphor"><CampSupplyIcon metric={selectedMetric.key} /><span>{CAMP_SUPPLY_METAPHORS[selectedMetric.key].detail}</span></p><p>{sources.length ? `Из записей сегодня: ${sources.join(', ')}.` : meals.length ? 'В записях пока нет подтверждённого источника. Можно открыть блюдо и уточнить состав.' : 'Источники появятся с первой записью еды.'}</p></> : <p>{assessment.reason}</p>}
        <AssessmentMethod />
      </>}
    </section>
  </section>;
}

export function MealFoodAssessment({ meal, otherMeals = [], pendingEdits = false, photo, photoPicker }) {
  const assessment = mealAssessment(meal);
  const [expanded, setExpanded] = useState(null);
  const trigger = useRef(null);
  const detailId = useId();
  const selectedMetric = NUTRITION_METRICS.find(metric => metric.key === expanded);
  const sources = selectedMetric ? nutritionSupplies([meal]).values[selectedMetric.key].sources : [];
  const toggle = (key, event) => { trigger.current = event.currentTarget; setExpanded(current => current === key ? null : key); };
  return <section className={`nutrition-meal nutrition-compact nutrition-tone-${assessment.tone}`} aria-label="Оценка блюда">
    <header className="nutrition-meal-opening">{photo}<div><h3 className="nutrition-meal-title">{meal.name}</h3><button type="button" className="nutrition-meal-verdict" aria-expanded={expanded === 'assessment'} aria-controls={detailId} onClick={event => toggle('assessment', event)}><span>{assessment.label}</span><span className="nutrition-disclosure-chevron" aria-hidden="true">⌄</span></button></div></header>
    {photoPicker}
    <div className="nutrition-meal-stores"><h3>В запасы Чуви</h3>
      <SupplyMeters meals={[...otherMeals, meal]} previousMeals={otherMeals} contribution={meal} onSelect={toggle} selected={expanded} detailId={detailId} />
    </div>
    <section id={detailId} className="nutrition-detail" hidden={!expanded} aria-label={selectedMetric?.label ?? 'Об оценке блюда'}>
      {expanded && <><header><h4>{selectedMetric?.label ?? 'Об этой еде'}</h4><button type="button" aria-label="Свернуть пояснение" onClick={() => { trigger.current?.focus({ preventScroll:true }); setExpanded(null); }}>×</button></header>
        {selectedMetric ? <><p className="nutrition-metaphor"><CampSupplyIcon metric={selectedMetric.key} /><span>{CAMP_SUPPLY_METAPHORS[selectedMetric.key].detail}</span></p><p>{sources.length ? `Источник в этой еде: ${sources.join(', ')}.` : 'По этой записи вклад в запас пока не подтверждён. Состав можно дополнить через «Уточнить».'}</p><p className="nutrition-supply-legend"><i aria-hidden="true" />Светлая часть шкалы — вклад этой еды. Остальное — из других записей дня.</p></> : <><p>{assessment.reason}</p><div className="nutrition-next"><strong>Что можно попробовать</strong><p>{assessment.next}</p></div><details className="nutrition-quality-details"><summary>Состав и детали</summary><p>{assessment.qualities.join(' · ') || 'Состав пока неизвестен'}</p><p>Порция: {['небольшая','обычная','большая'][meal.portion] ?? 'обычная'}.</p>{meal.notes && <p>Твои детали: {meal.notes}</p>}<p>{assessment.supplies?.fats ? 'Оливковое масло указано в деталях. Количество соли и свободных сахаров пока неизвестно.' : 'Количество соли и свободных сахаров, вид масла по снимку не установлены. Их можно указать через «Уточнить».'}</p></details></>}
        <AssessmentMethod />
      </>}
    </section>
    {pendingEdits && <p className="nutrition-edit-note">Изменения ещё не учтены. Обнови анализ, когда закончишь уточнения.</p>}
  </section>;
}
