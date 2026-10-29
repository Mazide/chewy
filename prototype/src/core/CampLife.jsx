import { birdFlightAt } from './bird-flight.js';
import { useEffect, useRef } from 'react';
import clips from './camp-life.json';
import './camp-life.css';

// Fixed union bounds keep the feet/roots registered between frames.
export function CampSprite({ kind, className = '', paused = false, flightRef }) {
  const ref = useRef(null);
  const clip = clips[kind];
  const [left, top, right, bottom] = clip.crop;
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let disposed = false, request = 0, visible = true, elapsed = 0, previous = null, lastFrame = -1;
    let atlas = null, poster = null;
    const draw = (index) => {
      if (!atlas && !poster) return;
      const scale = atlas ? 1 : poster.width / clip.width;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(atlas ?? poster,
        ((atlas ? index % clip.columns * clip.width : 0) + left) * scale,
        ((atlas ? Math.floor(index / clip.columns) * clip.height : 0) + top) * scale,
        (right - left) * scale, (bottom - top) * scale, 0, 0, canvas.width, canvas.height);
      canvas.dataset.frame = String(index);
    };
    const tick = (time) => {
      if (previous !== null) elapsed += time - previous;
      previous = time;
      const pose = flightRef ? birdFlightAt(elapsed / 1000) : null;
      if (pose && flightRef.current) {
        flightRef.current.style.left = `${pose.x * 100}%`;
        flightRef.current.style.transform = `translateY(${pose.y * 100}cqw) rotate(${pose.angle}deg)`;
        flightRef.current.dataset.flightTime = String(elapsed / 1000);
      }
      const frame = pose ? pose.frame : Math.floor(elapsed * clip.fps / 1000) % clip.count;
      if (frame !== lastFrame) { draw(frame); lastFrame = frame; }
      request = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(request); previous = null;
      if (motion.matches || paused) { elapsed = 0; lastFrame = -1; draw(0); }
      else if (visible && !document.hidden && atlas) request = requestAnimationFrame(tick);
    };
    const still = new Image();
    still.onload = () => { if (!disposed) { poster = still; if (!atlas) draw(0); } };
    still.src = `/assets/camp-life/${kind}/poster.png`;
    const sheet = new Image();
    sheet.onload = () => { if (!disposed) { atlas = sheet; draw(0); sync(); } };
    sheet.src = `/assets/camp-life/${kind}/${clip.file ?? 'preview-atlas.webp'}`;
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    // The flight starts outside the viewport: observe the scene, not the bird.
    observer.observe(flightRef ? canvas.closest('.camp-life') : canvas);
    motion.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      disposed = true; cancelAnimationFrame(request); observer.disconnect();
      motion.removeEventListener('change', sync); document.removeEventListener('visibilitychange', sync);
    };
  }, [kind, paused, clip, left, top, right, bottom, flightRef]);
  return <canvas ref={ref} width={right - left} height={bottom - top} className={`camp-life-sprite ${className}`} data-camp-sprite={kind} aria-hidden="true" />;
}

export function CampLife({ phase, clouds = false, paused = false }) {
  const bird = useRef(null);
  return <div className={`camp-life${paused ? ' camp-life-paused' : ''}`} aria-hidden="true">
    {clouds && <div className="camp-life-sky"><img className="camp-life-cloud" src="/assets/camp-life/clouds/sprite.png" alt="" /></div>}
    {phase !== 'night' && <>
      <div ref={bird} className="camp-life-bird"><CampSprite kind="bird" paused={paused} flightRef={bird} /></div>
      <div className="camp-life-butterfly"><CampSprite kind="butterfly" paused={paused} /></div>
    </>}
  </div>;
}
