// Hold one browser writer for this session while its UI is mounted. Mutations
// remain synchronous; callers enable them only inside the acquired lifetime.
export function acquireSessionAccess({ locks, key, onAcquired, onReleased, onError }) {
  const controller = new AbortController();
  let disposed = false;
  let owned = false;
  let release;

  const releaseOwnership = () => {
    if (!owned) return;
    owned = false;
    try {
      onReleased();
    } finally {
      release();
    }
  };
  const handleError = error => {
    if (disposed) return;
    if (controller.signal.aborted && error?.name === 'AbortError') return;
    onError(error);
  };
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    try {
      releaseOwnership();
    } finally {
      controller.abort();
    }
  };

  try {
    if (typeof locks?.request !== 'function') throw new Error('Exclusive session access is unavailable');
    Promise.resolve(locks.request(key, { mode: 'exclusive', signal: controller.signal }, async () => {
      if (disposed) return;
      const lifetime = new Promise(resolve => { release = resolve; });
      owned = true;
      try {
        onAcquired();
        await lifetime;
      } finally {
        releaseOwnership();
      }
    })).catch(handleError);
  } catch (error) {
    handleError(error);
  }

  return cleanup;
}
