import { SpeechBubble } from './SpeechBubble.jsx';

/**
 * Hero — the creature that reflects the user's nutrition quality.
 * Mirrors HeroView.swift. Sprite is a placeholder emoji for now
 * (same approach as the app's HeroSpriteView stub).
 *
 * status: 'idle' | 'eating' | 'happy'
 */
const FACES = {
  idle: { emoji: '🤖', tint: '#9aa0a6', label: "I'm hungry..." },
  eating: { emoji: '😋', tint: '#ffd23f', label: 'Analysing your meal...' },
  happy: { emoji: '😄', tint: '#7ed957', label: 'That was delicious!' },
};

export function Hero({ status = 'idle', showBubble = true }) {
  const face = FACES[status] ?? FACES.idle;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        userSelect: 'none',
      }}
    >
      <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
        <div
          key={status}
          className={`chewy-hero chewy-hero--${status}`}
          style={{
            fontSize: 120,
            lineHeight: 1,
            filter: `drop-shadow(0 8px 10px rgba(0,0,0,.35))`,
            color: face.tint,
          }}
        >
          {face.emoji}
        </div>
        {/* contact shadow */}
        <div
          style={{
            position: 'absolute',
            bottom: -6,
            width: 120,
            height: 22,
            borderRadius: '50%',
            background:
              'radial-gradient(ellipse at center, rgba(0,0,0,.35), rgba(0,0,0,0) 70%)',
            filter: 'blur(2px)',
          }}
        />
      </div>

      {showBubble && <SpeechBubble text={face.label} />}

      <style>{`
        @keyframes chewy-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
        @keyframes chewy-chew { 0%,100% { transform: scale(1) } 50% { transform: scale(1.08) } }
        @keyframes chewy-pop  { 0% { transform: scale(.7) } 60% { transform: scale(1.12) } 100% { transform: scale(1) } }
        .chewy-hero--idle   { animation: chewy-bob 3s ease-in-out infinite; }
        .chewy-hero--eating { animation: chewy-chew .5s ease-in-out infinite; }
        .chewy-hero--happy  { animation: chewy-pop .6s ease-out; }
      `}</style>
    </div>
  );
}
