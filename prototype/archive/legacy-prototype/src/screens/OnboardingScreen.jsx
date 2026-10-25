import { useState } from 'react';
import { PhoneFrame } from '../components/PhoneFrame.jsx';
import { Hero } from '../components/Hero.jsx';
import { SpeechBubble } from '../components/SpeechBubble.jsx';
import { WoodBanner, ChunkyButton, CampBackdrop } from '../components/chrome.jsx';

/**
 * OnboardingScreen — first launch: meet the traveler, name him,
 * one card for the loop, one honesty card, then the push question —
 * asked by the hero himself, not by the system (the iOS permission
 * alert comes after, only if he said yes).
 */
const CARDS = [
  {
    banner: 'A TRAVELER BY THE FIRE',
    art: '🔥🧒',
    text: 'He camps right here in your pocket. What should we call him?',
    nameInput: true,
    cta: "That's him!",
  },
  {
    banner: 'HOW IT WORKS',
    art: '📷 → 😊 → 🪙',
    text: 'Snap your meal — he tastes it and reacts. Coins buy comfy things for the camp.',
    cta: 'Got it',
  },
  {
    banner: 'NO JUDGING. EVER.',
    art: '🍕🥗🍎',
    text: 'Log anything — pizza nights too. He never scolds. Only silence makes him doze off.',
    cta: 'Deal',
  },
];

export function OnboardingScreen({ defaultName = 'Chewy', onDone }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [askPush, setAskPush] = useState(false);

  const heroName = name.trim() || defaultName;
  const card = CARDS[step];

  const next = () => {
    if (step < CARDS.length - 1) setStep(step + 1);
    else setAskPush(true);
  };

  return (
    <PhoneFrame>
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CampBackdrop blur={askPush ? 0 : 2} dim={0.2} />

        <div style={{ position: 'relative', zIndex: 1, paddingTop: 48 }}>
          <WoodBanner>{askPush ? heroName.toUpperCase() : card.banner}</WoodBanner>
        </div>

        <div style={{ position: 'relative', zIndex: 1, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <div style={{ transform: 'scale(.72)', marginTop: -40 }}>
            <Hero status="idle" showBubble={false} />
          </div>
          {askPush ? (
            <SpeechBubble text="May I call you when the fire gets low?" />
          ) : (
            <>
              <div style={{ fontSize: 34, textShadow: '0 3px 6px rgba(0,0,0,.35)' }}>{card.art}</div>
              <div
                style={{
                  maxWidth: 260,
                  textAlign: 'center',
                  color: '#fff',
                  font: '600 15px var(--font-round)',
                  textShadow: '0 1px 3px rgba(0,0,0,.55)',
                }}
              >
                {card.text}
              </div>
            </>
          )}
        </div>

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '0 24px calc(26px + env(safe-area-inset-bottom))' }}>
          {!askPush && card.nameInput && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={defaultName}
              maxLength={16}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px 16px',
                borderRadius: 14,
                border: '3px solid var(--chewy-ink)',
                background: 'linear-gradient(180deg, #f6e7c6, #eed9ae)',
                font: '800 18px var(--font-round)',
                textAlign: 'center',
                color: '#3a2c14',
                outline: 'none',
              }}
            />
          )}

          {askPush ? (
            <>
              <ChunkyButton onClick={() => onDone?.({ name: heroName, pushOptIn: true })}>Sure, call me</ChunkyButton>
              <button
                onClick={() => onDone?.({ name: heroName, pushOptIn: false })}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.85)', font: '700 13px var(--font-round)', textShadow: '0 1px 2px rgba(0,0,0,.5)', cursor: 'pointer' }}
              >
                maybe later
              </button>
            </>
          ) : (
            <>
              <ChunkyButton onClick={next}>{card.cta}</ChunkyButton>
              <div style={{ display: 'flex', gap: 6 }}>
                {CARDS.map((_, i) => (
                  <span key={i} style={{ width: 8, height: 8, borderRadius: 4, background: i === step ? '#fff' : 'rgba(255,255,255,.35)' }} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </PhoneFrame>
  );
}
