"use strict";

/* Frame timing is independent of display refresh rate. No artwork is transformed. */
function motionCycleLength(count, mode) {
  return mode === "pingpong" ? Math.max(1, count * 2 - 2) : count;
}

function motionFrameAt(step, count, mode) {
  if (count < 2) return 0;
  if (mode === "once") return Math.min(Math.max(0, step), count - 1);
  const length = motionCycleLength(count, mode);
  const position = ((step % length) + length) % length;
  return mode === "pingpong" && position >= count ? length - position : position;
}

class FramePlayer {
  constructor(elements) {
    this.ui = elements;
    this.key = null;
    this.frames = [];
    this.cache = new Map();
    this.generation = 0;
    this.raf = null;
    this.playing = false;
    this.step = 0;
    this.displayedIndex = -1;
    this.wantedIndex = 0;
    this.error = false;
    elements.play.addEventListener("click", () => this.playing ? this.pause() : this.play());
    elements.restart.addEventListener("click", () => { this.pause(); this.step = 0; this.showFrame(0); });
    elements.timeline.addEventListener("input", () => {
      this.pause();
      this.step = Number(elements.timeline.value);
      this.showFrame(this.step);
    });
    elements.fps.addEventListener("change", () => {
      this.pause();
      this.fps = Math.min(60, Math.max(1, Number(elements.fps.value) || this.savedFps));
      elements.fps.value = this.fps;
      this.updateMetadata();
    });
    elements.mode.addEventListener("change", () => {
      this.pause();
      this.mode = elements.mode.value;
      this.step = Math.max(0, this.displayedIndex);
      this.updateMetadata();
    });
    document.addEventListener("visibilitychange", () => { if (document.hidden) this.pause(); });
    window.addEventListener("pagehide", () => this.clear());
  }

  configure(attempt) {
    if (attempt?.id === this.key) return;
    this.clear();
    if (!attempt?.animation?.frames?.length) return;
    this.key = attempt.id;
    this.frames = attempt.animation.frames;
    this.savedFps = Number(attempt.animation.fps);
    this.savedMode = attempt.animation.playback;
    this.fps = this.savedFps;
    this.mode = this.savedMode;
    this.ui.fps.value = this.fps;
    this.ui.mode.value = this.mode;
    this.ui.timeline.min = 0;
    this.ui.timeline.max = this.frames.length - 1;
    this.ui.timeline.value = 0;
    this.ui.canvas.width = this.frames[0].width;
    this.ui.canvas.height = this.frames[0].height;
    this.ui.play.disabled = false;
    this.ui.restart.disabled = false;
    this.ui.timeline.disabled = false;
    this.updateMetadata();
    this.showFrame(0);
  }

  clear() {
    this.pause();
    this.generation += 1;
    for (const entry of this.cache.values()) {
      entry.image.onload = null;
      entry.image.onerror = null;
      entry.image.src = "";
    }
    this.cache.clear();
    this.key = null;
    this.frames = [];
    this.step = 0;
    this.displayedIndex = -1;
    this.wantedIndex = 0;
    this.error = false;
    this.ui.canvas.getContext("2d").clearRect(0, 0, this.ui.canvas.width, this.ui.canvas.height);
    this.ui.error.hidden = true;
    this.ui.error.textContent = "";
  }

  updateMetadata() {
    const names = { once: "один раз", loop: "цикл", pingpong: "туда-обратно" };
    const savedDuration = motionCycleLength(this.frames.length, this.savedMode) / this.savedFps;
    const previewDuration = motionCycleLength(this.frames.length, this.mode) / this.fps;
    this.ui.metadata.textContent = `${this.frames.length} кадров · ${this.savedFps} FPS · ${savedDuration.toFixed(2)} с · ${names[this.savedMode]}`;
    const changed = this.fps !== this.savedFps || this.mode !== this.savedMode;
    this.ui.previewNote.textContent = changed
      ? `Только просмотр: ${this.fps} FPS, ${names[this.mode]}, ${previewDuration.toFixed(2)} с. В экспорт уйдут сохранённые ${this.savedFps} FPS и режим «${names[this.savedMode]}».`
      : "Скорость и повтор меняют только просмотр. Тайминг экспорта задаётся при загрузке ZIP.";
  }

