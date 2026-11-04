import { useContext, useId } from 'react';
import { StudyContentContext, StudyMedia } from './StudyMedia.jsx';
import growthBounds from './camp-growth-bounds.js';
import './garden-appearance.css';

const APPEARANCES = {
  'garden-base': { label: 'Сад', stage: 'initial' },
  'garden-lush': { label: 'Пышный сад', stage: 'developed' },
  flowers: { label: 'Цветы' },
  'garden-bloom': { label: 'Цветник' },
};

export function GardenAppearance({ appearance = 'garden-base', className = '' }) {
  const content = useContext(StudyContentContext);
  const clipId = `garden-${useId().replaceAll(':', '')}`;
  const key = Object.hasOwn(APPEARANCES, appearance) ? appearance : 'garden-base';
  const { label, stage } = APPEARANCES[key];
  const bounds = stage ? growthBounds[stage].garden : null;

  return <div className={`study-media garden-appearance${content ? ' study-media-content' : ''} ${className}`} data-garden-appearance={key} role="img" aria-label={label}>
    {!content ? <span>{label}</span> : bounds ? <svg viewBox={`0 0 ${bounds.width} ${bounds.height}`} preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <defs><clipPath id={clipId}><rect width={bounds.width} height={bounds.height} /></clipPath></defs>
      <image href={`/assets/camp-growth/${stage}-v1.png`} x={-bounds.x} y={-bounds.y} width={bounds.sourceWidth} height={bounds.sourceHeight} clipPath={`url(#${clipId})`} />
    </svg> : <div className="garden-appearance-flowers" aria-hidden="true">
      <StudyMedia kind="flowers" label="Цветы" className="garden-appearance-flower" />
      {key === 'garden-bloom' && <StudyMedia kind="flowers" label="Цветы" className="garden-appearance-flower" />}
    </div>}
  </div>;
}
