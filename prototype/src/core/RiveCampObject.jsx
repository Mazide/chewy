import { useEffect, useRef, useState } from 'react';
import './rive-camp-object.css';

const POSES = ['Morning', 'Growing', 'Full'];
let runtimePromise;
const buffers = new Map();
const ignoreStatus = () => {};

function loadRuntime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      if (!window.rive) await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/hero-actions/vendor/rive.js';
        script.onload = resolve;
        script.onerror = () => { script.remove(); reject(new Error('Не загрузилось движение лагеря.')); };
        document.head.append(script);
      });
      window.rive.RuntimeLoader.setWasmUrl('/hero-actions/vendor/rive.wasm');
      window.rive.RuntimeLoader.setWasmFallbackUrl('/hero-actions/vendor/rive_fallback.wasm');
      await window.rive.RuntimeLoader.awaitInstance();
      return window.rive;
    })().catch(error => { runtimePromise = null; throw error; });
  }
  return runtimePromise;
}

function loadAsset(id) {
  if (!buffers.has(id)) buffers.set(id, fetch(`/camp-states/exports/${id}.riv`)
    .then(response => { if (!response.ok) throw new Error('Не загрузился предмет.'); return response.arrayBuffer(); })
    .catch(error => { buffers.delete(id); throw error; }));
  return buffers.get(id);
}

export function RiveCampObject({ id, board, label, stage, paused = false, retry = 0, onStatus = ignoreStatus }) {
  const canvas = useRef(null);
  const controller = useRef(null);
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [localRetry, setLocalRetry] = useState(0);
  const latest = useRef({ stage, paused, onStatus });
  latest.current = { stage, paused: paused || reduced, onStatus };
  const [error, setError] = useState('');
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = event => setReduced(event.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    let disposed = false, player, loaded = false, staticPose = false, freezeNext = false;
    let previousStage = null;
    setError(''); latest.current.onStatus(id, 'loading');
    function apply(force = false) {
      if (!loaded || disposed) return;
      const { stage: next, paused: stopped } = latest.current;
      const still = stopped || document.hidden;
      if (still) {
        if (force || next !== previousStage || !staticPose) {
          freezeNext = false;
          player.pause(); player.stopRendering();
          // A standalone named pose flushes geometry while the state machine
          // is paused; this matches the verified three-state workshop.
          player.reset({ artboard: board, animations: POSES[next], autoBind: true, autoplay: false });
          player.viewModelInstance.number('stage').value = next;
          staticPose = true; freezeNext = true;
          player.scrub(POSES[next], 0); player.startRendering();
        }
      } else {
        freezeNext = false;
        if (staticPose) {
          player.reset({ artboard: board, stateMachines: board, autoBind: true, autoplay: false });
          player.viewModelInstance.number('stage').value = next;
          staticPose = false; player.play(board);
          player.advanceAndReportChanges(0); player.advanceAndReportChanges(.65); player.advanceAndReportChanges(.65);
        } else {
          player.viewModelInstance.number('stage').value = next;
          player.play(board);
        }
        player.startRendering();
      }
      previousStage = next;
    }
    function fail(message) {
      if (disposed) return;
      loaded = false; setError(message); latest.current.onStatus(id, 'error');
    }
    Promise.all([loadRuntime(), loadAsset(id)]).then(([rive, buffer]) => {
      if (disposed) return;
      player = new rive.Rive({ buffer: buffer.slice(0), canvas: canvas.current, artboard: board,
        stateMachines: board, autoBind: true, autoplay: false,
        enableRiveAssetCDN: false, shouldDisableRiveListeners: true,
        drawingOptions: rive.DrawOptimizationOptions.AlwaysDraw,
        layout: new rive.Layout({ fit: rive.Fit.Contain, alignment: rive.Alignment.Center }),
        onLoad: () => queueMicrotask(() => {
          if (disposed) return;
          if (!player.viewModelInstance?.number('stage')) { fail('Нет управления состоянием.'); return; }
          loaded = true; player.resizeDrawingSurfaceToCanvas(); apply(true);
          latest.current.onStatus(id, 'ready');
        }),
        onAdvance: () => { if (freezeNext && player) { freezeNext = false; player.pause(); player.stopRendering(); } },
        onLoadError: () => fail('Не удалось открыть предмет.'),
      });
    }).catch(error => fail(error.message));
    controller.current = { apply };
    const resize = new ResizeObserver(() => {
      if (!loaded || disposed) return;
      player.resizeDrawingSurfaceToCanvas(); apply(true);
    });
    resize.observe(canvas.current);
    const visibility = () => apply(true);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      disposed = true; loaded = false; controller.current = null;
      resize.disconnect(); document.removeEventListener('visibilitychange', visibility); player?.cleanup();
    };
  }, [id, board, retry, localRetry]);

  useEffect(() => { controller.current?.apply(); }, [stage, paused, reduced]);
  return <div className="meal-camp-rive" data-rive-asset={id} data-rive-stage={stage}>
    <canvas ref={canvas} aria-label={label} />
    {error && <button className="meal-camp-object-error" aria-label={`${label}: загрузить снова`} title={error} onClick={() => setLocalRetry(value => value + 1)}>↻</button>}
  </div>;
}
