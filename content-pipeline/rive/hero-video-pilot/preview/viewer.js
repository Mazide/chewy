/* The right canvas plays an embedded Rive timeline; the left only displays its source frame. */
(() => {
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const reference = document.querySelector('canvas[data-version="reference"]');
  const canvas = document.querySelector('canvas[data-version="rive"]');
  const errors = [];
  let player = null, manifest = null, images = [], loaded = false, disposed = false;
  let playing = false, finished = false, elapsed = 0, index = 0, freezeNext = false;
  let sampling = false, sampleMode = false, sampleEpoch = 0, background = 'light';
  let lastMotionPreference = media.matches;
  let resolveReady;
  const ready = new Promise(resolve => { resolveReady = resolve; });
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const duration = () => manifest?.duration_seconds ?? manifest?.duration ?? 0;
  const frameAt = time => Math.min(manifest.frame_count - 1, Math.floor(Math.max(0, time) * manifest.fps + 1e-8));
  function state() {
    return { ready: loaded && !errors.length, playing: playing && !document.hidden, finished,
      elapsed: Math.min(duration(), elapsed), frame: index, duration: duration(), fps: manifest?.fps,
      frameCount: manifest?.frame_count, width: manifest?.width, height: manifest?.height,
      reducedMotion: media.matches, background, nativeClock: 'Rive onAdvance elapsed seconds',
      playback: 'native RecordedGesture timeline', errors: [...errors] };
  }
  function sync() {
    document.querySelectorAll('#replay,#playback,#rest,#timeline,#last,[data-time]').forEach(control => { control.disabled = !loaded || !!errors.length; });
    document.querySelector('#playback').textContent = playing ? 'Пауза' : finished || sampleMode ? 'Воспроизвести' : 'Продолжить';
    document.querySelector('#status').textContent = errors.length ? 'Не удалось открыть сравнение.' : !loaded ? 'Загружаем кадры и Rive…' : document.hidden ? 'Просмотр приостановлен.' : playing ? 'Обе версии идут по времени Rive. Кадры и ритм совпадают.' : finished ? 'Эпизод завершён. Последний кадр остаётся на экране; повтор начинается с первого.' : 'Воспроизведение остановлено. Можно сравнить любой кадр.';
    if (manifest) {
      document.querySelector('#timeline').value = Math.min(duration(), elapsed);
      document.querySelector('#time').textContent = `${Math.min(duration(), elapsed).toFixed(2).replace('.', ',')} с · кадр ${index + 1}/${manifest.frame_count}`;
    }
  }
  function drawReference() {
    if (!images[index]) return;
    const context = reference.getContext('2d');
    context.clearRect(0, 0, reference.width, reference.height);
    const scale = Math.min(reference.width / manifest.width, reference.height / manifest.height);
    const width = manifest.width * scale, height = manifest.height * scale;
    context.imageSmoothingEnabled = true;
    context.drawImage(images[index], (reference.width - width) / 2, (reference.height - height) / 2, width, height);
  }
  function resize() {
    if (!loaded || sampling) return;
    const rect = reference.getBoundingClientRect(), ratio = devicePixelRatio || 1;
    reference.width = Math.max(1, Math.round(rect.width * ratio));
    reference.height = Math.max(1, Math.round(rect.height * ratio));
    drawReference();
    player.resizeDrawingSurfaceToCanvas();
    if (!playing || document.hidden) { freezeNext = true; player.startRendering(); }
  }
  function stopNative() { if (!player) return; freezeNext = false; player.pause(); player.stopRendering(); }
  function pause() { playing = false; stopNative(); sync(); }
  function replay() {
    if (!loaded || errors.length) return;
    sampleEpoch++; sampling = false; sampleMode = false; playing = false; stopNative();
    player.reset({ artboard: manifest.artboard, animations: manifest.animation, autoBind: true, autoplay: false });
    // A paused draw resets the runtime clock. play() draws synchronously, so
    // initialize our matching reference clock before it can advance the file.
    player.scrub(manifest.animation, 0);
    elapsed = 0; index = 0; finished = false; drawReference(); playing = true;
    lastMotionPreference = media.matches; // Explicit replay is allowed even when automatic motion is reduced.
    if (!document.hidden) player.play(manifest.animation);
    sync();
  }
  function resume() {
    if (!loaded || errors.length) return;
    if (finished || sampleMode) { replay(); return; }
    // Flush a paused draw before resuming; stopped rendering otherwise leaves
    // the previous render timestamp and counts the pause as animation time.
    player.scrub(manifest.animation, elapsed);
    playing = true; lastMotionPreference = media.matches;
    if (!document.hidden) player.play(manifest.animation);
    sync();
  }
  async function capture(time) {
    await ready;
    if (errors.length) throw new Error(errors.join('; '));
    if (!Number.isFinite(time) || time < 0 || time > duration() + 1e-6) throw new RangeError('Invalid source sequence time');
    const epoch = ++sampleEpoch;
    pause(); sampling = true; sampleMode = true; elapsed = Math.min(time, duration()); index = frameAt(elapsed); finished = elapsed >= duration();
    player.reset({ artboard: manifest.artboard, animations: manifest.animation, autoBind: true, autoplay: false });
    player.scrub(manifest.animation, elapsed);
    drawReference(); freezeNext = true; player.startRendering();
    await nextFrame(); await nextFrame(); await nextFrame();
    if (epoch === sampleEpoch) { stopNative(); sampling = false; sync(); }
    return state();
  }
  async function captureFrame(value) {
    await ready;
    if (!Number.isInteger(value) || value < 0 || value >= manifest.frame_count) throw new RangeError('Invalid source frame');
    return capture((value + 0.5) / manifest.fps);
  }
  function setBackground(value) {
    if (!['light', 'dark', 'checker'].includes(value)) throw new RangeError('Unknown background');
    background = value; document.querySelector('.comparison').dataset.background = value;
    document.querySelectorAll('[data-background]').forEach(button => {
      if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed', String(button.dataset.background === value));
    });
  }
  function advanced(event) {
    if (freezeNext) { freezeNext = false; player.pause(); player.stopRendering(); return; }
    if (!playing || sampling || document.hidden) return;
    // Also observe the preference on a native frame: browsers may defer the
    // MediaQueryList change event while captures or WebGL draws are pending.
    let reduceAfterFrame = false;
    if (media.matches !== lastMotionPreference) {
      lastMotionPreference = media.matches;
      reduceAfterFrame = lastMotionPreference;
    }
    elapsed = Math.min(duration(), elapsed + event.data);
    index = frameAt(elapsed); drawReference();
    if (reduceAfterFrame) { pause(); return; }
    if (elapsed >= duration()) { playing = false; finished = true; stopNative(); }
    sync();
  }
  function fail(error) {
    playing = false; stopNative(); errors.push(String(error.message || error));
    document.querySelector('#error').hidden = false;
    document.querySelector('#error p').textContent = `Не удалось открыть пробу: ${error.message || error}`;
    sync(); resolveReady(state());
  }
  async function start() {
    if (!window.rive) throw new Error('Не найден локальный Rive runtime');
    const manifestURL = new URL('../exports/manifest.json', location.href);
    const response = await fetch(manifestURL, { cache: 'no-store' });
    if (!response.ok) throw new Error('Сначала соберите Rive из исходных кадров');
    manifest = await response.json();
    if (!Array.isArray(manifest.frames) || manifest.frames.length !== manifest.frame_count || !manifest.fps || !manifest.width || !manifest.height) throw new Error('Некорректный контракт исходных кадров');
    if (!manifest.artboard || !manifest.animation || !manifest.rive_file || Math.abs(duration() - manifest.frame_count / manifest.fps) > 1e-5) throw new Error('Некорректная длительность или анимация Rive');
    document.querySelector('#timeline').max = duration();
    document.querySelector('#timeline').step = 1 / (manifest.fps * 10);
    document.querySelector('#source-meta').textContent = `${manifest.frame_count} кадров · ${manifest.fps} кадров/с · ${manifest.width} × ${manifest.height}. Последняя поза отличается от первой.`;
    document.querySelector('#manifest').href = manifestURL.href;
    images = await Promise.all(manifest.frames.map(relative => new Promise((resolve, reject) => {
      const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error(`Не загружен кадр ${relative}`)); image.src = new URL(relative, manifestURL).href;
    })));
    rive.RuntimeLoader.setWasmUrl(new URL('../vendor/rive.wasm', location.href).href);
    rive.RuntimeLoader.setWasmFallbackUrl(new URL('../vendor/rive_fallback.wasm', location.href).href);
    await rive.RuntimeLoader.awaitInstance();
    const rivResponse = await fetch(new URL(manifest.rive_file, manifestURL));
    if (!rivResponse.ok) throw new Error(`Файл Rive недоступен (${rivResponse.status})`);
    const buffer = await rivResponse.arrayBuffer();
    await new Promise((resolve, reject) => {
      player = new rive.Rive({ buffer, canvas, artboard: manifest.artboard, animations: manifest.animation,
        autoBind: true, autoplay: false, enableRiveAssetCDN: false, shouldDisableRiveListeners: true,
        drawingOptions: rive.DrawOptimizationOptions.AlwaysDraw,
        layout: new rive.Layout({ fit: rive.Fit.Contain, alignment: rive.Alignment.Center }),
        onLoad: () => queueMicrotask(() => {
          try {
            if (!player.animationNames.includes(manifest.animation)) throw new Error('В Rive отсутствует исходная последовательность');
            loaded = true; resize(); resolve();
          } catch (error) { reject(error); }
        }), onAdvance: advanced, onLoadError: () => reject(new Error('Runtime не открыл Rive')),
      });
    });
    sync(); resolveReady(state());
    await capture(0);
    if (!media.matches && !document.hidden) replay();
  }
  document.querySelector('#replay').addEventListener('click', replay);
  document.querySelector('#playback').addEventListener('click', () => playing ? pause() : resume());
  document.querySelector('#rest').addEventListener('click', () => capture(0).catch(fail));
  document.querySelector('#last').addEventListener('click', () => capture(duration()).catch(fail));
  document.querySelector('#timeline').addEventListener('input', event => capture(Number(event.target.value)).catch(fail));
  document.querySelectorAll('[data-time]').forEach(button => button.addEventListener('click', () => capture(Number(button.dataset.time)).catch(fail)));
  document.querySelectorAll('button[data-background]').forEach(button => button.addEventListener('click', () => setBackground(button.dataset.background)));
  document.querySelector('#retry').addEventListener('click', () => location.reload());
  document.querySelector('#size').addEventListener('click', event => {
    const small = document.querySelector('.comparison').classList.toggle('small');
    event.currentTarget.setAttribute('aria-pressed', String(small)); event.currentTarget.textContent = small ? 'Посмотреть крупно' : 'В размере лагеря';
    sampling = false;
  });
  media.addEventListener('change', event => { lastMotionPreference = event.matches; if (event.matches) pause(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopNative(); else if (playing) { player.play(manifest.animation); player.startRendering(); }
    sync();
  });
  const observer = new ResizeObserver(resize); observer.observe(reference); observer.observe(canvas);
  window.addEventListener('pagehide', () => { disposed = true; observer.disconnect(); player?.cleanup(); }, { once: true });
  window.heroVideoPilot = Object.freeze({ ready, state, replay, pause, resume, capture, captureFrame, setBackground });
  sync(); start().catch(fail);
})();
