import { useEffect, useRef, useState } from 'react';
import { StudyMedia } from './StudyMedia.jsx';
import { DAY_PHASES, JOURNEY_BIOMES, JOURNEY_STOPS, JOURNEY_REGIONS, JOURNEY_WORLD_HEIGHT } from './journey-world.js';
import './forest-path.css';

// The illustrated terrain and all route coordinates share this fixed world space.
const route = [{x:50,y:100},...JOURNEY_STOPS,{x:50,y:0}];
const road = route.map((point,index) => {
  if (!index) return `M${point.x * 10} ${point.y * JOURNEY_WORLD_HEIGHT / 100}`;
  const previous = route[index-1], middle = (point.y+previous.y)*JOURNEY_WORLD_HEIGHT/200;
  return `C${previous.x*10} ${middle},${point.x*10} ${middle},${point.x*10} ${point.y*JOURNEY_WORLD_HEIGHT/100}`;
}).join(' ');

export function ForestPath({ state, progress, phase, onCamp, onAdd }) {
  const [selected, setSelected] = useState(progress);
  const scroll = useRef(null);
  const current = JOURNEY_STOPS[progress];
  const chosen = JOURNEY_STOPS[selected];
  const returnToStop = (behavior = 'smooth') => {
    const element = scroll.current;
    if (!element) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollTo({top:element.scrollHeight * current.y / 100 - element.clientHeight*.58, behavior:reduced ? 'auto' : behavior});
  };
  useEffect(() => {
    setSelected(progress);
    returnToStop('auto');
    const observer = new ResizeObserver(() => returnToStop('auto'));
    if (scroll.current) observer.observe(scroll.current);
    return () => observer.disconnect();
  }, [progress]);
  const description = selected > progress ? 'Дальше по дороге. Твой лагерь пока на текущей стоянке.' : selected < progress ? state === 'return' && selected === progress-1 ? 'Тихая остановка. Пройденный путь остаётся с тобой.' : 'Здесь вы уже были вместе.' : state === 'first' ? 'Первый снимок начнёт вашу историю.' : `${JOURNEY_BIOMES[current.biome].name}. ${DAY_PHASES[phase]} в твоём лагере.`;

  return <section className={`forest-path forest-time-${phase}`} aria-label="Большая дорога по биомам">
    <div ref={scroll} className="forest-path-scroll" tabIndex={0} aria-label="Дорога. Прокручивай, чтобы увидеть другие места">
      <div className="forest-path-world" style={{aspectRatio:`1000 / ${JOURNEY_WORLD_HEIGHT}`}}>
        <div className="forest-path-background" aria-hidden="true">
          {JOURNEY_REGIONS.map((region,index) => <img key={region.id} className={`forest-path-terrain${index ? ' forest-terrain-blend' : ''}`} src={region.map} alt="" draggable={false} style={{top:`${(JOURNEY_REGIONS.length-1-index)*100/JOURNEY_REGIONS.length}%`,height:`${(index ? 104 : 100)/JOURNEY_REGIONS.length}%`,zIndex:index}} />)}
        </div>
        <svg className="forest-path-road" viewBox={`0 0 1000 ${JOURNEY_WORLD_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true"><path className="forest-road-edge" d={road} /><path className="forest-road-sand" d={road} /><path className="forest-road-footprints" d={road} /></svg>
        <div className="forest-path-stops" role="group" aria-label="Стоянки на дороге">
          {JOURNEY_STOPS.map((stop,index) => {
            const today = index === progress, future = index > progress, quiet = state === 'return' && index === progress-1;
            return <button type="button" key={stop.name} className={`forest-path-stop ${today?'forest-stop-today':future?'forest-stop-future':'forest-stop-past'}`} style={{left:`${stop.x}%`,top:`${stop.y}%`}} aria-label={`${stop.name}${today?' · твой лагерь':future?' · впереди':''}`} aria-pressed={selected === index} onClick={() => setSelected(index)}>
              <span className="forest-stop-scene" aria-hidden="true"><span className="forest-stop-ground" />
                {today ? <><StudyMedia kind="tent" className="forest-stop-tent" /><StudyMedia kind="hero" className="forest-stop-hero" /><StudyMedia kind={state === 'first'?'camp-stones':'fire'} className="forest-stop-fire" /></> : future ? <span className="forest-waystone" /> : <StudyMedia kind={quiet?'embers':'fire'} className="forest-stop-fire" />}
              </span>
              <span className="forest-stop-label"><strong>{today?'Твой лагерь':stop.name}</strong>{today && <small>{stop.name}</small>}</span>
            </button>;
          })}
        </div>
      </div>
    </div>
    <header className="forest-path-header"><button type="button" className="forest-path-back" aria-label="В лагерь" onClick={onCamp}>←</button><div><h1>Твой путь</h1><p>Листай дорогу вверх и вниз</p></div><button type="button" className="forest-path-locate" aria-label="Показать мою стоянку" onClick={() => {setSelected(progress);returnToStop();}}>⌖</button></header>
    <footer className="forest-path-note" aria-live="polite"><div><h2>{selected === progress?'Ты здесь':chosen.name}</h2><p>{description}</p></div><button type="button" className="study-primary" onClick={state === 'first' && selected === progress ? onAdd : onCamp}>{state === 'first' && selected === progress?'Добавить еду':'К моему лагерю'}</button></footer>
  </section>;
}
