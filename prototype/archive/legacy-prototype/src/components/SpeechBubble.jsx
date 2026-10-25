/**
 * SpeechBubble — frosted capsule under the hero. Mirrors the
 * SpeechBubble in HeroView.swift.
 */
export function SpeechBubble({ text }) {
  return (
    <div
      style={{
        font: '600 15px/1.2 var(--font-round)',
        color: '#fff',
        padding: '8px 16px',
        background: 'rgba(255,255,255,.18)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,.25)',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </div>
  );
}
