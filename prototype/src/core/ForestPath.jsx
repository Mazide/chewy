import { useEffect, useRef, useState } from 'react';
import { StudyMedia } from './StudyMedia.jsx';
import { HeroAppearance } from './Headwear.jsx';
import { DAY_PHASES, JOURNEY_BIOMES, JOURNEY_STOPS, JOURNEY_REGIONS, JOURNEY_WORLD_HEIGHT } from './journey-world.js';
import { formatJourneyDay } from './journey-history.js';
import './forest-path.css';

// The illustrated terrain and all route coordinates share this fixed world space.
const route = [{x:50,y:100},...JOURNEY_STOPS,{x:50,y:0}];
const road = route.map((point,index) => {
  if (!index) return `M${point.x * 10} ${point.y * JOURNEY_WORLD_HEIGHT / 100}`;
  const previous = route[index-1], middle = (point.y+previous.y)*JOURNEY_WORLD_HEIGHT/200;
  return `C${previous.x*10} ${middle},${point.x*10} ${middle},${point.x*10} ${point.y*JOURNEY_WORLD_HEIGHT/100}`;
}).join(' ');

export function ForestPath({ state, progress: earnedSteps, phase, onCamp, onAdd, historyDays = [], todayKey, selectedStop, initialDayKey, onSelectStop, onOpenDay, onExplore, headwearId }) {
  // The sample map is finite; earned days remain uncapped in the session.
  const progress = Math.max(0, Math.min(JOURNEY_STOPS.length - 1, earnedSteps));
  const [localSelected, setLocalSelected] = useState(progress);
  const selected = selectedStop ?? localSelected;
  const selectStop = index => { setLocalSelected(index); onSelectStop?.(index); };
  const [selectedDay, setSelectedDay] = useState(initialDayKey ?? null);
  const scroll = useRef(null);
  const dayButton = useRef(null);
  const current = JOURNEY_STOPS[progress];
  const chosen = JOURNEY_STOPS[selected] ?? current;
  const chosenRef = useRef(chosen);
  useEffect(() => { chosenRef.current = chosen; }, [chosen]);
  const stopDays = historyDays.filter(day => day.stopIndex === selected);
  const dayKey = stopDays.some(day => day.dayKey === selectedDay) ? selectedDay : stopDays[0]?.dayKey;
  const firstMeeting = state === 'first' && !historyDays.length;
  const scrollToStop = (stop, behavior = 'smooth') => {
    const element = scroll.current;
    if (!element) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollTo({top:element.scrollHeight * stop.y / 100 - element.clientHeight*.46, behavior:reduced ? 'auto' : behavior});
  };
  useEffect(() => {
    // On returning from a day, restore the inspected stop, not a new position.
    scrollToStop(chosen, 'auto');
    if (selectedStop != null) dayButton.current?.focus({ preventScroll: true });
    const observer = new ResizeObserver(() => scrollToStop(chosenRef.current, 'auto'));
    if (scroll.current) observer.observe(scroll.current);
    return () => observer.disconnect();
  }, [progress]);
  const description = selected > progress ? 'Дальше по дороге. Твой лагерь пока на текущей стоянке.' : selected < progress ? 'Здесь вы уже были вместе.' : firstMeeting ? 'Первый снимок начнёт вашу историю.' : `${JOURNEY_BIOMES[current.biome].name}. ${DAY_PHASES[phase]} в твоём лагере.`;

  return <section className={`forest-path forest-time-${phase}`} aria-label="Большая дорога по биомам">
    <div ref={scroll} className="forest-path-scroll" tabIndex={0} aria-label="Дорога. Прокручивай, чтобы увидеть другие места">
      <div className="forest-path-world" style={{aspectRatio:`1000 / ${JOURNEY_WORLD_HEIGHT}`}}>
        <div className="forest-path-background" aria-hidden="true">
          {JOURNEY_REGIONS.map((region,index) => <img key={region.id} className={`forest-path-terrain${index ? ' forest-terrain-blend' : ''}`} src={region.map} alt="" draggable={false} style={{top:`${(JOURNEY_REGIONS.length-1-index)*100/JOURNEY_REGIONS.length}%`,height:`${(index ? 104 : 100)/JOURNEY_REGIONS.length}%`,zIndex:index}} />)}
        </div>
        <svg className="forest-path-road" viewBox={`0 0 1000 ${JOURNEY_WORLD_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true"><path className="forest-road-edge" d={road} /><path className="forest-road-sand" d={road} /><path className="forest-road-footprints" d={road} /></svg>
        <div className="forest-path-stops" role="group" aria-label="Стоянки на дороге">
          {JOURNEY_STOPS.map((stop,index) => {
            const today = index === progress, future = index > progress;
            const hasDays = historyDays.some(day => day.stopIndex === index);
            return <button type="button" key={stop.name} className={`forest-path-stop ${today?'forest-stop-today':future?'forest-stop-future':'forest-stop-past'}`} style={{left:`${stop.x}%`,top:`${stop.y}%`}} data-stop-index={index} aria-label={`${stop.name}${today?' · твой лагерь':future?' · впереди':''}${hasDays?' · есть записи дней':''}`} aria-pressed={selected === index} onClick={() => { selectStop(index); setSelectedDay(null); }}>
              <span className="forest-stop-scene" aria-hidden="true"><span className="forest-stop-ground" />
                {today ? <><StudyMedia kind="tent" className="forest-stop-tent" /><HeroAppearance headwearId={headwearId} className="forest-stop-hero" /><StudyMedia kind={firstMeeting?'camp-stones':'fire'} className="forest-stop-fire" /></> : future ? <span className="forest-waystone" /> : <StudyMedia kind="fire" className="forest-stop-fire" />}
              </span>
              <span className="forest-stop-label"><strong>{today?'Твой лагерь':stop.name}</strong>{today && <small>{stop.name}</small>}</span>
            </button>;
          })}
        </div>
      </div>
    </div>
    <header className="forest-path-header"><button type="button" className="forest-path-back" aria-label="В лагерь" onClick={onCamp}>←</button><div><h1>Твой путь</h1><p>Листай дорогу вверх и вниз</p></div><button type="button" className="forest-path-locate" aria-label="Показать мою стоянку" onClick={() => {selectStop(progress);setSelectedDay(null);scrollToStop(current);}}>⌖</button></header>
    <footer className="forest-path-note"><div aria-live="polite"><h2>{selected === progress?'Ты здесь':chosen.name}</h2><p>{description}</p></div>
      {stopDays.length > 0 && onOpenDay ? <>
        <label className="forest-history-date">День на стоянке<select value={dayKey} onChange={event => setSelectedDay(event.target.value)}>{stopDays.map(day => <option key={day.dayKey} value={day.dayKey}>{formatJourneyDay(day.dayKey)}{day.dayKey === todayKey ? ' · сегодня' : ''}</option>)}</select></label>
        <button ref={dayButton} type="button" className="study-primary" onClick={() => onOpenDay(dayKey)}>Открыть день</button>
      </> : <button type="button" className="study-primary" onClick={firstMeeting && selected === progress ? onAdd : onCamp}>{firstMeeting && selected === progress?'Добавить еду':'К моему лагерю'}</button>}
      {selected === progress && onExplore && <button type="button" className="forest-explore" onClick={onExplore}>Исследовать рядом</button>}
    </footer>
  </section>;
}
