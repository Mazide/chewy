import { useState } from 'react';
import { PhoneFrame } from '../components/PhoneFrame.jsx';
import { WoodBanner, ChunkyButton } from '../components/chrome.jsx';
import { ANALYSIS_THEMES } from '../data/themes.js';
import { MEAL_PRESETS } from '../data/game.js';

/**
 * AnalyzeScreen — the skinnable food-analysis skeleton.
 * One mechanic: photo window + 3-stop portion + FEED. All dressing
 * (banner text, colors, stop labels, props) comes from ANALYSIS_THEMES.
 * The preset chips stand in for what the camera would see.
 */
export function AnalyzeScreen({ theme = 'tavern', presets = MEAL_PRESETS, onFeed, onBack }) {
  const t = ANALYSIS_THEMES[theme] ?? ANALYSIS_THEMES.tavern;
  const [portion, setPortion] = useState(1); // 0..2 → stop index
  const [presetId, setPresetId] = useState(presets[0]?.id);
  const selected = presets.find((p) => p.id === presetId);

  return (
    <PhoneFrame background={t.bg}>
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', background: t.bg }}>
        {/* theme backdrop art */}
        {t.bgImage && (
          <img
            src={t.bgImage}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }}
          />
        )}
        {/* Banner */}
        <div style={{ position: 'relative', zIndex: 1, paddingTop: 48 }}>
          <WoodBanner bg={t.bannerBg} color={t.bannerColor}>{t.banner}</WoodBanner>
        </div>

        {/* Food window */}
        <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'grid', placeItems: 'center', padding: 16 }}>
          <div style={{ position: 'relative' }}>
            <img
              src="/assets/camera_placeholder.jpg"
              alt=""
              style={{
                width: 220,
                height: 220,
                objectFit: 'cover',
                borderRadius: '50%',
                border: '4px solid var(--chewy-ink)',
                boxShadow: '0 10px 24px rgba(0,0,0,.5), inset 0 0 30px rgba(0,0,0,.3)',
              }}
            />
            {/* themed ring frame around the camera window */}
            {t.frameImage && (
              <img
                src={t.frameImage}
                alt=""
                style={{ position: 'absolute', inset: -44, width: 'calc(100% + 88px)', pointerEvents: 'none', zIndex: 2 }}
              />
            )}
            {t.reticle && !t.frameImage && (
              <div
                style={{
                  position: 'absolute',
                  inset: 40,
                  borderRadius: '50%',
                  border: '3px dashed rgba(255,255,255,.7)',
                  display: 'grid',
                  placeItems: 'center',
                  font: '800 26px var(--font-round)',
                  color: 'rgba(255,255,255,.85)',
                }}
              >
                +
              </div>
            )}
            {/* hero peek + theme prop: return as sprite/art once pack E lands */}
            {/* what the camera "sees" */}
            <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 84, filter: 'drop-shadow(0 4px 6px rgba(0,0,0,.45))' }}>
              {selected?.emoji}
            </span>
          </div>
        </div>

        {/* prototype-only: pick what the camera sees */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', padding: '0 12px 10px' }}>
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => setPresetId(p.id)}
              title={p.title}
              style={{
                fontSize: 22,
                lineHeight: 1,
                padding: 6,
                borderRadius: 10,
                border: `2px solid ${p.id === presetId ? t.accent : 'rgba(255,255,255,.25)'}`,
                background: p.id === presetId ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.18)',
                cursor: 'pointer',
              }}
            >
              {p.emoji}
            </button>
          ))}
        </div>

        {/* Portion — 3 stops, no numbers */}
        <div style={{ position: 'relative', zIndex: 1, background: t.panelBg, borderTop: '3px solid var(--chewy-ink)', padding: '16px 20px calc(20px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ color: '#fff', font: '700 14px var(--font-round)', textAlign: 'center', textShadow: '0 1px 2px rgba(0,0,0,.4)' }}>
            Portion
          </div>
          <input
            type="range"
            min={0}
            max={2}
            step={1}
            value={portion}
            onChange={(e) => setPortion(Number(e.target.value))}
            style={{ width: '100%', accentColor: t.accent }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,.85)', font: '600 13px var(--font-round)' }}>
            {t.stops.map((s, i) => (
              <span key={s} style={{ opacity: portion === i ? 1 : 0.5, fontWeight: portion === i ? 800 : 600 }}>
                {t.stopIcon} {s}
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
            <ChunkyButton small color="#7a6a55" colorDark="#5d4f3e" onClick={onBack}>
              {t.retake}
            </ChunkyButton>
            <div style={{ flex: 1, display: 'grid' }}>
              <ChunkyButton color={t.accent} colorDark={t.accentDark} onClick={() => onFeed?.({ presetId, portion })}>
                {t.cta}
              </ChunkyButton>
            </div>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}
