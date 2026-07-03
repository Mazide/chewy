import { useState } from 'react';
import { PhoneFrame } from '../components/PhoneFrame.jsx';
import { PortionSlider } from '../components/PortionSlider.jsx';

/**
 * AddFoodScreen — mirrors AddFoodView.swift.
 * Dark camera screen, "ANALYZE ESSENCE" banner, portion slider, FEED! CTA.
 */
export function AddFoodScreen({ analyzing = false, onFeed }) {
  const [portion, setPortion] = useState(50);

  return (
    <PhoneFrame background="var(--chewy-dark)">
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Camera viewfinder */}
        <div
          style={{
            flex: 1,
            position: 'relative',
            display: 'grid',
            placeItems: 'center',
            overflow: 'hidden',
            background: '#100d0a',
          }}
        >
          <img
            src="/assets/camera_placeholder.jpg"
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />

          <div
            style={{
              position: 'absolute',
              top: 44,
              font: '700 14px var(--font-round)',
              color: '#fff',
              padding: '8px 16px',
              background: 'rgba(255,255,255,.12)',
              borderRadius: 'var(--radius-sm)',
              letterSpacing: 0.5,
            }}
          >
            ANALYZE ESSENCE
          </div>
        </div>

        {/* Toolbar */}
        <div
          style={{
            background: 'var(--chewy-dark-2)',
            padding: '18px 16px calc(18px + env(safe-area-inset-bottom))',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <PortionSlider value={portion} onChange={setPortion} />

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              style={{
                flex: '0 0 90px',
                height: 52,
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'rgba(255,255,255,.12)',
                color: '#fff',
                font: '600 15px var(--font-round)',
                cursor: 'pointer',
              }}
            >
              Gallery
            </button>
            <button
              onClick={() => onFeed?.(portion)}
              disabled={analyzing}
              style={{
                flex: 1,
                height: 52,
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: analyzing ? 'default' : 'pointer',
                color: '#fff',
                font: '800 18px var(--font-round)',
                letterSpacing: 0.5,
                background: analyzing
                  ? 'rgba(255,138,61,.4)'
                  : 'linear-gradient(180deg, var(--chewy-orange), var(--chewy-orange-dark))',
                boxShadow: analyzing ? 'none' : '0 6px 14px rgba(255,138,61,.4)',
              }}
            >
              {analyzing ? '...' : 'FEED!'}
            </button>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}
