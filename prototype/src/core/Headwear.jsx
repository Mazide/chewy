import { useContext, useId } from 'react';
import { StudyContentContext } from './StudyMedia.jsx';
import { SANDBOX_LAYERS } from './sandbox-assets.js';
import imageBounds from './sandbox-image-bounds.js';
import './headwear.css';

const LABELS = { 'hat-bucket': 'Панама у берега', 'hat-trail': 'Походная шляпа' };

// Draft vector accessories share the original hero's thin outline and flat fills.
function HatArtwork({ id }) {
  if (id === 'hat-bucket') return <g stroke="#565443" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round">
    <path d="M28 49L37 17Q67 7 100 17L111 49Q72 63 28 49Z" fill="#9cb8af" />
    <path d="M34 37Q70 47 105 37L109 48Q70 59 30 48Z" fill="#c9d5bd" />
    <path d="M28 46Q67 59 111 46L131 62Q112 76 75 74Q38 75 9 64Z" fill="#b6cbbc" />
    <path d="M22 63Q72 80 119 62" fill="none" strokeWidth="1.2" />
    <path d="M42 23L39 34M95 22L99 34" fill="none" stroke="#748d80" strokeWidth="1.1" />
  </g>;
  if (id === 'hat-trail') return <g stroke="#565443" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round">
    <path d="M30 49L37 16Q45 8 65 19Q83 4 101 15L111 49Z" fill="#c5ae78" />
    <path d="M35 36Q72 47 106 36L111 49Q70 61 30 49Z" fill="#6b8166" />
    <path d="M29 47Q67 61 110 47Q121 42 134 50L128 66Q102 79 72 73Q41 78 11 64L7 52Q19 44 29 47Z" fill="#d1bb88" />
    <path d="M16 60Q44 70 71 67Q103 73 124 61M48 21L45 32M89 20L95 32" fill="none" strokeWidth="1.2" />
    <path d="M103 36Q109 21 119 21Q119 31 107 41Z" fill="#92a57b" />
  </g>;
  return null;
}

export function Headwear({ id, className = '' }) {
  if (!LABELS[id]) return null;
  return <svg className={`headwear ${className}`} viewBox="0 0 140 90" role="img" aria-label={LABELS[id]} data-headwear={id}>
    <HatArtwork id={id} />
  </svg>;
}

export function HeroAppearance({ headwearId = null, className = '' }) {
  const content = useContext(StudyContentContext);
  const clipId = `headwear-hero-${useId().replaceAll(':', '')}`;
  const bounds = imageBounds.hero;
  const headwear = LABELS[headwearId] ? headwearId : null;
  const label = headwear ? `Чуви · ${LABELS[headwear]}` : 'Чуви';
  return <div className={`study-media study-media-hero hero-appearance${content ? ' study-media-content' : ''} ${className}`} role="img" aria-label={label} data-headwear={headwear ?? 'none'}>
    {!content ? <span>{label}</span> : <svg viewBox={`0 0 ${bounds.width} ${bounds.height}`} preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <defs><clipPath id={clipId}><rect width={bounds.width} height={bounds.height} /></clipPath></defs>
      <image href={SANDBOX_LAYERS.find(layer => layer.id === 'hero').src} x={-bounds.x} y={-bounds.y} width={bounds.sourceWidth} height={bounds.sourceHeight} clipPath={`url(#${clipId})`} />
      {headwear && <g transform="translate(2 -8) scale(.95 .75)"><HatArtwork id={headwear} /></g>}
    </svg>}
  </div>;
}
