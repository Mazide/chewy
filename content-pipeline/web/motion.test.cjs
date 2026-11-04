const test = require("node:test");
const assert = require("node:assert/strict");
const { FramePlayer, motionCycleLength, motionFrameAt } = require("./motion.js");

function harness() {
  const events = {};
  const scheduled = new Map();
  let nextId = 0;
  let now = 1000;
  const images = [];
  global.document = { hidden: false, addEventListener: (name, callback) => { events[name] = callback; } };
  global.window = { addEventListener: (name, callback) => { events[name] = callback; } };
  global.performance = { now: () => now };
  global.requestAnimationFrame = (callback) => { scheduled.set(++nextId, callback); return nextId; };
  global.cancelAnimationFrame = (id) => scheduled.delete(id);
  global.Image = class {
    constructor() { images.push(this); }
    set src(value) { this.url = value; if (value && this.onload) this.onload(); }
    get src() { return this.url; }
  };
  const drawn = [];
  const element = () => ({ hidden: false, disabled: false, value: "", textContent: "", events: {},
    addEventListener(name, callback) { this.events[name] = callback; },
    setAttribute(name, value) { this[name] = value; },
  });
  const ui = Object.fromEntries(["canvas", "play", "restart", "timeline", "fps", "mode", "metadata", "previewNote", "status", "frameLabel", "error"].map((id) => [id, element()]));
  ui.canvas.getContext = () => ({ clearRect() {}, drawImage: (image) => drawn.push(image.url) });
  const player = new FramePlayer(ui);
  const attempt = (id, count = 12, mode = "loop", fps = 24) => ({ id, animation: { fps, playback: mode,
    frames: Array.from({ length: count }, (_, index) => ({ index, filename: `${index}.png`, url: `/${id}/${index}.png`, width: 10, height: 20 })),
  } });
  return { player, ui, attempt, events, scheduled, drawn, images, advance(milliseconds) {
    now += milliseconds;
    const callbacks = [...scheduled.values()];
    scheduled.clear();
    callbacks.forEach((callback) => callback(now));
  } };
}

test("pingpong visits endpoints once per turn and duration matches its cycle", () => {
  assert.equal(motionCycleLength(4, "pingpong"), 6);
  assert.deepEqual(Array.from({ length: 13 }, (_, step) => motionFrameAt(step, 4, "pingpong")), [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0]);
  assert.equal(motionCycleLength(121, "once") / 24, 121 / 24);
});

test("loop wraps while one-shot holds final frame", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((step) => motionFrameAt(step, 3, "loop")), [0, 1, 2, 0, 1]);
  assert.deepEqual([0, 1, 2, 3, 4].map((step) => motionFrameAt(step, 3, "once")), [0, 1, 2, 2, 2]);
});

test("loads paused, bounds decoded image cache, and plays according to elapsed time", () => {
  const h = harness();
  h.player.configure(h.attempt("a", 121));
  assert.equal(h.player.playing, false);
  assert.equal(h.drawn.at(-1), "/a/0.png");
  assert.equal(h.player.cache.size, 5);
  h.player.play();
  h.advance(500);
  assert.equal(h.drawn.at(-1), "/a/12.png");
  assert.ok(h.player.cache.size <= 5);
  assert.equal(h.ui.frameLabel.textContent, "Кадр 13 / 121");
  assert.equal(h.ui.timeline["aria-valuetext"], "Кадр 13 из 121");
});

test("one-shot stops after full duration and restarts at first frame", () => {
  const h = harness();
  h.player.configure(h.attempt("a", 3, "once", 10));
  h.player.play();
  h.advance(300);
  assert.equal(h.player.playing, false);
  assert.equal(h.drawn.at(-1), "/a/2.png");
  assert.equal(h.scheduled.size, 0);
  h.player.play();
  assert.equal(h.drawn.at(-1), "/a/0.png");
});

test("scrub pauses and preview overrides preserve imported timing", () => {
  const h = harness();
  h.player.configure(h.attempt("a", 12, "once", 24));
  h.player.play();
  h.ui.timeline.value = 7;
  h.ui.timeline.events.input();
  assert.equal(h.player.playing, false);
  assert.equal(h.drawn.at(-1), "/a/7.png");
  h.ui.fps.value = 12;
  h.ui.fps.events.change();
  h.ui.mode.value = "pingpong";
  h.ui.mode.events.change();
  assert.equal(h.player.savedFps, 24);
  assert.equal(h.player.savedMode, "once");
  assert.match(h.ui.metadata.textContent, /24 FPS/);
  assert.match(h.ui.previewNote.textContent, /Только просмотр: 12 FPS/);
});

test("hidden page pauses; changing attempt releases old image handles and timer", () => {
  const h = harness();
  h.player.configure(h.attempt("a"));
  h.player.play();
  global.document.hidden = true;
  h.events.visibilitychange();
  assert.equal(h.player.playing, false);
  assert.equal(h.scheduled.size, 0);
  global.document.hidden = false;
  const oldImages = [...h.images];
  h.player.play();
  h.player.configure(h.attempt("b"));
  assert.ok(oldImages.every((image) => image.src === ""));
  assert.equal(h.player.playing, false);
  assert.equal(h.scheduled.size, 0);
  assert.equal(h.drawn.at(-1), "/b/0.png");
});

test("frame load failure stops playback and exposes a visible error", () => {
  const h = harness();
  h.player.configure(h.attempt("a"));
  h.player.play();
  h.player.cache.get(1).image.onerror();
  assert.equal(h.player.playing, false);
  assert.equal(h.ui.error.hidden, false);
  assert.match(h.ui.error.textContent, /кадр 2/);
  assert.equal(h.ui.play.disabled, true);
  assert.equal(h.scheduled.size, 0);
});
