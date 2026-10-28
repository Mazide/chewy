import { createContext, useContext, useId } from 'react';
import { SANDBOX_LAYERS } from './sandbox-assets.js';
import campBounds from './sandbox-image-bounds.js';
import studyBounds from './study-image-bounds.json';
import { samplePhoto } from './study-content.js';

export const StudyContentContext = createContext(false);

export function StudyMedia({ kind = 'hero', label, className = '' }) {
  const content = useContext(StudyContentContext);
  const clipId = useId().replaceAll(':','');
  const existing = SANDBOX_LAYERS.find(layer => layer.id === kind);
  const bounds = studyBounds[kind] ?? campBounds[kind];
  const src = studyBounds[kind] ? `/assets/screen-studies/${kind}.png` : existing?.src;
  const isPhoto = ['meal','breakfast','chicken'].includes(kind);
  return <div className={`study-media study-media-${kind}${content ? ' study-media-content' : ''} ${className}`} role="img" aria-label={label ?? kind}>
    {!content ? <span>{label ?? kind}</span> : isPhoto ? <img src={samplePhoto(kind).src} alt="" className="study-photo" /> : src && bounds ? <svg viewBox={`0 0 ${bounds.width} ${bounds.height}`} preserveAspectRatio="xMidYMax meet" aria-hidden="true"><defs><clipPath id={clipId}><rect width={bounds.width} height={bounds.height} /></clipPath></defs><image href={src} x={-bounds.x} y={-bounds.y} width={bounds.sourceWidth} height={bounds.sourceHeight} clipPath={`url(#${clipId})`} /></svg> : kind === 'camera' ? <svg viewBox="0 0 100 80" aria-hidden="true"><path d="M12 23H29L36 13H64L71 23H88V68H12Z" fill="#b9c98b" stroke="#38594b" strokeWidth="3" /><circle cx="50" cy="44" r="15" fill="#f3eedc" stroke="#38594b" strokeWidth="3" /><path d="M20 70L82 12" stroke="#38594b" strokeWidth="4" /></svg> : kind === 'not-food' ? <svg viewBox="0 0 100 100" aria-hidden="true"><path d="M28 20H68V78Q48 88 28 78Z M68 28Q97 28 92 48Q87 64 68 56" fill="#c8a77b" stroke="#29382e" strokeWidth="3" /><path d="M35 34H60M35 44H56" stroke="#f3eedc" strokeWidth="3" /></svg> : <svg viewBox="0 0 100 70" aria-hidden="true"><ellipse cx="50" cy="52" rx="40" ry="12" fill="#a9afa3" /><path d="M23 50L77 63M26 63L75 48" stroke="#735c43" strokeWidth="10" strokeLinecap="round" />{kind === 'embers' && <circle cx="50" cy="52" r="6" fill="#d1a76b" />}</svg>}
  </div>;
}
