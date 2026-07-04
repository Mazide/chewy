/**
 * Diegetic chrome — UI as world objects, not system components.
 * Wood signs, chunky material buttons, parchment panels over a blurred camp.
 */

/** Hanging wooden sign used as a screen title. */
export function WoodBanner({ children, bg = 'linear-gradient(180deg, #8a5a30, #6b4226)', color = '#ffe9c9' }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center' }}>
      <div
        style={{
          position: 'relative',
          padding: '10px 26px',
          background: bg,
          color,
          font: '800 15px var(--font-round)',
          letterSpacing: 1,
          borderRadius: 10,
          border: '3px solid var(--chewy-ink)',
          boxShadow: '0 4px 0 rgba(0,0,0,.35), inset 0 2px 0 rgba(255,255,255,.25)',
          transform: 'rotate(-1deg)',
        }}
      >
        {/* nails */}
        <span style={{ position: 'absolute', left: 7, top: 7, width: 6, height: 6, borderRadius: '50%', background: '#2b1c0c' }} />
        <span style={{ position: 'absolute', right: 7, top: 7, width: 6, height: 6, borderRadius: '50%', background: '#2b1c0c' }} />
        {children}
      </div>
    </div>
  );
}

/** Chunky material button — wood/stone slab with ink outline and bevel. */
export function ChunkyButton({ children, onClick, color = 'var(--chewy-orange)', colorDark = 'var(--chewy-orange-dark)', small = false, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: small ? '8px 16px' : '14px 28px',
        font: `${small ? 700 : 800} ${small ? 14 : 18}px var(--font-round)`,
        letterSpacing: 0.5,
        color: '#fff',
        textShadow: '0 1px 0 rgba(0,0,0,.35)',
        background: `linear-gradient(180deg, ${color}, ${colorDark})`,
        border: '3px solid var(--chewy-ink)',
        borderRadius: 14,
        boxShadow: disabled ? 'none' : '0 4px 0 var(--chewy-ink), inset 0 2px 0 rgba(255,255,255,.35)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transform: disabled ? 'translateY(4px)' : 'none',
      }}
    >
      {children}
    </button>
  );
}

/** Round wooden icon button for hub navigation (map, backpack, path). */
export function IconOrb({ emoji, onClick, size = 46 }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        display: 'grid',
        placeItems: 'center',
        background: 'linear-gradient(180deg, #8a5a30, #5f3d22)',
        border: '3px solid var(--chewy-ink)',
        borderRadius: '50%',
        boxShadow: '0 3px 0 var(--chewy-ink), inset 0 2px 0 rgba(255,255,255,.3)',
        cursor: 'pointer',
      }}
    >
      {emoji}
    </button>
  );
}

/** Coin counter chip. */
export function CoinBadge({ coins = 0 }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 14px',
        font: '800 15px var(--font-round)',
        color: '#3a2c14',
        background: 'linear-gradient(180deg, #ffe9a8, #f2c94c)',
        border: '3px solid var(--chewy-ink)',
        borderRadius: 999,
        boxShadow: '0 3px 0 var(--chewy-ink), inset 0 2px 0 rgba(255,255,255,.5)',
      }}
    >
      🪙 {coins}
    </div>
  );
}

/** The camp video, optionally blurred — every screen stays "in the world". */
export function CampBackdrop({ blur = 0, dim = 0 }) {
  return (
    <>
      <video
        src="/assets/background.webm"
        autoPlay
        loop
        muted
        playsInline
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 0,
          filter: blur ? `blur(${blur}px)` : undefined,
          transform: blur ? 'scale(1.06)' : undefined, // hide blur edge bleed
        }}
      />
      {dim > 0 && (
        <div style={{ position: 'absolute', inset: 0, background: `rgba(10,20,10,${dim})`, zIndex: 0 }} />
      )}
    </>
  );
}

/** Parchment scroll panel — lists live on paper, not in table views. */
export function ScrollPanel({ children, width = '86%' }) {
  return (
    <div
      style={{
        position: 'relative',
        width,
        margin: '0 auto',
        padding: '20px 18px',
        background: 'linear-gradient(180deg, #f6e7c6, #ecd6a8)',
        border: '3px solid var(--chewy-ink)',
        borderRadius: 14,
        boxShadow: '0 10px 24px rgba(0,0,0,.45), inset 0 0 40px rgba(140,100,40,.25)',
        color: '#3a2c14',
        font: '600 14px var(--font-round)',
      }}
    >
      {/* rolled edges */}
      <div style={{ position: 'absolute', top: -10, left: 12, right: 12, height: 14, borderRadius: 8, background: 'linear-gradient(180deg, #d9bd8b, #c4a570)', border: '3px solid var(--chewy-ink)' }} />
      <div style={{ position: 'absolute', bottom: -10, left: 12, right: 12, height: 14, borderRadius: 8, background: 'linear-gradient(180deg, #d9bd8b, #c4a570)', border: '3px solid var(--chewy-ink)' }} />
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  );
}
