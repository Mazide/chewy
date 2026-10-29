import { useEffect, useId, useRef, useState } from 'react';
import { HeroAppearance } from './Headwear.jsx';
import './hero-mirror.css';

export const DEFAULT_HERO_APPEARANCE = {
  base: 'boy', skin: 'peach', hair: 'short', shirt: 'cream', trousers: 'blue',
};

const PALETTES = {
  skin: [
    ['light', 'Светлый', '#f4d8c5'], ['peach', 'Персиковый', '#e8b795'],
    ['bronze', 'Бронзовый', '#bc8663'], ['brown', 'Коричневый', '#8b5a40'],
    ['deep', 'Тёмный', '#573a2b'],
  ],
  shirt: [
    ['cream', 'Молочный', '#eee8cf'], ['sage', 'Шалфей', '#a7b899'],
    ['clay', 'Глина', '#c98870'], ['blue', 'Туман', '#96b2ba'],
    ['rose', 'Вереск', '#bc9aab'],
  ],
  trousers: [
    ['blue', 'Синий', '#4e7087'], ['brown', 'Каштан', '#826651'],
    ['moss', 'Мох', '#667c5a'], ['slate', 'Графит', '#5c6264'],
    ['sand', 'Песок', '#bca782'],
  ],
};

const TABS = [['appearance', 'Внешность'], ['hair', 'Волосы'], ['clothes', 'Одежда']];

function Palette({ field, label, value, onChange }) {
  const colors = PALETTES[field];
  const selected = colors.find(([id]) => id === value);
  return <fieldset className="hero-mirror-palette">
    <legend><span>{label}</span><span className="hero-mirror-color-name" aria-live="polite">{selected?.[1]}</span></legend>
    <div className="hero-mirror-swatches">
      {colors.map(([id, name, color]) => <button key={id} type="button" className="hero-mirror-swatch" aria-label={`${label}: ${name}`} aria-pressed={value === id} title={name} onClick={() => onChange(field, id)}>
        <span className="hero-mirror-color" style={{ backgroundColor: color }} aria-hidden="true" />
        {value === id && <span className="hero-mirror-swatch-mark" aria-hidden="true">✓</span>}
      </button>)}
    </div>
  </fieldset>;
}

// This draft stores choices only. The existing hero artwork stays unchanged.
export function HeroMirror({ value = DEFAULT_HERO_APPEARANCE, onApply, onCancel, headwearId = null }) {
  const [draft, setDraft] = useState(() => ({ ...DEFAULT_HERO_APPEARANCE, ...value }));
  const [tab, setTab] = useState('appearance');
  const heading = useRef(null);
  const panel = useRef(null);
  const id = useId();
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);

  const choose = (field, next) => setDraft(current => ({ ...current, [field]: next }));
  const selectTab = next => {
    setTab(next);
    panel.current?.scrollTo({ top: 0 });
  };

  return <section className="hero-mirror" aria-labelledby={`${id}-heading`}>
    <header className="study-top hero-mirror-heading">
      <button type="button" aria-label="В лагерь" onClick={onCancel}>←</button>
      <h1 id={`${id}-heading`} ref={heading} tabIndex={-1}>Зеркало</h1>
    </header>

    <div className="hero-mirror-room">
      <div className="hero-mirror-frame"><HeroAppearance headwearId={headwearId} /></div>
      <span className="hero-mirror-stand" aria-hidden="true" />
    </div>

    <div className="hero-mirror-tabs" role="group" aria-label="Что изменить">
      {TABS.map(([key, label]) => <button key={key} id={`${id}-${key}`} type="button" aria-pressed={tab === key} aria-controls={`${id}-choices`} onClick={() => selectTab(key)}>{label}</button>)}
    </div>

    <div id={`${id}-choices`} className="hero-mirror-choices" ref={panel} role="region" aria-labelledby={`${id}-${tab}`}>
      {tab === 'appearance' ? <>
        <fieldset className="hero-mirror-options">
          <legend>Пол</legend>
          <div className="hero-mirror-cards">
            {[['boy', 'Мальчик'], ['girl', 'Девочка']].map(([key, label]) => <button key={key} type="button" aria-pressed={draft.base === key} onClick={() => choose('base', key)}><span>{label}</span><span className="hero-mirror-choice-mark" aria-hidden="true">{draft.base === key ? '✓' : ''}</span></button>)}
          </div>
        </fieldset>
        <Palette field="skin" label="Оттенок кожи" value={draft.skin} onChange={choose} />
      </> : tab === 'hair' ? <fieldset className="hero-mirror-options">
        <legend>Причёска</legend>
        <div className="hero-mirror-cards hero-mirror-hair-cards">
          {[['short', 'Короткие'], ['bob', 'Каре'], ['curls', 'Кудри']].map(([key, label]) => <button key={key} type="button" aria-pressed={draft.hair === key} onClick={() => choose('hair', key)}><span>{label}</span><span className="hero-mirror-choice-mark" aria-hidden="true">{draft.hair === key ? '✓' : ''}</span></button>)}
        </div>
      </fieldset> : <>
        <Palette field="shirt" label="Рубашка" value={draft.shirt} onChange={choose} />
        <Palette field="trousers" label="Брюки" value={draft.trousers} onChange={choose} />
      </>}
    </div>

    <footer className="hero-mirror-actions">
      <button type="button" onClick={onCancel}>Отмена</button>
      <button type="button" className="study-primary" onClick={() => onApply({ ...draft })}>Готово</button>
    </footer>
  </section>;
}
