"use strict";

(() => {
  const ARTBOARD = "HeroActions";
  const SOURCE = "/hero-actions/exports/hero-actions.riv";
  const VALUES = { action: ["idle", "walk", "sit", "reach"], outfit: ["camp", "trail"], prop: ["none", "stick"] };
  const LABELS = { idle: "Спокойно стоит", walk: "Шагает на месте", sit: "Сидит", reach: "Тянется рукой" };
  // A bounded placement corridor, independent of the action timelines.
  const ROOT_MIN = 600, ROOT_SPAN = 200, ROOT_Y = 1040;
  const defaults = () => ({ action: "idle", outfit: "camp", prop: "none", x: 50, facing: 1 });
  const $ = id => document.getElementById(id);
  const canvas = $("rive-canvas"), stage = $("stage");
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const events = new AbortController();
  let requested = defaults(), wantsPlayback = !motion.matches;
  let player = null, vm = null, loaded = false, disposed = false, generation = 0, error = null;
  let ready, resolveReady, rejectReady;
  let freezeAfterAdvance = false, settleOnAdvance = 0;

  function newReady() {
    ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    // Errors also have a visible retry UI; an unused API must not cause an unhandled rejection.
    ready.catch(() => {});
  }

  function state() {
    const rootX = vm?.number("rootX")?.value ?? ROOT_MIN + requested.x * ROOT_SPAN / 100;
    return {
      action: vm?.enum("action")?.value ?? requested.action,
      outfit: vm?.enum("outfit")?.value ?? requested.outfit,
      prop: vm?.enum("prop")?.value ?? requested.prop,
      x: (rootX - ROOT_MIN) / ROOT_SPAN * 100,
      rootX,
      rootY: vm?.number("rootY")?.value ?? ROOT_Y,
      facing: vm?.number("facing")?.value ?? requested.facing,
      positionSource: "HeroControls",
      ready: loaded,
      playing: loaded && wantsPlayback && !document.hidden,
      paused: !wantsPlayback,
      hidden: document.hidden,
      reducedMotion: motion.matches,
      error,
    };
  }

  function syncUI() {
    const actual = state();
    for (const key of Object.keys(VALUES)) {
      document.querySelectorAll(`[data-${key}]`).forEach(button => {
        button.setAttribute("aria-pressed", String(button.dataset[key] === actual[key]));
      });
    }
    $("position").value = String(actual.x);
    $("position-value").textContent = String(Math.round(actual.x));
    $("flip").setAttribute("aria-pressed", String(actual.facing === -1));
    $("playback").textContent = wantsPlayback ? "Пауза" : "Воспроизвести";
    $("pose-caption").textContent = LABELS[actual.action];
    canvas.setAttribute("aria-label", `Чуви: ${LABELS[actual.action].toLowerCase()}, ${actual.outfit === "camp" ? "обычная" : "походная"} одежда${actual.prop === "stick" ? ", палочка с зефиром" : ""}`);
    document.querySelectorAll("fieldset").forEach(fieldset => { fieldset.disabled = !loaded; });
    $("playback").disabled = $("reset").disabled = !loaded;
    stage.setAttribute("aria-busy", String(!loaded));
    if (loaded) $("status").textContent = document.hidden ? "Просмотр приостановлен в скрытой вкладке."
      : wantsPlayback ? "Движение идёт. Можно менять одежду и реквизит."
        : motion.matches ? "Движение уменьшено. Для просмотра нажми «Воспроизвести»." : "Пауза. Одежду и реквизит можно менять.";
  }

  function freeze(duringAdvance = false) {
    if (!loaded || !player) return;
    player.pause();
    player.stopRendering();
    // A paused draw resets the runtime clock. During onAdvance the current draw
    // already does this; do not enter the renderer recursively from that callback.
    if (!duringAdvance) player.drawFrame();
    player.stopRendering();
  }

  function redrawPaused(settleAction = false) {
    // Render one real frame. Pause from onAdvance before a second RAF is queued.
    freezeAfterAdvance = true;
    settleOnAdvance = settleAction ? .25 : 0;
    player.play(ARTBOARD);
  }

  function applyPlayback() {
    if (loaded && player) {
      if (wantsPlayback && !document.hidden) {
        // play() already starts rendering; repeated resume keeps the same run.
        if (!player.isPlaying) player.play(ARTBOARD);
      }
      else freeze();
    }
    syncUI();
  }

  function validate(patch) {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new TypeError("Передайте объект параметров персонажа.");
    for (const [key, value] of Object.entries(patch)) {
      if (VALUES[key]) { if (!VALUES[key].includes(value)) throw new RangeError(`Неизвестное значение ${key}: ${value}`); }
      else if (key === "x") { if (!Number.isFinite(value) || value < 0 || value > 100) throw new RangeError("x должен быть от 0 до 100."); }
      else if (key === "facing") { if (value !== 1 && value !== -1) throw new RangeError("facing должен быть 1 или -1."); }
      else throw new TypeError(`Неизвестный параметр: ${key}`);
    }
  }

  function writeVM(patch) {
    for (const [key, value] of Object.entries(patch)) {
      if (VALUES[key]) vm.enum(key).value = value;
      else if (key === "x") vm.number("rootX").value = ROOT_MIN + value * ROOT_SPAN / 100;
      else if (key === "facing") vm.number("facing").value = value;
    }
  }

  function set(patch) {
    validate(patch);
    const actionChanged = patch.action != null && patch.action !== state().action;
    requested = { ...requested, ...patch };
    if (loaded) {
      writeVM(patch);
      if (!wantsPlayback || document.hidden) redrawPaused(actionChanged);
    }
    syncUI();
    return state();
  }

  function pause() { wantsPlayback = false; applyPlayback(); return state(); }
  function resume() { wantsPlayback = true; applyPlayback(); return state(); }
  function reset() {
    wantsPlayback = !motion.matches;
    set(defaults());
    applyPlayback();
    return state();
  }

  function fail(message) {
    error = message;
    loaded = false;
    vm = null;
    if (player) { player.cleanup(); player = null; }
    syncUI();
    stage.setAttribute("aria-busy", "false");
    $("status").textContent = "Персонаж пока не загружен.";
    $("error-message").textContent = message;
    $("error").hidden = false;
    rejectReady(new Error(message));
  }

  async function mount() {
    const serial = ++generation;
    loaded = false; error = null; vm = null;
    if (player) { player.cleanup(); player = null; }
    newReady();
    $("error").hidden = true;
    $("status").textContent = "Загружаем Rive…";
    syncUI();
    try {
      if (!window.rive) throw new Error("Не загрузился Rive runtime. Проверь локальный маршрут /hero-actions/vendor/rive.js.");
      window.rive.RuntimeLoader.setWasmUrl("/hero-actions/vendor/rive.wasm");
      window.rive.RuntimeLoader.setWasmFallbackUrl("/hero-actions/vendor/rive_fallback.wasm");
      const response = await fetch(SOURCE, { cache: "no-store", signal: events.signal });
      if (!response.ok) throw new Error("Не найден hero-actions.riv. Собери ассет и нажми «Загрузить снова».");
      const buffer = await response.arrayBuffer();
      await window.rive.RuntimeLoader.awaitInstance();
      if (disposed || serial !== generation) return;
      const instance = new window.rive.Rive({
        buffer, canvas, artboard: ARTBOARD, stateMachines: ARTBOARD, autoBind: true,
        autoplay: false, enableRiveAssetCDN: false, shouldDisableRiveListeners: true,
        drawingOptions: window.rive.DrawOptimizationOptions.AlwaysDraw,
        layout: new window.rive.Layout({ fit: window.rive.Fit.Contain, alignment: window.rive.Alignment.Center }),
        onLoad: () => queueMicrotask(() => {
          if (disposed || serial !== generation) return;
          try {
            vm = instance.viewModelInstance;
            for (const [name, values] of Object.entries(VALUES)) {
              const property = vm?.enum(name);
              if (!property || values.some(value => !property.values.includes(value))) throw new Error(`В файле нет ожидаемого enum HeroControls.${name}.`);
            }
            for (const name of ["rootX", "rootY", "facing"]) if (!vm.number(name)) throw new Error(`В файле нет HeroControls.${name}.`);
            loaded = true;
            vm.number("rootY").value = ROOT_Y;
            writeVM(requested);
            instance.resizeDrawingSurfaceToCanvas();
            if (wantsPlayback && !document.hidden) applyPlayback();
            else { redrawPaused(requested.action !== "idle"); syncUI(); }
            // The runtime's onLoad precedes its first submitted WebGL frame.
            // Publish readiness after that frame has reached the browser, before
            // callers start changing bindings or taking a screenshot.
            requestAnimationFrame(() => requestAnimationFrame(() => {
              if (!disposed && serial === generation && loaded) resolveReady(state());
            }));
          } catch (issue) { fail(issue.message); }
        }),
        onAdvance: () => {
          if (!freezeAfterAdvance || !loaded) return;
          // Outfit and prop switches advance zero time. Only an explicitly chosen
          // action settles its blend into a stable still, without a visible loop.
          if (settleOnAdvance) {
            const delta = settleOnAdvance;
            settleOnAdvance = 0;
            player.advanceAndReportChanges(delta);
          }
          freezeAfterAdvance = false;
          freeze(true);
        },
        onLoadError: event => { if (!disposed && serial === generation) fail(`Не удалось прочитать Rive: ${event?.data || "проверь экспорт и поддержку WebGL2"}.`); },
      });
      player = instance;
    } catch (issue) { if (!disposed && serial === generation) fail(issue.message || "Не удалось открыть анимацию."); }
  }

  newReady();
  window.chewyHero = Object.freeze({ get ready() { return ready; }, set, pause, resume, reset, state });
  for (const key of Object.keys(VALUES)) document.querySelectorAll(`[data-${key}]`).forEach(button => {
    button.addEventListener("click", () => set({ [key]: button.dataset[key] }), { signal: events.signal });
  });
  document.querySelectorAll("[data-view]").forEach(button => {
    if (button.tagName !== "BUTTON") return;
    button.addEventListener("click", () => {
      stage.dataset.view = button.dataset.view;
      document.querySelectorAll("button[data-view]").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
    }, { signal: events.signal });
  });
  $("position").addEventListener("input", event => set({ x: Number(event.target.value) }), { signal: events.signal });
  $("flip").addEventListener("click", () => set({ facing: -state().facing }), { signal: events.signal });
  $("playback").addEventListener("click", () => wantsPlayback ? pause() : resume(), { signal: events.signal });
  $("reset").addEventListener("click", reset, { signal: events.signal });
  $("retry").addEventListener("click", mount, { signal: events.signal });
  motion.addEventListener("change", event => { if (event.matches) { pause(); set({ action: "idle" }); } }, { signal: events.signal });
  document.addEventListener("visibilitychange", applyPlayback, { signal: events.signal });
  const observer = new ResizeObserver(() => {
    if (!loaded || !player) return;
    player.resizeDrawingSurfaceToCanvas();
    if (!wantsPlayback || document.hidden) freeze();
  });
  observer.observe(canvas);
  window.addEventListener("pagehide", () => {
    disposed = true; ++generation; observer.disconnect(); events.abort();
    if (player) { player.cleanup(); player = null; }
    vm = null; loaded = false;
  }, { once: true });
  mount();
})();
