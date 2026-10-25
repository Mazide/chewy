export const PLACEMENT_STORAGE_KEY = 'chewy.sandbox.placement.v1';
const MOVABLE_IDS = ['tent', 'hero', 'fire', 'pet', 'kettle', 'map', 'backpack', 'food', 'action'];
const DEVICE_IDS = ['compact', 'standard', 'large'];

export function readPlacements(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || !parsed.devices || typeof parsed.devices !== 'object') return {};
    return Object.fromEntries(DEVICE_IDS.map((device) => [device, Object.fromEntries(MOVABLE_IDS.flatMap((id) => {
      const offset = parsed.devices[device]?.[id];
      return Array.isArray(offset) && [2, 3].includes(offset.length) && offset.every(Number.isFinite) && (offset.length === 2 || offset[2] > 0) ? [[id, offset]] : [];
    }))]));
  } catch { return {}; }
}

export function clampMovement(frame, delta, viewport) {
  const [x, y, width, height] = frame;
  return [Math.max(-x, Math.min(viewport.width - width - x, delta[0])), Math.max(-y, Math.min(viewport.height - height - y, delta[1]))];
}

const translate = ([x, y, width, height], [dx, dy]) => [x + dx, y + dy, width, height];

export function getResizeLimits(base, id) {
  const frame = getMovableFrame(base, id);
  if (!frame) return null;
  const [, , width, height] = frame;
  const isObject = base.objects.some((object) => object.id === id);
  const min = isObject ? .25 : Math.max((id === 'food' || id === 'action' ? 160 : 56) / width, 44 / height);
  return { min, max: Math.min(3, base.width / width, base.height / height) };
}

export function getCurrentPlacement(base, layout, id) {
  const original = getMovableFrame(base, id), current = getMovableFrame(layout, id);
  if (!original || !current) return null;
  const object = layout.objects.find((item) => item.id === id);
  const baseObject = base.objects.find((item) => item.id === id);
  return [object ? object.foot[0] - baseObject.foot[0] : current[0] - original[0], object ? object.foot[1] - baseObject.foot[1] : current[1] - original[1], current[2] / original[2]];
}

export function moveSandboxLayout(base, offsets = {}) {
  const objects = base.objects.map((object) => {
    const [dx, dy, requestedScale = 1] = offsets[object.id] ?? [0, 0, 1];
    const limits = getResizeLimits(base, object.id);
    const scale = Math.max(limits.min, Math.min(limits.max, requestedScale));
    let foot = [object.foot[0] + dx, object.foot[1] + dy];
    const width = object.frame[2] * scale, height = object.frame[3] * scale;
    const frame = [foot[0] - width / 2, foot[1] - height, width, height];
    const clamp = clampMovement(frame, [0, 0], base);
    foot = [foot[0] + clamp[0], foot[1] + clamp[1]];
    const transform = ([x, y, w, h]) => [foot[0] + (x - object.foot[0]) * scale, foot[1] + (y - object.foot[1]) * scale, w * scale, h * scale];
    return {
      ...object, foot, frame: translate(frame, clamp),
      shadows: object.shadows.map(transform),
      contacts: object.contacts.map(transform),
      grass: object.grass.map((frame) => frame.map((value) => value * scale)),
    };
  }).sort((a, b) => a.foot[1] - b.foot[1]);
  const resizeUI = (id, original) => {
    const [dx, dy, requestedScale = 1] = offsets[id] ?? [0, 0, 1];
    const limits = getResizeLimits(base, id);
    const scale = Math.max(limits.min, Math.min(limits.max, requestedScale));
    const frame = [original[0] + dx, original[1] + dy, original[2] * scale, original[3] * scale];
    return translate(frame, clampMovement(frame, [0, 0], base));
  };
  return {
    ...base, objects,
    controls: base.controls.map((control) => ({ ...control, frame: resizeUI(control.id, control.frame) })),
    food: resizeUI('food', base.food), action: resizeUI('action', base.action),
  };
}

export function getMovableFrame(layout, id) {
  return layout.objects.find((object) => object.id === id)?.frame ?? layout.controls.find((control) => control.id === id)?.frame ?? (id === 'food' ? layout.food : id === 'action' ? layout.action : null);
}
