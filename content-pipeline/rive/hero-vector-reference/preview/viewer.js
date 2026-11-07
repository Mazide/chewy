/* The right canvas plays a vector rig; the left is a distinct raster motion reference. */
(() => {
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const reference = document.querySelector('canvas[data-version="reference"]');
  const canvas = document.querySelector('canvas[data-version="rive"]');
  const errors = [];
  let player = null, manifest = null, images = [], loaded = false, disposed = false;
  let playing = false, finished = false, elapsed = 0, index = 0, freezeNext = false;
  let sampling = false, sampleMode = false, sampleEpoch = 0, background = 'light';
  let lastMotionPreference = media.matches;
  const overrides = {};
  let resolveReady;
  const ready = new Promise(resolve => { resolveReady = resolve; });
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const duration = () => manifest?.duration_seconds ?? manifest?.duration ?? 0;
  const frameAt = time => Math.min(manifest.frame_count - 1, Math.floor(Math.max(0, time) * manifest.fps + 1e-8));
  function state() {
    return { ready: loaded && !errors.length, playing: playing && !document.hidden, finished,
      elapsed: Math.min(duration(), elapsed), frame: index, duration: duration(), fps: manifest?.fps,
      frameCount: manifest?.frame_count, width: manifest?.width, height: manifest?.height,
      referenceWidth: manifest?.reference_width, referenceHeight: manifest?.reference_height,
      reducedMotion: media.matches, background, nativeClock: 'Rive onAdvance elapsed seconds',
      playback: 'native ReferenceGesture timeline', overrides: { ...overrides }, errors: [...errors] };
  }
  function sync() {
    document.querySelectorAll('#replay,#playback,#rest,#timeline,#last,#lookX,#lookY,#reset-look,[data-time]').forEach(control => { control.disabled = !loaded || !!errors.length; });
    document.querySelector('#playback').textContent = playing ? 'Пауза' : finished || sampleMode ? 'Воспроизвести' : 'Продолжить';
    document.querySelector('#status').textContent = errors.length ? 'Не удалось открыть сравнение.' : !loaded ? 'Загружаем референс и Rive…' : document.hidden ? 'Просмотр приостановлен.' : playing ? 'Обе стороны показаны в один момент времени. Рисунок и движение сравниваем визуально.' : finished ? 'Эпизод завершён. Последняя поза удерживается; повтор начинается сначала.' : 'Воспроизведение остановлено. Можно сравнить позы и проверить взгляд.';
    if (manifest) {
      document.querySelector('#timeline').value = Math.min(duration(), elapsed);
      document.querySelector('#time').textContent = `${Math.min(duration(), elapsed).toFixed(2).replace('.', ',')} с · кадр ${index + 1}/${manifest.frame_count}`;
    }
  }
  function drawReference() {
    if (!images[index]) return;
    const context = reference.getContext('2d');
    context.clearRect(0, 0, reference.width, reference.height);
    const scale = Math.min(reference.width / manifest.reference_width, reference.height / manifest.reference_height);
    const width = manifest.reference_width * scale, height = manifest.reference_height * scale;
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
  function applyOverrides() {
    for (const [name, value] of Object.entries(overrides)) {
      const property = player.viewModelInstance?.number(name);
      if (!property) throw new Error(`В Rive отсутствует управление ${name}`);
      property.value = value;
    }
  }
  function setOverride(name, value) {
    if (!loaded || !Object.hasOwn(overrides, name)) throw new RangeError('Unknown rig control');
    const range = manifest.overrides[name];
    if (!Number.isFinite(value) || value < range.min || value > range.max) throw new RangeError('Rig control outside range');
    overrides[name] = value; document.querySelector(`#${name}`).value = value; applyOverrides();
    player.advanceAndReportChanges(0);
    if (!playing) freezeNext = true;
    player.startRendering();
    return state();
  }
  function replay() {
    if (!loaded || errors.length) return;
    sampleEpoch++; sampling = false; sampleMode = false; playing = false; stopNative();
    player.reset({ artboard: manifest.artboard, animations: manifest.animation, autoBind: true, autoplay: false });
    applyOverrides();
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
    applyOverrides();
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
    if (!response.ok) throw new Error('Сначала соберите сохранённый векторный мастер');
    manifest = await response.json();
    manifest.reference_width ??= 253; manifest.reference_height ??= 530;
    if (!Array.isArray(manifest.frames) || manifest.frames.length !== manifest.frame_count || !manifest.fps || !manifest.width || !manifest.height) throw new Error('Некорректный контракт исходных кадров');
    if (!manifest.artboard || !manifest.animation || !manifest.rive_file || Math.abs(duration() - manifest.frame_count / manifest.fps) > 1e-5) throw new Error('Некорректная длительность или анимация Rive');
    if (manifest.reference_width !== 253 || manifest.reference_height !== 530) throw new Error('Размеры референса не соответствуют подготовленным кадрам');
    document.querySelector('#timeline').max = duration();
    document.querySelector('#timeline').step = 1 / (manifest.fps * 10);
    document.querySelector('#source-meta').textContent = `Референс: ${manifest.frame_count} кадров, ${manifest.fps} кадров/с, ${manifest.reference_width} × ${manifest.reference_height}. Векторный artboard: ${manifest.width} × ${manifest.height}. Каждая сторона вписана без растяжения; пиксельное совпадение не проверяется.`;
    document.querySelector('#manifest').href = manifestURL.href;
    images = await Promise.all(manifest.frames.map(relative => new Promise((resolve, reject) => {
      const image = new Image(); image.onload = () => image.naturalWidth === manifest.reference_width && image.naturalHeight === manifest.reference_height ? resolve(image) : reject(new Error(`Размер кадра не соответствует manifest: ${relative}`)); image.onerror = () => reject(new Error(`Не загружен кадр ${relative}`)); image.src = new URL(relative, manifestURL).href;
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
            if (!player.animationNames.includes(manifest.animation)) throw new Error(`В Rive отсутствует анимация ${manifest.animation}`);
            for (const name of ['lookX', 'lookY']) {
              const range = manifest.overrides?.[name];
              if (!range) continue;
              if (![range.min, range.max, range.default].every(Number.isFinite) || range.min > range.default || range.max < range.default) throw new Error('Некорректное управление ригом');
              overrides[name] = range.default;
              const slider = document.querySelector(`#${name}`);
              slider.min = range.min; slider.max = range.max; slider.value = range.default;
            }
            applyOverrides();
            document.querySelector('#rig-controls').hidden = !Object.keys(overrides).length;
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
  for (const name of ['lookX', 'lookY']) document.querySelector(`#${name}`).addEventListener('input', event => { try { setOverride(name, Number(event.target.value)); } catch (error) { fail(error); } });
  document.querySelector('#reset-look').addEventListener('click', () => { try { for (const name of Object.keys(overrides)) setOverride(name, manifest.overrides[name].default); } catch (error) { fail(error); } });
  document.querySelector('#size').addEventListener('click', event => {
    const small = document.querySelector('.comparison').classList.toggle('small');
    event.currentTarget.setAttribute('aria-pressed', String(small)); event.currentTarget.textContent = small ? 'Посмотреть крупно' : 'В размере лагеря';
    sampling = false;
  });
  media.addEventListener('change', event => {
    const changed = event.matches !== lastMotionPreference;
    lastMotionPreference = event.matches;
    if (changed && event.matches) pause();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopNative(); else if (playing) { playing = false; resume(); }
    sync();
  });
  const observer = new ResizeObserver(resize); observer.observe(reference); observer.observe(canvas);
  window.addEventListener('pagehide', () => { disposed = true; observer.disconnect(); player?.cleanup(); }, { once: true });
  window.heroVectorReference = Object.freeze({ ready, state, replay, pause, resume, capture, captureFrame, setBackground, setOverride });
  sync(); start().catch(fail);
})();
