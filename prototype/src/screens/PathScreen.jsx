import { useEffect, useRef } from 'react';
import { PhoneFrame } from '../components/PhoneFrame.jsx';
import { WoodBanner, ChunkyButton, CampBackdrop, ScrollPanel } from '../components/chrome.jsx';
import { FIRE_EMOJI, BIOMES, DAYS_PER_BIOME } from '../data/game.js';

/**
 * PathScreen — the whole journey on a parchment map, oldest day first.
 * The landscape changes by biome as TOTAL logged days grow (never rolls back);
 * campfires show how each day went (lit / ember / out) and carry the streak.
 * Beyond today the next biome is teased as a silhouette. No numbers except
 * the streak and its record.
 */
export function PathScreen({ streak = 5, record, days = [], onClose }) {
  const todayRef = useRef(null);
  useEffect(() => {
    todayRef.current?.scrollIntoView({ block: 'center' });
  }, []);

  const chunks = [];
  for (let i = 0; i < days.length; i += DAYS_PER_BIOME) chunks.push(days.slice(i, i + DAYS_PER_BIOME));
  const nextBiome = BIOMES[chunks.length % BIOMES.length];

  return (
    <PhoneFrame>
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CampBackdrop blur={4} dim={0.3} />

        <div style={{ position: 'relative', zIndex: 1, paddingTop: 48, paddingBottom: 18 }}>
          <WoodBanner>HERO'S PATH</WoodBanner>
        </div>

        <div style={{ position: 'relative', zIndex: 1, flex: 1, overflowY: 'auto' }}>
          <ScrollPanel>
            {/* streak: ember pauses it, only 2+ silent days put it out; the record is forever */}
            <div style={{ textAlign: 'center', font: '800 18px var(--font-round)', marginBottom: 4 }}>
              🔥 {streak} days on the road
            </div>
            {record != null && (
              <div style={{ textAlign: 'center', font: '700 13px var(--font-round)', opacity: 0.75, marginBottom: 8 }}>
                🏅 longest journey: {record} days
              </div>
            )}
            <div style={{ textAlign: 'center', fontSize: 11, opacity: 0.6, marginBottom: 14 }}>
              🟠 fire dozed — the journey went on
            </div>

            {/* the trail, biome by biome */}
            {chunks.map((chunk, ci) => {
              const biome = BIOMES[ci % BIOMES.length];
              return (
                <div
                  key={ci}
                  style={{
                    background: biome.tint,
                    borderRadius: 14,
                    padding: '10px 6px 6px',
                    marginBottom: 10,
                  }}
                >
                  <div style={{ textAlign: 'center', font: '800 12px var(--font-round)', letterSpacing: 1, opacity: 0.8, marginBottom: 8 }}>
                    {biome.emoji} {biome.name.toUpperCase()} {biome.emoji}
                  </div>
                  {chunk.map((d, i) => {
                    const idx = ci * DAYS_PER_BIOME + i;
                    const isToday = idx === days.length - 1;
                    return (
                      <div
                        key={idx}
                        ref={isToday ? todayRef : undefined}
                        style={{
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          marginLeft: idx % 2 === 0 ? '12%' : '52%',
                          marginBottom: 12,
                          width: '44%',
                        }}
                      >
                        {i > 0 && (
                          <span style={{ position: 'absolute', top: -12, left: idx % 2 === 0 ? 40 : -30, opacity: 0.45, fontSize: 11, letterSpacing: 3 }}>
                            · · ·
                          </span>
                        )}
                        <span style={{ fontSize: 22 }}>{FIRE_EMOJI[d.fire]}</span>
                        <div>
                          <div style={{ font: '800 12px var(--font-round)' }}>
                            Day {idx + 1} {d.fire === 'lit' && '🚩'}
                          </div>
                          {isToday && <div style={{ fontSize: 11, opacity: 0.7 }}>🧒 hero is here</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* beyond the bend: silhouette of the next biome */}
            <div style={{ textAlign: 'center', padding: '6px 0 4px' }}>
              <div style={{ fontSize: 30, filter: 'blur(2px) grayscale(.9)', opacity: 0.6 }}>{nextBiome.emoji}</div>
              <div style={{ fontSize: 11, opacity: 0.55, fontStyle: 'italic' }}>something new beyond the bend…</div>
            </div>
          </ScrollPanel>
        </div>

        <div style={{ position: 'relative', zIndex: 1, display: 'grid', placeItems: 'center', padding: '12px 0 30px' }}>
          <ChunkyButton onClick={onClose}>Back to camp</ChunkyButton>
        </div>
      </div>
    </PhoneFrame>
  );
}
