"use strict";

(() => {
  const labels = { CampScene: "Вся сцена", Tent: "Палатка", Hero: "Герой", Dog: "Пёс", Campfire: "Костёр", Kettle: "Чайник" };
  const source = "../exports/camp-scene-vector.riv";
  const canvas = document.getElementById("rive-canvas");
  const stage = document.getElementById("stage");
  const status = document.getElementById("status");
  const playback = document.getElementById("playback");
  const errorBox = document.getElementById("error");
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const buttons = Array.from(document.querySelectorAll("[data-artboard]"));
  let player = null;
  let selected = "CampScene";
  let wantsPlayback = !motionPreference.matches;
  let loaded = false;
  let assetBytes = null;
  let loadNumber = 0;

  function syncPlayback() {
    document.getElementById("playback-label").textContent = wantsPlayback ? "Пауза" : "Воспроизвести";
    document.getElementById("playback-icon").textContent = wantsPlayback ? "Ⅱ" : "▶";
    playback.setAttribute("aria-label", wantsPlayback ? "Приостановить анимацию" : "Воспроизвести анимацию");
    if (loaded) {
      status.textContent = wantsPlayback ? "Анимация воспроизводится." : motionPreference.matches
        ? "Пауза. Учтена настройка уменьшения движения." : "Анимация приостановлена.";
    }
  }

  function applyPlayback() {
    if (!player || !loaded) return;
    if (wantsPlayback && !document.hidden) {
      player.play(selected);
      player.startRendering();
    } else {
      player.pause();
      // Freezes nested artboards too, preserving the current frame.
      player.stopRendering();
    }
    syncPlayback();
  }

  function fail(message) {
    loaded = false;
    playback.disabled = true;
    stage.setAttribute("aria-busy", "false");
    status.textContent = "Не удалось открыть анимацию.";
    document.getElementById("error-message").textContent = message;
    errorBox.hidden = false;
  }

  async function mount() {
    const currentLoad = ++loadNumber;
    loaded = false;
    playback.disabled = true;
    errorBox.hidden = true;
    stage.setAttribute("aria-busy", "true");
    status.textContent = "Загружаем сцену…";
    if (player) { player.cleanup(); player = null; }
    try {
      if (location.protocol === "file:") throw new Error("Откройте просмотр через локальный сервер. Команда запуска есть в preview/README.md.");
      if (!window.rive) throw new Error("Не найден локальный Rive runtime. Проверьте папку preview/vendor.");
      rive.RuntimeLoader.setWasmUrl("./vendor/webgl2-2.40.1/rive.wasm");
      rive.RuntimeLoader.setWasmFallbackUrl("./vendor/webgl2-2.40.1/rive_fallback.wasm");
      if (!assetBytes) {
        const response = await fetch(source);
        if (!response.ok) throw new Error("Файл сцены не найден. Сначала соберите exports/camp-scene-vector.riv.");
        assetBytes = await response.arrayBuffer();
      }
      await rive.RuntimeLoader.awaitInstance();
      if (currentLoad !== loadNumber) return;
      const instance = new rive.Rive({
        buffer: assetBytes,
        canvas,
        artboard: selected,
        stateMachines: selected,
        autoBind: false,
        autoplay: wantsPlayback,
        enableRiveAssetCDN: false,
        shouldDisableRiveListeners: true,
        layout: new rive.Layout({ fit: rive.Fit.Contain, alignment: rive.Alignment.Center }),
        onLoad: () => {
          if (currentLoad !== loadNumber) return;
          // Rive initializes paused state machines AFTER firing onLoad.
          // Wait for that initialization before drawing and freezing a still.
          queueMicrotask(() => {
            if (currentLoad !== loadNumber) return;
            loaded = true;
            if (!wantsPlayback) {
              instance.pause();
              instance.stopRendering();
            }
            instance.resizeDrawingSurfaceToCanvas();
            if (!wantsPlayback) instance.stopRendering();
            playback.disabled = false;
            stage.setAttribute("aria-busy", "false");
            syncPlayback();
          });
        },
        onLoadError: () => {
          if (currentLoad === loadNumber) fail("Rive не смог прочитать сцену. Проверьте экспорт .riv и поддержку WebGL2 в браузере.");
        },
      });
      player = instance;
    } catch (error) {
      if (currentLoad === loadNumber) fail(error.message || "Не удалось загрузить локальный runtime. Обновите страницу.");
    }
  }

  buttons.forEach(button => button.addEventListener("click", () => {
    if (button.dataset.artboard === selected) return;
    selected = button.dataset.artboard;
    buttons.forEach(item => item.setAttribute("aria-pressed", String(item === button)));
    document.getElementById("stage-title").textContent = labels[selected];
    document.getElementById("stage-detail").textContent = selected === "CampScene" ? "390 × 844" : "Отдельный объект";
    canvas.setAttribute("aria-label", selected === "CampScene" ? "Анимированный лагерь Chewy" : labels[selected] + ": отдельная анимация Rive");
    stage.dataset.view = selected === "CampScene" ? "scene" : "object";
    mount();
  }));
  playback.addEventListener("click", () => { wantsPlayback = !wantsPlayback; applyPlayback(); });
  document.getElementById("retry").addEventListener("click", () => { assetBytes = null; mount(); });
  motionPreference.addEventListener("change", event => { if (event.matches) { wantsPlayback = false; applyPlayback(); } });
  document.addEventListener("visibilitychange", applyPlayback);
  new ResizeObserver(() => {
    if (!loaded || !player) return;
    if (!wantsPlayback) player.stopRendering();
    player.resizeDrawingSurfaceToCanvas();
    if (!wantsPlayback) player.stopRendering();
  }).observe(canvas);
  window.addEventListener("pagehide", () => { if (player) player.cleanup(); });
  syncPlayback();
  mount();
})();
