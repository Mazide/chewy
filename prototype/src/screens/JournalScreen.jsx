import { PhoneFrame } from '../components/PhoneFrame.jsx';
import { MealLogRow } from '../components/MealLogRow.jsx';
import { WoodBanner, ChunkyButton, CampBackdrop, ScrollPanel, IconOrb } from '../components/chrome.jsx';
import { PlateRing } from '../components/PlateRing.jsx';

const MOOD_FACE = { happy: '😊', content: '🙂', full: '😌', sluggish: '😴', unsure: '🤔', idle: '🙂' };
const MOOD_TEXT = {
  happy: 'feels great',
  content: 'is doing fine',
  full: 'is cozy and full',
  sluggish: 'is a bit drowsy',
  unsure: 'is not quite sure',
  idle: 'waits by the fire',
};

/**
 * JournalScreen — today's log as an unrolled scroll over the blurred camp.
 * Hero mood, day plate sectors, meal entries. Zero numbers.
 * Entries can be deleted, but the day never rolls back: plate, coins and
 * streak stay (sticky day — no retro-punishment, no delete-refeed farm).
 */
export function JournalScreen({ heroName = 'Chewy', meals = [], plate, mood = 'idle', onDelete, onClose, onPath }) {
  return (
    <PhoneFrame>
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CampBackdrop blur={4} dim={0.3} />

        <div style={{ position: 'relative', zIndex: 1, paddingTop: 48, paddingBottom: 18 }}>
          <WoodBanner>TODAY'S JOURNAL</WoodBanner>
        </div>

        <div style={{ position: 'relative', zIndex: 1, flex: 1, overflowY: 'auto', paddingBottom: 12 }}>
          <ScrollPanel art="scroll">
            {/* mood + day plate */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
              <span style={{ fontSize: 42 }}>{MOOD_FACE[mood] ?? MOOD_FACE.idle}</span>
              <div style={{ flex: 1 }}>
                <div style={{ font: '800 14px var(--font-round)' }}>
                  {heroName} {MOOD_TEXT[mood] ?? MOOD_TEXT.idle}
                </div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>The plate fills as you feed him</div>
              </div>
              <PlateRing plate={plate} size={56} />
            </div>

            {/* meal log — ink entries on parchment; deleting never rolls the day back */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {meals.length === 0 ? (
                <div style={{ textAlign: 'center', opacity: 0.6, padding: '14px 0' }}>
                  The page is blank — feed your hero!
                </div>
              ) : (
                meals.map((m, i) => (
                  <div key={i} style={{ position: 'relative', filter: 'sepia(.4)' }}>
                    <MealLogRow {...m} />
                    {onDelete && (
                      <button
                        onClick={() => onDelete(i)}
                        title="Cross it out (the day stays as lived)"
                        style={{
                          position: 'absolute',
                          top: '50%',
                          right: -6,
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          fontSize: 14,
                          opacity: 0.55,
                          cursor: 'pointer',
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollPanel>
        </div>

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'center', gap: 14, alignItems: 'center', padding: '12px 0 30px' }}>
          <IconOrb icon="/assets/gen/packA/orb_compass.png" onClick={onPath} />
          <ChunkyButton onClick={onClose}>Back to camp</ChunkyButton>
        </div>
      </div>
    </PhoneFrame>
  );
}
