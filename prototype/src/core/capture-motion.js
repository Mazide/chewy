import { flushSync } from 'react-dom';
import './capture-motion.css';

let activeTransition;

// Navigation never waits for the decorative animation to finish.
export function moveCapturePhoto(source, update, findTarget) {
  if (!source?.isConnected || !document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return update();
  if (activeTransition) {
    const previous = activeTransition;
    previous.skipTransition();
    return previous.updateCallbackDone.then(() => update());
  }
  let target;
  source.style.viewTransitionName = 'chewy-meal-photo';
  document.documentElement.classList.add('chewy-photo-transition');
  const transition = document.startViewTransition(() => {
    flushSync(update);
    source.style.viewTransitionName = '';
    target = findTarget();
    if (target) target.style.viewTransitionName = 'chewy-meal-photo';
  });
  activeTransition = transition;
  // A clipped or removed source may skip animation; the update still takes place.
  transition.ready.catch(() => {});
  transition.finished.catch(() => {}).finally(() => {
    source.style.viewTransitionName = '';
    if (target) target.style.viewTransitionName = '';
    if (activeTransition === transition) activeTransition = null;
    document.documentElement.classList.remove('chewy-photo-transition');
  });
}
