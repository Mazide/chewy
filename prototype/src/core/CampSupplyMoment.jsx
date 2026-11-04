import { useEffect, useState } from 'react';
import { CampSupplyIcon } from './CampSupplyIcon.jsx';
import { CAMP_SUPPLY_METAPHORS } from './camp-supply-metaphors.js';
import './camp-supply-moment.css';

export function CampSupplyMoment({ moment, objects, device }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const remaining = (moment?.createdAt ?? 0) + 4200 - Date.now();
    setVisible(remaining > 0);
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setVisible(false), remaining);
    return () => window.clearTimeout(timer);
  }, [moment]);
  const metaphor = CAMP_SUPPLY_METAPHORS[moment?.metric];
  const target = objects.find(object => object.id === metaphor?.zone);
  const hero = objects.find(object => object.id === 'hero');
  if (!visible || !target || !hero) return null;
  const [x,y,w,h] = target.frame;
  const [hx,hy,hw,hh] = hero.frame;
  // Anchor to the actual layout, including device scaling and user placements.
  const left = (x + w / 2) / device.width * 100;
  const top = (y + h * .25) / device.height * 100;
  return <div key={moment.createdAt} className={`camp-supply-moment camp-supply-moment-${moment.metric}`} role="status" aria-label={`${metaphor.label} — в лагерь Чуви`} style={{ left:`${left}%`, top:`${top}%`, '--supply-travel-x':`${(hx + hw / 2 - x - w / 2) / device.width * 100}cqw`, '--supply-travel-y':`${(hy + hh * .55 - y - h * .25) / device.width * 100}cqw` }}>
    <span className="camp-supply-halo" aria-hidden="true" />
    <CampSupplyIcon metric={moment.metric} className="camp-supply-arrival" />
  </div>;
}