  play() {
    if (!this.frames.length || this.error || document.hidden) return;
    if (this.mode === "once" && this.step >= this.frames.length - 1) this.step = 0;
    this.playing = true;
    this.startStep = this.step;
    this.startedAt = performance.now();
    this.ui.play.textContent = "Пауза";
    this.ui.play.setAttribute("aria-pressed", "true");
    this.tick(this.startedAt);
  }

  pause() {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.playing = false;
    this.ui.play.textContent = "Воспроизвести";
    this.ui.play.setAttribute("aria-pressed", "false");
    if (this.frames.length && !this.error) this.ui.status.textContent = "Пауза. Можно перемещаться по кадрам.";
  }

  tick(now) {
    if (!this.playing) return;
    this.step = this.startStep + Math.floor((now - this.startedAt) * this.fps / 1000);
    if (this.mode === "once" && this.step >= this.frames.length) {
      this.step = this.frames.length - 1;
      this.pause();
      this.showFrame(this.step);
      this.ui.status.textContent = "Просмотр завершён. Можно воспроизвести снова.";
      return;
    }
    this.showFrame(motionFrameAt(this.step, this.frames.length, this.mode));
    this.raf = requestAnimationFrame((time) => this.tick(time));
  }

  showFrame(index) {
    if (!this.frames.length || this.error) return;
    this.wantedIndex = index;
    const retain = new Set([index]);
    for (let offset = 1; offset <= 4; offset += 1) retain.add(motionFrameAt(this.step + offset, this.frames.length, this.mode));
    for (const [cachedIndex, entry] of this.cache) {
      if (retain.has(cachedIndex)) continue;
      entry.image.onload = null;
      entry.image.onerror = null;
      entry.image.src = "";
      this.cache.delete(cachedIndex);
    }
    for (const nextIndex of retain) this.loadFrame(nextIndex);
    const entry = this.cache.get(index);
    if (entry?.ready) this.draw(index, entry.image);
    else this.ui.status.textContent = `Загрузка кадра ${index + 1}…`;
  }

  loadFrame(index) {
    if (this.cache.has(index)) return;
    const generation = this.generation;
    const image = new Image();
    const entry = { image, ready: false };
    this.cache.set(index, entry);
    image.onload = () => {
      if (generation !== this.generation || this.cache.get(index) !== entry) return;
      entry.ready = true;
      if (this.wantedIndex === index) this.draw(index, image);
    };
    image.onerror = () => {
      if (generation !== this.generation || this.cache.get(index) !== entry) return;
      this.pause();
      this.error = true;
      this.ui.error.hidden = false;
      this.ui.error.textContent = `Не удалось открыть кадр ${index + 1} (${this.frames[index].filename}). Обновите страницу или проверьте сохранённый файл.`;
      this.ui.status.textContent = "Воспроизведение остановлено: ошибка кадра.";
      this.ui.play.disabled = true;
      this.ui.restart.disabled = true;
      this.ui.timeline.disabled = true;
    };
    image.src = this.frames[index].url;
  }

  draw(index, image) {
    if (index !== this.displayedIndex) {
      const context = this.ui.canvas.getContext("2d");
      context.clearRect(0, 0, this.ui.canvas.width, this.ui.canvas.height);
      context.drawImage(image, 0, 0);
      this.displayedIndex = index;
      this.ui.timeline.value = index;
      this.ui.timeline.setAttribute("aria-valuetext", `Кадр ${index + 1} из ${this.frames.length}`);
      this.ui.frameLabel.textContent = `Кадр ${index + 1} / ${this.frames.length}`;
      this.ui.canvas.setAttribute("aria-label", `Анимация, кадр ${index + 1} из ${this.frames.length}`);
    }
    this.ui.status.textContent = this.playing ? "Воспроизводится последовательность PNG-кадров." : "Пауза. Нажмите «Воспроизвести» или выберите кадр.";
  }
}

globalThis.ChewyMotion = { FramePlayer, motionCycleLength, motionFrameAt };
if (typeof module !== "undefined") module.exports = globalThis.ChewyMotion;
