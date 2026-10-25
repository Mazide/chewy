import bounds from './sandbox-image-bounds.js';

export const SANDBOX_DEVICES = {
  compact: { label: 'Компактный', width: 320, height: 568, safeTop: 24, safeBottom: 16 },
  standard: { label: 'Обычный', width: 390, height: 844, safeTop: 44, safeBottom: 34 },
  large: { label: 'Большой', width: 430, height: 932, safeTop: 59, safeBottom: 34 },
};

// Each position is the bottom-center point where the object touches the ground.
// Measurements are draft layout units in a 390 × 500 scene, separate from the HUD.
const GROUND_OBJECTS = {
  tent: { anchor: [96, 194], height: 88 },
  hero: { anchor: [158, 420], height: 360 },
  fire: { anchor: [278, 434], height: 82 },
  pet: { anchor: [78, 438], height: 64 },
  kettle: { anchor: [236, 450], height: 44 },
};

// Local silhouette coordinates. Each boot/log touches at a different height;
// a single ellipse at the bottom of the whole PNG leaves visible gaps.
const SURFACE_CONTACTS = {
  hero: {
    patches: [[.06, .997, .24, 3.4], [.73, .997, .22, 3.4]],
    grass: [[.09, 1, 10], [.87, 1, 8]],
  },
  fire: {
    patches: [[.10, .998, .22, 3], [.80, .981, .18, 3]],
    grass: [[.14, 1, 9], [.89, .985, 10]],
  },
  kettle: {
    patches: [[.33, .998, .43, 3]],
    grass: [[.20, .975, 7]],
  },
};

export function getSandboxLayout(device) {
  const { width, height, safeTop, safeBottom } = device;
  const gutter = width < 360 ? 16 : 24;
  const header = [gutter, safeTop + 12, width - gutter * 2, 40];
  const action = [gutter, height - safeBottom - 10 - 56, width - gutter * 2, 56];
  const food = [gutter, action[1] - 16 - 68, width - gutter * 2, 68];
  const sceneTop = header[1] + header[3] + 12;
  const sceneBottom = food[1] - 16;
  const availableHeight = sceneBottom - sceneTop;
  const scale = Math.min(width / 390, availableHeight / 500);
  const offsetX = (width - 390 * scale) / 2;
  const offsetY = sceneBottom - 500 * scale;
  const objects = Object.entries(GROUND_OBJECTS).map(([id, { anchor, height: objectHeight }]) => {
    const trim = bounds[id];
    const h = objectHeight * scale;
    const w = h * trim.width / trim.height;
    const foot = [offsetX + anchor[0] * scale, offsetY + anchor[1] * scale];
    const frame = [foot[0] - w / 2, foot[1] - h, w, h];
    const surface = SURFACE_CONTACTS[id];
    const contacts = (surface?.patches ?? []).map(([x, y, span, thickness]) => [frame[0] + w * x, frame[1] + h * y - thickness * scale * .35, w * span, thickness * scale]);
    const shadows = contacts.length ? contacts.map(([x, y, span]) => [x - span * .15, y - 1.5 * scale, span * 1.3, 6 * scale]) : [[foot[0] - w * .38, foot[1] - 3 * scale, w * .76, 7 * scale]];
    const grass = (surface?.grass ?? []).map(([x, y, size]) => [x * w - size * scale / 2, y * h - size * scale * .40, size * scale, size * scale * .55]);
    return { id, foot, frame, shadows, contacts, grass };
  }).sort((a, b) => a.foot[1] - b.foot[1]);
  const controlWidth = scale < .85 ? 56 : 64;
  const controlHeight = controlWidth + 18;
  const fireTop = objects.find((object) => object.id === 'fire').frame[1];
  const controlTop = Math.max(sceneTop, Math.min(sceneTop + availableHeight * .34, fireTop - 16 - (controlHeight * 2 + 14)));
  const controlX = width - 12 - controlWidth;
  return {
    width, height, scale, header, action, food, scene: [offsetX, offsetY, 390 * scale, 500 * scale], objects,
    controls: [
      { id: 'map', screen: 'path', label: 'Путь', frame: [controlX, controlTop, controlWidth, controlHeight] },
      { id: 'backpack', screen: 'backpack', label: 'Рюкзак', frame: [controlX, controlTop + controlHeight + 14, controlWidth, controlHeight] },
    ],
  };
}

export function viewportFrame([x, y, width, height], viewport) {
  return { left: `${x / viewport.width * 100}%`, top: `${y / viewport.height * 100}%`, width: `${width / viewport.width * 100}%`, height: `${height / viewport.height * 100}%` };
}

export function croppedImageStyle(id) {
  const trim = bounds[id];
  return { width: `${trim.sourceWidth / trim.width * 100}%`, height: `${trim.sourceHeight / trim.height * 100}%`, left: `${-trim.x / trim.width * 100}%`, top: `${-trim.y / trim.height * 100}%` };
}
