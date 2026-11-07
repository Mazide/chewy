/* Playback/inspection only: the Rive file owns every pose and motion curve. */
(() => {
  const DURATION = 4.8;
  const ARTBOARD = 'ChewyMotion';
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const entries = ['baseline', 'pilot'].map(version => ({ version, canvas: document.querySelector(`canvas[data-version="${version}"]`), player: null, loaded: false, staticPose: true, freezeNext: false }));
  const pilot = entries[1];
  const errors = [];
  let playing = false, finished = false, elapsed = 0, revision = null, disposed = false;
  let sampling = false, sampleEpoch = 0, clock = 0, previousTime = null;
  let resolveReady;
  const ready = new Promise(resolve => { resolveReady = resolve; });
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

  function state() {
    return { ready: entries.every(entry => entry.loaded), playing: playing && !document.hidden,
      finished, elapsed: Math.min(DURATION, elapsed), duration: DURATION, reducedMotion: media.matches,
      action: pilot.player?.viewModelInstance?.number('action')?.value ?? null,
      mode: pilot.staticPose ? 'timeline-sample' : 'native-state-machine', errors: [...errors], revision };
  }
  function sync() {
    const loaded = entries.every(entry => entry.loaded) && !errors.length;
    document.querySelectorAll('#replay,#playback,#rest,#timeline,[data-time]').forEach(control => { control.disabled = !loaded; });
    document.querySelector('#playback').textContent = playing ? 'Пауза' : finished || pilot.staticPose ? 'Воспроизвести' : 'Продолжить';
    document.querySelector('#status').textContent = errors.length ? 'Не удалось загрузить приветствие.' : !loaded ? 'Загружаем обе версии…' : document.hidden ? 'Просмотр приостановлен.' : playing ? 'Чуви машет. Слева можно сравнить исходный рисунок.' : finished ? 'Жест завершён. Чуви снова в спокойной позе; можно повторить.' : 'Движение остановлено. Можно рассмотреть любую позу.';
    updateTime();
  }
  function updateTime() {
    const value = Math.min(DURATION, elapsed);
    document.querySelector('#timeline').value = value;
    document.querySelector('#time').textContent = `${value.toFixed(2).replace('.', ',')} с`;
  }
  function stop(entry) {
    entry.freezeNext = false;
    entry.player.pause();
    entry.player.stopRendering();
  }
  function freezeAfterDraw(entry) { entry.freezeNext = true; entry.player.startRendering(); }
  function still(entry, time = 0) {
    stop(entry);
    const animation = entry.version === 'baseline' ? 'Idle' : 'Wave';
    entry.player.reset({ artboard: ARTBOARD, animations: animation, autoBind: true, autoplay: false });
    entry.player.scrub(animation, entry.version === 'baseline' ? 0 : time);
    entry.staticPose = true;
    freezeAfterDraw(entry);
  }
  function stopClock() { if (clock) cancelAnimationFrame(clock); clock = 0; previousTime = null; }
  function tick(timestamp) {
    if (!playing || document.hidden || disposed) { clock = 0; previousTime = null; return; }
    if (previousTime !== null) elapsed += (timestamp - previousTime) / 1000;
    previousTime = timestamp;
    updateTime();
    // Allow the native one-shot to reach its authored end before suspending rendering.
    // The final neutral pose is held in Wave/action=1; we do not claim an Idle transition.
    if (elapsed >= DURATION + 0.12) {
      elapsed = DURATION; playing = false; finished = true; stop(pilot); stopClock(); sync(); return;
    }
    clock = requestAnimationFrame(tick);
  }
  function startClock() { stopClock(); clock = requestAnimationFrame(tick); }
  function pause() { playing = false; stopClock(); for (const entry of entries) if (entry.loaded) stop(entry); sync(); }
  function replay() {
    if (!entries.every(entry => entry.loaded) || errors.length) return;
    sampleEpoch++; sampling = false; stopClock(); stop(pilot);
    pilot.player.reset({ artboard: ARTBOARD, stateMachines: ARTBOARD, autoBind: true, autoplay: false });
    const action = pilot.player.viewModelInstance.number('action');
    action.value = 0;
    pilot.player.play(ARTBOARD);
    pilot.player.advanceAndReportChanges(1 / 60); // State machine must observe action=0.
    action.value = 1;
    pilot.player.advanceAndReportChanges(0);
    pilot.staticPose = false; elapsed = 0; finished = false; playing = true;
    if (!document.hidden) { pilot.player.startRendering(); startClock(); }
    sync();
  }
  function resume() {
    if (!pilot.loaded || errors.length) return;
    if (pilot.staticPose || finished) { replay(); return; }
    playing = true;
    if (!document.hidden) { pilot.player.play(ARTBOARD); pilot.player.startRendering(); startClock(); }
    sync();
  }
  async function capture(time) {
    if (!Number.isFinite(time) || time < 0 || time > DURATION) throw new RangeError('Invalid greeting sample time');
    await ready;
    if (errors.length) throw new Error(errors.join('; '));
    const epoch = ++sampleEpoch;
    pause(); sampling = true; elapsed = time; finished = time === DURATION;
    for (const entry of entries) still(entry, time);
    await nextFrame(); await nextFrame(); await nextFrame();
    if (epoch === sampleEpoch) { for (const entry of entries) stop(entry); sampling = false; sync(); }
    return state();
  }
  async function rest() {
    await ready;
    if (errors.length) return;
    sampleEpoch++; sampling = false; pause(); elapsed = 0; finished = false;
    still(entries[0]);
    stop(pilot);
    pilot.player.reset({ artboard: ARTBOARD, stateMachines: ARTBOARD, autoBind: true, autoplay: false });
    pilot.player.viewModelInstance.number('action').value = 0;
    pilot.player.play(ARTBOARD); pilot.player.advanceAndReportChanges(1 / 60); pilot.player.pause();
    pilot.staticPose = false; freezeAfterDraw(pilot); sync();
  }
  function fail(error) {
    playing = false; stopClock(); errors.push(String(error.message || error));
    for (const entry of entries) if (entry.loaded) stop(entry);
    document.querySelector('#error').hidden = false;
    document.querySelector('#error p').textContent = `Не удалось открыть пробу: ${error.message || error}`;
    sync(); resolveReady(state());
  }
  async function mount(entry, url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Файл ${entry.version} недоступен (${response.status})`);
    const buffer = await response.arrayBuffer();
    return new Promise((resolve, reject) => {
      const player = new rive.Rive({ buffer, canvas: entry.canvas, artboard: ARTBOARD, stateMachines: ARTBOARD,
        autoBind: true, autoplay: false, enableRiveAssetCDN: false, shouldDisableRiveListeners: true,
        drawingOptions: rive.DrawOptimizationOptions.AlwaysDraw,
        layout: new rive.Layout({ fit: rive.Fit.Contain, alignment: rive.Alignment.Center }),
        onLoad: () => queueMicrotask(() => {
          if (disposed) return;
          try {
            if (!player.viewModelInstance?.number('action')) throw new Error('В Rive отсутствует action');
            if (!player.animationNames.includes('Wave') || !player.animationNames.includes('Idle')) throw new Error('В Rive отсутствуют Idle/Wave');
            entry.loaded = true; player.resizeDrawingSurfaceToCanvas(); still(entry); resolve();
          } catch (error) { reject(error); }
        }),
        onAdvance: () => { if (entry.freezeNext) { entry.freezeNext = false; entry.player.pause(); entry.player.stopRendering(); } },
        onLoadError: () => reject(new Error(`Rive не открыл ${entry.version}`)),
      });
      entry.player = player;
    });
  }
  async function start() {
    if (!window.rive) throw new Error('Не найден локальный Rive runtime');
    rive.RuntimeLoader.setWasmUrl(new URL('../vendor/rive.wasm', location.href).href);
    rive.RuntimeLoader.setWasmFallbackUrl(new URL('../vendor/rive_fallback.wasm', location.href).href);
    const requested = new URL(location.href).searchParams.get('run');
    let runDir;
    if (requested) {
      if (!/^[A-Za-z0-9_-]+$/.test(requested)) throw new Error('Некорректный номер сборки');
      runDir = `runs/${requested}`; revision = requested;
    } else {
      const response = await fetch('../exports/latest.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Сначала выполните сборку pipeline.py');
      const latest = await response.json(); runDir = latest.run_dir; revision = latest.run_id || runDir;
    }
    if (!/^runs\/[A-Za-z0-9_-]+$/.test(runDir)) throw new Error('Некорректный путь выпуска');
    const base = new URL(`../exports/${runDir}/`, location.href);
    document.querySelector('#revision').textContent = revision;
    document.querySelector('#manifest').href = new URL('manifest.json', base).href;
    await rive.RuntimeLoader.awaitInstance();
    await Promise.all(entries.map(entry => mount(entry, new URL(entry.version === 'pilot' ? 'chewy.riv' : 'baseline-chewy.riv', base).href)));
    sync(); resolveReady(state());
    if (!media.matches && !document.hidden) replay();
  }
  document.querySelector('#replay').addEventListener('click', replay);
  document.querySelector('#playback').addEventListener('click', () => playing ? pause() : resume());
  document.querySelector('#rest').addEventListener('click', () => rest().catch(fail));
  document.querySelector('#timeline').addEventListener('input', event => capture(Number(event.target.value)).catch(fail));
  document.querySelectorAll('[data-time]').forEach(button => button.addEventListener('click', () => capture(Number(button.dataset.time)).catch(fail)));
  document.querySelector('#retry').addEventListener('click', () => location.reload());
  document.querySelector('#size').addEventListener('click', event => {
    const small = document.querySelector('.comparison').classList.toggle('small');
    event.currentTarget.setAttribute('aria-pressed', String(small)); event.currentTarget.textContent = small ? 'Посмотреть крупно' : 'В размере лагеря';
  });
  media.addEventListener('change', event => { if (event.matches) pause(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stopClock(); for (const entry of entries) if (entry.loaded) stop(entry); }
    else if (playing) { pilot.player.play(ARTBOARD); pilot.player.startRendering(); startClock(); }
    sync();
  });
  const observer = new ResizeObserver(() => {
    if (sampling) return;
    for (const entry of entries) {
      if (!entry.loaded) continue;
      entry.player.resizeDrawingSurfaceToCanvas();
      if (entry.version === 'baseline' || !playing || document.hidden) freezeAfterDraw(entry);
    }
  });
  entries.forEach(entry => observer.observe(entry.canvas));
  window.addEventListener('pagehide', () => { disposed = true; stopClock(); observer.disconnect(); entries.forEach(entry => entry.player?.cleanup()); }, { once: true });
  window.heroMotionPilot = Object.freeze({ ready, state, replay, pause, resume, rest, capture });
  sync(); start().catch(fail);
})();
