/**
 * Diegetic chrome — UI as world objects, not system components.
 * Wood signs, chunky material buttons, parchment panels over a blurred camp.
 */

/** Hanging wooden sign used as a screen title.
 *  Default = generated plank art (pack A); passing `bg` keeps the CSS slab
 *  so analysis themes can reskin it. */
export function WoodBanner({ children, bg, color = '#ffe9c9' }) {
  if (!bg) {
    return (
      <div style={{ display: 'grid', placeItems: 'center' }}>
        <div
          style={{
            backgroundImage: 'url(/assets/gen/packA/plank.png)',
            backgroundSize: '100% 100%',
            padding: '26px 46px 22px',
            minWidth: 190,
            textAlign: 'center',
            color,
            font: '800 15px var(--font-round)',
            letterSpacing: 1,
            textShadow: '0 2px 3px rgba(0,0,0,.55)',
            transform: 'rotate(-1deg)',
            filter: 'drop-shadow(0 4px 4px rgba(0,0,0,.35))',
          }}
        >
          {children}
        </div>
      </div>
    );
  }
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

/** World-object nav button: generated item art (pack A) or an emoji fallback. */
export function IconOrb({ emoji, icon, onClick, size = 46 }) {
  if (icon) {
    return (
      <button
        onClick={onClick}
        style={{ width: size + 10, height: size + 10, padding: 0, background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <img src={icon} alt="" style={{ width: '100%', display: 'block', filter: 'drop-shadow(0 3px 3px rgba(0,0,0,.45))' }} />
      </button>
    );
  }
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
      <img src="/assets/gen/packA/coin.png" alt="" style={{ width: 20, height: 20, display: 'block' }} />
      {coins}
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

/** Parchment scroll panel — lists live on paper, not in table views.
 *  art="scroll" (rollers) or art="map" (torn map sheet) uses pack-A art;
 *  no art keeps the CSS parchment. */
export function ScrollPanel({ children, width = '86%', art }) {
  if (art === 'scroll') {
    // stretch the whole scroll art: rollers top/bottom, generous padding
    // because the paper sits inside the PNG's transparent margins
    return (
      <div
        style={{
          position: 'relative',
          width,
          margin: '0 auto',
          backgroundImage: 'url(/assets/gen/packA/scroll.png)',
          backgroundSize: '100% 100%',
          padding: '62px 48px',
          color: '#3a2c14',
          font: '600 14px var(--font-round)',
          filter: 'drop-shadow(0 10px 18px rgba(0,0,0,.45))',
        }}
      >
        {children}
      </div>
    );
  }
  if (art === 'map') {
    // long scrolling content: parchment as a cover texture, not a stretched sheet
    return (
      <div
        style={{
          position: 'relative',
          width,
          margin: '0 auto',
          backgroundImage: 'url(/assets/gen/packA/parchment_map.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          borderRadius: 14,
          border: '3px solid var(--chewy-ink)',
          boxShadow: '0 10px 24px rgba(0,0,0,.45), inset 0 0 40px rgba(140,100,40,.3)',
          padding: '24px 22px',
          color: '#3a2c14',
          font: '600 14px var(--font-round)',
        }}
      >
        {children}
      </div>
    );
  }
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
