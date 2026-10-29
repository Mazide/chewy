// Prototype fixtures. Routes, finds and the sample interval are proposals,
// not a daily movement goal. Real Health data is not connected.
export const EXPLORATION_DEMO = Object.freeze({ progressPerDiscovery: 2000 });

// Input scales only make the workshop states reachable. They express neither
// physical equivalence between activities nor a recommended amount of movement.
export const EXPLORATION_ACTIVITIES = Object.freeze([
  { id: 'steps', label: 'Ходьба и бег', inputLabel: 'Сумма шагов за день', unit: 'шагов', samplePerDiscovery: 2000, increment: 500 },
  { id: 'cycling', label: 'Велосипед', inputLabel: 'Минуты активности за день', unit: 'минут', samplePerDiscovery: 20, increment: 5 },
  { id: 'swimming', label: 'Плавание', inputLabel: 'Минуты активности за день', unit: 'минут', samplePerDiscovery: 20, increment: 5 },
  { id: 'other', label: 'Другие занятия', inputLabel: 'Минуты активности за день', unit: 'минут', samplePerDiscovery: 20, increment: 5 },
].map(Object.freeze));

export const EXPLORATION_ROUTES = Object.freeze([
  {
    id: 'brook',
    name: 'Тихий берег',
    description: 'Посмотреть, что прячет берег лесного ручья.',
    findingId: 'hat-bucket',
    findingName: 'Панама у берега',
  },
  {
    id: 'pines',
    name: 'Сосновая тропа',
    description: 'Заглянуть под сосны рядом с лагерем.',
    findingId: 'hat-trail',
    findingName: 'Походная шляпа',
  },
].map(Object.freeze));

export function createExplorationStudy() {
  return {
    selectedRouteId: null,
    progress: { brook: 0, pines: 0 },
    originStops: {},
    activityPeaks: {},
    found: [],
    seenFindings: [],
    placedId: null,
  };
}

export function selectExplorationRoute(state, id, stopIndex = 0) {
  if (!EXPLORATION_ROUTES.some(route => route.id === id) || !Number.isSafeInteger(stopIndex) || stopIndex < 0
    || state.selectedRouteId === id) return state;
  return { ...state, selectedRouteId: id,
    originStops: Object.hasOwn(state.originStops, id) ? state.originStops : { ...state.originStops, [id]: stopIndex } };
}

function validDayKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const normalizedAmount = (activity, amount) => amount * (EXPLORATION_DEMO.progressPerDiscovery / activity.samplePerDiscovery);

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const uniqueList = (value, allowed) => Array.isArray(value) && new Set(value).size === value.length
  && value.every(id => allowed.includes(id));

export function validateExplorationStudy(state) {
  const routeIds = EXPLORATION_ROUTES.map(route => route.id);
  const findingIds = EXPLORATION_ROUTES.map(route => route.findingId);
  if (!record(state) || !(state.selectedRouteId === null || routeIds.includes(state.selectedRouteId))
    || !record(state.progress) || Object.keys(state.progress).length !== routeIds.length
    || !Object.keys(state.progress).every(id => routeIds.includes(id))
    || !routeIds.every(id => Number.isSafeInteger(state.progress[id]) && state.progress[id] >= 0
      && state.progress[id] <= EXPLORATION_DEMO.progressPerDiscovery)
    || !record(state.originStops) || !Object.entries(state.originStops).every(([id, stop]) => routeIds.includes(id)
      && Number.isSafeInteger(stop) && stop >= 0)
    || (state.selectedRouteId !== null && !Object.hasOwn(state.originStops, state.selectedRouteId))
    || !uniqueList(state.found, findingIds) || !uniqueList(state.seenFindings, state.found)
    || !(state.placedId === null || state.found.includes(state.placedId))) throw new Error('Invalid exploration');
  if (!EXPLORATION_ROUTES.every(route => (!state.progress[route.id] || Object.hasOwn(state.originStops, route.id))
    && (state.progress[route.id] === EXPLORATION_DEMO.progressPerDiscovery) === state.found.includes(route.findingId))) {
    throw new Error('Invalid exploration rewards');
  }
  if (!record(state.activityPeaks) || !Object.entries(state.activityPeaks).every(([dayKey, peaks]) => validDayKey(dayKey)
    && record(peaks) && Object.entries(peaks).every(([kind, amount]) => {
      const activity = EXPLORATION_ACTIVITIES.find(item => item.id === kind);
      return activity && Number.isSafeInteger(amount) && amount >= 0 && Number.isSafeInteger(normalizedAmount(activity, amount));
    }))) throw new Error('Invalid exploration activity');
  return state;
}

export function explorationActivityTotal(state, dayKey) {
  if (!validDayKey(dayKey)) return 0;
  const peaks = state.activityPeaks[dayKey] ?? {};
  // Conservative workshop rule: only the largest normalized stream counts.
  // Overlapping steps/workouts cannot double credit, but independent activities
  // also do not add together. Actual source reconciliation remains undecided.
  return Math.max(...EXPLORATION_ACTIVITIES.map(activity => normalizedAmount(activity, peaks[activity.id] ?? 0)));
}

export function observeExplorationActivity(state, sample) {
  const { dayKey, kind, amount } = sample ?? {};
  const activity = EXPLORATION_ACTIVITIES.find(item => item.id === kind);
  if (!activity || !validDayKey(dayKey) || !Number.isSafeInteger(amount) || amount < 0
    || !Number.isSafeInteger(normalizedAmount(activity, amount))) return state;
  const previousPeaks = state.activityPeaks[dayKey] ?? {};
  if (amount <= (previousPeaks[kind] ?? 0)) return state;

  // Every positive stream increase advances its peak, even before choosing a
  // route or after completing one. Unassigned activity and overflow are consumed.
  const next = { ...state, activityPeaks: { ...state.activityPeaks, [dayKey]: { ...previousPeaks, [kind]: amount } } };
  const delta = explorationActivityTotal(next, dayKey) - explorationActivityTotal(state, dayKey);
  const route = EXPLORATION_ROUTES.find(item => item.id === state.selectedRouteId);
  if (delta <= 0 || !route || state.found.includes(route.findingId)) return next;

  // Workshop limitation: a late day's new delta belongs to the route selected
  // when it arrives. Historical route attribution is not a decided product rule.
  const progress = Math.min(EXPLORATION_DEMO.progressPerDiscovery, state.progress[route.id] + delta);
  return {
    ...next,
    progress: { ...state.progress, [route.id]: progress },
    found: progress === EXPLORATION_DEMO.progressPerDiscovery
      ? [...state.found, route.findingId]
      : state.found,
  };
}

export function placeExplorationFinding(state, id) {
  if (id !== null && (!EXPLORATION_ROUTES.some(route => route.findingId === id) || !state.found.includes(id))) return state;
  return state.placedId === id ? state : { ...state, placedId: id };
}
