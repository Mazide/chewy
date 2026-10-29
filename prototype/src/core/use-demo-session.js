import { useEffect, useState, useSyncExternalStore } from 'react';
import { createDemoSessionStore } from './demo-session.js';

export function useDemoSession({ store: suppliedStore, paused = false, ...options } = {}) {
  const [store] = useState(() => suppliedStore ?? createDemoSessionStore({
    ...options, lockManager: options.storage ? globalThis.navigator?.locks ?? null : undefined,
  }));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => {
    if (suppliedStore || paused) return;
    const settle = () => store.tick();
    const resume = () => { store.enter(); settle(); };
    const leave = () => store.leave();
    let releaseAccess = store.connectAccess(resume);
    const show = () => {
      if (!releaseAccess) releaseAccess = store.connectAccess(resume);
      else resume();
    };
    const hide = () => {
      leave();
      releaseAccess?.();
      releaseAccess = null;
    };
    const visibility = () => document.visibilityState === 'hidden' ? leave() : resume();
    const timer = window.setInterval(settle, 500);
    window.addEventListener('pageshow', show);
    window.addEventListener('pagehide', hide);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      clearInterval(timer);
      hide();
      window.removeEventListener('pageshow', show);
      window.removeEventListener('pagehide', hide);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [store, suppliedStore, paused]);
  return { store, ...snapshot };
}
