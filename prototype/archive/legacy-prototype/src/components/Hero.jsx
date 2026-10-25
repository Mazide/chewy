import { useEffect, useRef } from 'react';
import { SpeechBubble } from './SpeechBubble.jsx';

/**
 * Hero — real sprite animation from the native atlas.
 * Frames come from a PNG sheet (public/assets/hero_idle_sheet.png), drawn to a
 * canvas. Timing mirrors HeroScene.swift:
 *   idle   → loop @ 24 fps
 *   eating → loop @ 24*0.6 fps + scale pulse
 *   happy  → play once @ 24*1.5 fps, then hold the last frame
 */
const SHEET = '/assets/hero_idle_sheet.png';
const FW = 152, FH = 318, COLS = 11, COUNT = 121, FPS = 24;
const DISPLAY_W = 182, DISPLAY_H = 380;

// The hero speaks for himself — never the app (Focus Friend tone).
const LABEL = {
  idle: 'Nice day by the fire.',
  hungry: "Tummy's rumbling…",
  eating: 'Om nom nom…',
  happy: 'That was delicious!',
};

// One shared decoded sheet across all Hero instances.
let sheetImg = null;
function loadSheet() {
  if (sheetImg) return sheetImg;
  sheetImg = new Image();
  sheetImg.src = SHEET;
  return sheetImg;
}

export function Hero({ status = 'idle', showBubble = true }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const img = loadSheet();
    const ctx = canvasRef.current.getContext('2d');
    const w = canvasRef.current.width;
    const h = canvasRef.current.height;
    const fps = status === 'eating' ? FPS * 0.6 : status === 'happy' ? FPS * 1.5 : FPS;
    const start = performance.now();
    let raf;

    const draw = (now) => {
      if (img.complete && img.naturalWidth) {
        let frame = Math.floor(((now - start) / 1000) * fps);
        frame = status === 'happy' ? Math.min(frame, COUNT - 1) : frame % COUNT;
        const sx = (frame % COLS) * FW;
        const sy = Math.floor(frame / COLS) * FH;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, sx, sy, FW, FH, 0, 0, w, h);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [status]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div className={status === 'eating' ? 'chewy-pulse' : undefined} style={{ position: 'relative' }}>
        <canvas
          ref={canvasRef}
          width={FW * 2}
          height={FH * 2}
          style={{
            width: DISPLAY_W,
            height: DISPLAY_H,
            display: 'block',
            filter: 'drop-shadow(0 10px 10px rgba(0,0,0,.35))',
          }}
        />
        {/* contact shadow at the feet */}
        <div
          style={{
            position: 'absolute',
            bottom: 4,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 120,
            height: 22,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse at center, rgba(0,0,0,.35), rgba(0,0,0,0) 70%)',
            filter: 'blur(2px)',
          }}
        />
      </div>

      {showBubble && <SpeechBubble text={LABEL[status] ?? LABEL.idle} />}

      <style>{`
        @keyframes chewy-pulse-kf { 0%,100% { transform: scale(1) } 50% { transform: scale(1.06) } }
        .chewy-pulse { animation: chewy-pulse-kf 1s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
