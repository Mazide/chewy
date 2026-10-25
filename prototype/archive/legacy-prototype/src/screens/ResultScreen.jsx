import { useEffect, useState } from 'react';
import { PhoneFrame } from '../components/PhoneFrame.jsx';
import { Hero } from '../components/Hero.jsx';
import { SpeechBubble } from '../components/SpeechBubble.jsx';
import { WoodBanner, ChunkyButton, CampBackdrop, CoinBadge } from '../components/chrome.jsx';
import { PlateRing } from '../components/PlateRing.jsx';
import { plateFractions } from '../data/game.js';

/**
 * ResultScreen — hero reaction after feeding. Shows the DAY plate with the
 * meal's contribution animating in (teaches "fill what the day still needs"
 * without a single word). Verdict as a phrase, no numbers, no shame.
 * Special cases: not-food (playful, no log), low confidence, capped 5th meal.
 */
export function ResultScreen({ result, onCollect }) {
  const isMeal = result?.kind === 'meal';
  const from = isMeal ? plateFractions(result.plateBefore) : null;
  const to = isMeal ? plateFractions(result.plateAfter) : null;
  const [plate, setPlate] = useState(from);

  // animate the delta: day plate fills from before → after
  useEffect(() => {
    if (!isMeal) return;
    setPlate(from);
    const start = performance.now();
    const delay = 350; // let the hero land first, then the plate fills
    const dur = 900;
    let raf;
    const tick = (now) => {
      const t = Math.min(1, Math.max(0, (now - start - delay) / dur));
      const e = 1 - (1 - t) ** 3; // ease-out
      setPlate({
        veg: from.veg + (to.veg - from.veg) * e,
        protein: from.protein + (to.protein - from.protein) * e,
        grain: from.grain + (to.grain - from.grain) * e,
      });
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  if (!result) return null;

  const heroStatus = result.reaction === 'happy' ? 'happy' : 'idle';

  return (
    <PhoneFrame>
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CampBackdrop blur={3} dim={0.25} />

        <div style={{ position: 'relative', zIndex: 1, paddingTop: 48 }}>
          <WoodBanner>{result.verdict}</WoodBanner>
        </div>

        <div style={{ position: 'relative', zIndex: 1, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <div style={{ position: 'relative', transform: 'scale(.72)', marginTop: -44 }}>
            <Hero status={heroStatus} showBubble={false} />
            {result.reaction === 'sluggish' && (
              <span style={{ position: 'absolute', top: 8, right: -6, fontSize: 40 }}>💤</span>
            )}
            {result.reaction === 'unsure' && (
              <span style={{ position: 'absolute', top: 8, right: -6, fontSize: 36 }}>❓</span>
            )}
          </div>
          <SpeechBubble text={result.speech} />
        </div>

        {result.kind === 'meal' ? (
          <>
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, paddingBottom: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <PlateRing plate={plate} size={92} />
                <span style={{ font: '600 11px var(--font-round)', color: 'rgba(255,255,255,.85)', textShadow: '0 1px 2px rgba(0,0,0,.5)' }}>
                  {result.lowConfidence ? "today's plate (my best guess)" : "today's plate"}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                <span style={{ font: '700 13px var(--font-round)', color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.5)' }}>
                  {result.preset.emoji} {result.preset.title}
                </span>
                <CoinBadge coins={`+${result.coins}`} />
                {result.slotCapped && (
                  <span style={{ font: '600 11px var(--font-round)', color: 'rgba(255,255,255,.8)', textShadow: '0 1px 2px rgba(0,0,0,.5)', maxWidth: 140, textAlign: 'center' }}>
                    journal never closes — big rewards return tomorrow
                  </span>
                )}
              </div>
            </div>
            <div style={{ position: 'relative', zIndex: 1, display: 'grid', placeItems: 'center', padding: '8px 0 26px' }}>
              <ChunkyButton onClick={onCollect}>Back to camp</ChunkyButton>
            </div>
          </>
        ) : (
          <div style={{ position: 'relative', zIndex: 1, display: 'grid', placeItems: 'center', padding: '14px 0 30px' }}>
            <ChunkyButton onClick={onCollect}>Back to camp</ChunkyButton>
          </div>
        )}
      </div>
    </PhoneFrame>
  );
}
