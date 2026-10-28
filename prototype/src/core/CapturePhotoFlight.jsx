import { useEffect, useRef } from 'react';
import { samplePhoto } from './study-content.js';
import './capture-motion.css';

export function CapturePhotoFlight({ photo }) {
  const ref = useRef(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const phone = element.closest('.capture-phone');
    const thumb = [...phone.querySelectorAll('.capture-photo-tray [data-photo-id]')].find(item => item.dataset.photoId === photo.id);
    if (!thumb || !element.animate) return;
    const frame = phone.getBoundingClientRect(), destination = thumb.getBoundingClientRect();
    const size = frame.width * .48;
    const x = frame.width * .5, y = frame.height * .38;
    Object.assign(element.style, { width:`${size}px`, height:`${size}px`, left:`${x-size/2}px`, top:`${y-size/2}px`, visibility:'visible' });
    const dx = destination.left + destination.width / 2 - frame.left - x;
    const dy = destination.top + destination.height / 2 - frame.top - y;
    const end = `translate(${dx}px,${dy}px) scale(${destination.width/size},${destination.height/size})`;
    const animation = element.animate([
      { transform:'scale(1) rotate(-3deg)', opacity:1 },
      { transform:end, opacity:1, offset:.88 },
      { transform:end, opacity:0 },
    ], { duration:380, easing:'cubic-bezier(.22,.75,.2,1)', fill:'forwards' });
    return () => animation.cancel();
  }, [photo]);
  return <span ref={ref} className="capture-photo-flight" aria-hidden="true"><img src={samplePhoto(photo.imageKey).src} alt="" /></span>;
}
