import { useEffect, useRef, useState } from 'react';
import variants from './variant-motion.json';
import './variant-motion.css';

export const VARIANT_DEFAULTS = { shelter: 'patchwork-tent', pet: 'hedgehog', lamp: 'camping-lantern', hearth: 'stone-campfire' };
export const VARIANT_SLOTS = { workshop: 'shelter', tent: 'shelter', garden: 'garden', pet: 'pet', light: 'lamp', fuel: 'hearth', fire: 'hearth' };
const GROUPS = { shelter: 'Жильё', garden: 'Растения', pet: 'Питомец', lamp: 'Свет', hearth: 'Очаг', background: 'Фон' };

export function VariantMotion({ slug, paused = false }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const item = variants.find(item => item.slug === slug);
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    const sync = () => setPlaying(visible && !paused && !motion.matches && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    if (ref.current) observer.observe(ref.current);
    motion.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => { observer.disconnect(); motion.removeEventListener('change', sync); document.removeEventListener('visibilitychange', sync); };
  }, [slug, paused]);
  if (!item) return null;
  return <img ref={ref} className={`variant-motion${item.group === 'background' ? ' variant-motion-background' : ''}`} data-variant-motion={slug} data-playing={playing && !paused} src={`/assets/variant-motion/${slug}/${playing && !paused ? 'motion.webp' : 'poster.png'}`} width={item.width} height={item.height} alt={item.title} draggable="false" />;
}

export function VariantMotionPicker({ value, onChange }) {
  return <section className="variant-motion-picker"><h2>Анимации лагеря</h2><p>21 вариант для примерки. Выбор заменяет оформление только в этой пробе; покупки и прогресс сохраняются. Стыки петель — черновые.</p>
    {Object.entries(GROUPS).map(([group, label]) => <label key={group}>Анимация · {label}<select value={value[group] ?? ''} onChange={event => onChange({ ...value, [group]: event.target.value })}><option value="">Оформление сессии</option>{variants.filter(item => item.group === group).map(item => <option key={item.slug} value={item.slug}>{item.title}</option>)}</select></label>)}
    <button type="button" onClick={() => onChange({})}>Оформление сессии во всех слотах</button>
    <button type="button" onClick={() => onChange({ ...VARIANT_DEFAULTS })}>Пример анимированного лагеря</button>
  </section>;
}
