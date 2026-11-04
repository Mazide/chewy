import { useId } from 'react';
import bounds from './camp-growth-bounds.js';
import { CampSprite } from './CampLife.jsx';

// Atlas-space placement only: playback uses the generated frames at their original FPS.
const PARTS = {
  initial: {
    workshop: {
      box: [123, 76, 672, 380],
      // Preserve the original materials in front of the replacement tent.
      foreground: 'M167 477 L207 455 L207 412 L226 403 L222 373 L237 362 L257 382 L250 341 L266 330 L282 333 L297 359 L302 348 L312 347 L323 368 Q331 341 350 342 L434 354 Q466 357 466 405 L475 410 L475 473 L510 451 L514 482 L487 516 L426 526 L343 537 L208 511 L172 515Z',
    },
    fuel: {
      box: [390, 636, 200, 270],
      // Replace only the flame. The atlas owns the logs and the entire stone ring.
      remove: 'M500 640 C465 647 442 671 448 716 L431 702 C439 736 404 747 410 788 C412 810 431 829 461 831 L523 831 C557 825 573 800 573 763 L557 781 C562 748 545 718 531 697 C533 723 520 736 513 738 C516 691 480 684 500 640Z',
      flameBottom: 833,
      foreground: 'M397 834 Q397 813 415 817 L447 828 L489 814 L528 830 L557 819 Q577 817 578 838 L578 940 H397Z',
    },
    light: { box: [1142, 110, 114, 209], glow: [1199, 225, 24, 30] },
  },
  developed: {
    // The standalone tent cannot replace a tent integrated with a canopy and table.
    workshop: {},
    fuel: {
      box: [354, 763, 147, 200],
      remove: 'M392 780 C375 795 385 824 391 841 L375 826 C378 847 363 854 367 878 Q370 905 400 907 H454 Q482 901 483 879 L476 831 L458 853 L450 821Z',
      flameBottom: 909,
      foreground: 'M337 910 Q335 893 354 896 L393 904 Q416 889 432 905 L476 891 Q499 887 503 909 L503 995 H337Z M390 676 H526 V825 H390Z',
    },
    light: { box: [1028, 113, 184, 284], glow: [1121, 291, 30, 40] },
  },
};

export function CampGrowthMotion({ kind, stage = 'initial', lantern = false, paused = false }) {
  const id = `growth-motion-${useId().replaceAll(':', '')}`;
  const b = bounds[stage][kind];
  const part = PARTS[stage][kind];
  const image = <image href={`/assets/camp-growth/${stage}-v1.png`} width="1536" height="1024" />;
  const sprite = kind === 'workshop' ? (stage === 'initial' ? 'tent' : null) : kind === 'fuel' ? 'fire' : lantern ? 'lantern' : null;
  return <div className={`sandbox-sprite-crop camp-growth-motion${paused ? ' camp-growth-motion-paused' : ''}`} data-growth-motion={kind}>
    <svg viewBox={`${b.x} ${b.y} ${b.width} ${b.height}`} preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <defs>
        <mask id={`${id}-base`} maskUnits="userSpaceOnUse" x="0" y="0" width="1536" height="1024">
          <rect width="1536" height="1024" fill="white" />
          {part.remove && <path d={part.remove} fill="black" stroke="black" strokeWidth={kind === 'fuel' ? 8 : 0} />}
          {kind === 'light' && lantern && <rect x={part.box[0]} y={part.box[1]} width={part.box[2]} height={part.box[3]} fill="black" />}
        </mask>
        {part.flameBottom && <clipPath id={`${id}-flame`}><rect x={part.box[0]} y={part.box[1]} width={part.box[2]} height={part.flameBottom - part.box[1]} /></clipPath>}
        {part.foreground && <clipPath id={`${id}-front`}><path d={part.foreground} /></clipPath>}
      </defs>
      {!(kind === 'workshop' && stage === 'initial') && <g mask={`url(#${id}-base)`}>{image}</g>}
      {sprite && <g clipPath={part.flameBottom ? `url(#${id}-flame)` : undefined}><foreignObject x={part.box[0]} y={part.box[1]} width={part.box[2]} height={part.box[3]}>
        <CampSprite kind={sprite} paused={paused} className={kind === 'fuel' ? 'camp-flame-only' : ''} />
      </foreignObject></g>}
      {part.foreground && <g clipPath={`url(#${id}-front)`}>{image}</g>}
      {kind === 'light' && !lantern && <ellipse className="camp-growth-lamp-glow" cx={part.glow[0]} cy={part.glow[1]} rx={part.glow[2]} ry={part.glow[3]} fill="#fff5bc" />}
    </svg>
  </div>;
}
