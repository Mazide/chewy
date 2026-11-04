import { CAPTURE_STORAGE_KEY, applyCaptureReply, cancelCapture, completeDueCaptures, deleteCapture, localDayKey, validateCaptureJobs } from './capture-session.js';
import { awardPhotoEntry } from './demo-rewards.js';
import { DEMO_REWARDS, HERO_DEMO_TIMING } from './demo-config.js';
import { shouldWelcomeBack } from './hero-state.js';
import { applyGardenAppearance, buyGardenAppearance, ownsGardenAppearance } from './demo-inventory.js';
import { acquireSessionAccess } from './demo-session-access.js';
import { createExplorationStudy, EXPLORATION_ACTIVITIES, EXPLORATION_DEMO, EXPLORATION_ROUTES,
  observeExplorationActivity, selectExplorationRoute, validateExplorationStudy } from './exploration-study.js';

export const DEMO_STORAGE_KEY = 'chewy.demo-session.v1';
export const WORKBENCH_STORAGE_KEY = 'chewy.capture-workbench.v1';

export function createDemoSession() {
  return {
    version: 2,
    lastSeenAt: null,
    entries: [],
    jobs: [],
    rewardEvents: [],
    creditedDays: [],
    regularity: { multiplier: DEMO_REWARDS.baseMultiplier, lastCreditedDay: null },
    inventory: { coins: 0, owned: [], applied: {} },
    exploration: createExplorationStudy(),
  };
}

const isDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const unique = values => new Set(values).size === values.length;
const strings = values => Array.isArray(values) && values.every(value => typeof value === 'string') && unique(values);

function validateSessionData(session) {
  if (session.lastSeenAt != null && !Number.isFinite(session.lastSeenAt)) throw new Error('Invalid visit time');
  validateCaptureJobs(session.jobs);
  if (!Array.isArray(session.entries) || !session.entries.every(entry => entry && typeof entry.id === 'string'
    && Number.isFinite(entry.firstPhotoAt) && isDay(entry.dayKey)) || !unique(session.entries.map(entry => entry.id))) {
    throw new Error('Invalid entries');
  }
  const entries = new Map(session.entries.map(entry => [entry.id, entry]));
  if (!session.jobs.every(job => entries.has(job.id) && job.dayKey === entries.get(job.id).dayKey
    && job.createdAt === entries.get(job.id).firstPhotoAt)) throw new Error('Capture identity mismatch');
  if (!strings(session.creditedDays) || !session.creditedDays.every(isDay)
    || !Number.isFinite(session.regularity?.multiplier) || session.regularity.multiplier < 1
    || !(session.regularity.lastCreditedDay === null || session.creditedDays.includes(session.regularity.lastCreditedDay))) {
    throw new Error('Invalid regularity');
  }
  if (!Array.isArray(session.rewardEvents) || !session.rewardEvents.every(event => event && entries.has(event.entryId)
    && event.dayKey === entries.get(event.entryId).dayKey && Number.isFinite(event.coins) && event.coins >= 0)
    || !unique(session.rewardEvents.map(event => event.entryId))) throw new Error('Invalid reward events');
  const inventory = session.inventory;
  if (!inventory || !Number.isFinite(inventory.coins) || inventory.coins < 0 || !strings(inventory.owned)
    || !inventory.applied || typeof inventory.applied !== 'object' || Array.isArray(inventory.applied)
    || !Object.values(inventory.applied).every(id => id === null || inventory.owned.includes(id))) throw new Error('Invalid inventory');
  return session;
}

export function validateDemoSession(session) {
  if (!session || session.version !== 2) throw new Error('Unsupported demo session');
  validateSessionData(session);
  validateExplorationStudy(session.exploration);
  if (!session.exploration.found.every(id => session.inventory.owned.includes(id))) throw new Error('Missing exploration inventory');
  const headwear = session.inventory.applied.headwear;
  if (headwear !== undefined && headwear !== null && !EXPLORATION_ROUTES.some(route => route.findingId === headwear)) {
    throw new Error('Invalid headwear');
  }
  return session;
}

function normalizedDemoSession(session) {
  if (session?.version !== 1) return validateDemoSession(session);
  // The old schema must be valid before adding the new field. Old food, wallet,
  // history and appearances are retained; exploration never invents old rewards.
  validateSessionData(session);
  return validateDemoSession({ ...session, version: 2, exploration: createExplorationStudy() });
}

// Legacy tasks have no first-photo timestamp. Preserve their original creation date,
// without inventing past reward events or days of regularity.
export function sessionWithJobs(session, jobs) {
  const entries = new Map(session.entries.map(entry => [entry.id, entry]));
  const normalized = jobs.map(job => {
    if (!entries.has(job.id)) entries.set(job.id, { id: job.id, firstPhotoAt: job.createdAt, dayKey: job.dayKey ?? localDayKey(job.createdAt) });
    const entry = entries.get(job.id);
    return { ...job, createdAt: entry.firstPhotoAt, dayKey: entry.dayKey };
  });
  return { ...session, entries: [...entries.values()], jobs: normalized };
}

export const sessionJourneyStep = session => session.creditedDays.length;

// One synchronous transaction writes the entire session before publishing it to UI.
// Failed reads/writes never claim success or overwrite unreadable data implicitly.
export function createDemoSessionStore({ storage, storageKey = DEMO_STORAGE_KEY, migrateLegacy = false,
  initialSession = createDemoSession(), now = Date.now, lockManager } = {}) {
  let db;
  let blocked = false;
  let snapshot;
  let entered = false;
  let savedRaw;
  const managedAccess = !!storage && lockManager !== undefined;
  let writable = !managedAccess;
  const waitingMessage = 'Сессия открыта в другой вкладке. Изменения здесь станут доступны после её закрытия.';
  const readError = 'Не удалось открыть сохранённую сессию. Данные не перезаписаны. Можно повторить загрузку или явно сбросить демосессию.';
  const idleHero = () => ({ lastPhotoAt: null, returning: false });
  // Test time is a workbench preference, separate from earned progress.
  const clockKey = `${storageKey}.clock`;
  const migrationBackupKey = `${storageKey}.before-exploration-v1`;
  let initial;
  try { initial = normalizedDemoSession(initialSession); }
  catch { initial = createDemoSession(); }
  let clockOffset = 0;
  const currentTime = () => now() + clockOffset;
  const listeners = new Set();
  const load = initialize => {
    db = typeof storage === 'function' ? storage() : storage;
    const savedOffset = Number(db?.getItem(clockKey) ?? 0);
    if (Number.isFinite(savedOffset) && savedOffset >= 0) clockOffset = savedOffset;
    savedRaw = db?.getItem(storageKey) ?? null;
    const saved = savedRaw !== null ? JSON.parse(savedRaw) : null;
    let session = normalizedDemoSession(savedRaw !== null ? saved : initialSession);
    const migrating = saved?.version === 1;
    if (savedRaw === null && migrateLegacy && db) {
      const legacy = db.getItem(CAPTURE_STORAGE_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (parsed.version !== 1) throw new Error('Unsupported legacy session');
        validateCaptureJobs(parsed.jobs);
        session = validateDemoSession(sessionWithJobs(session, parsed.jobs));
      }
    }
    // Browser initialization and legacy migration must also own the write lock.
    if (db && migrating && !initialize) return initial;
    if (db && (savedRaw === null || migrating) && initialize) {
      const raw = JSON.stringify(session);
      if (migrating) {
        // Preserve the exact source before replacing it. A conflicting previous
        // backup blocks migration rather than overwriting either recoverable save.
        const backup = db.getItem(migrationBackupKey);
        if (backup !== null && backup !== savedRaw) throw new Error('Conflicting exploration backup');
        if (backup === null) db.setItem(migrationBackupKey, savedRaw);
        if (db.getItem(migrationBackupKey) !== savedRaw) throw new Error('Exploration backup unavailable');
      }
      db.setItem(storageKey, raw);
      savedRaw = raw;
    }
    return session;
  };
  try {
    snapshot = { session: load(writable), hero: idleHero(), dayKey: localDayKey(currentTime()), error: writable ? '' : waitingMessage };
  } catch {
    blocked = true;
    snapshot = { session: initial, hero: idleHero(), dayKey: localDayKey(currentTime()), error: readError };
  }
  const publish = next => { snapshot = next; listeners.forEach(listener => listener()); };
  const update = (change, force = false, transient = {}) => {
    if (!writable || (blocked && !force)) return false;
    try {
      const session = validateDemoSession(change(snapshot.session));
      // Retry access as well as writes after a storage-access failure.
      if (!db && storage) db = typeof storage === 'function' ? storage() : storage;
      // Also reject writes by stale stores outside the managed browser lifetime.
      // This check is defense in depth; the Web Lock serializes browser writers.
      if (db && savedRaw !== undefined && db.getItem(storageKey) !== savedRaw) {
        blocked = true;
        publish({ ...snapshot, error: 'Сохранение изменилось в другой вкладке. Перезагрузи эту страницу, чтобы продолжить с актуальными данными.' });
        return false;
      }
      if (db) {
        const raw = JSON.stringify(session);
        db.setItem(storageKey, raw);
        savedRaw = raw;
      }
      blocked = false;
      publish({ ...snapshot, ...transient, session, dayKey: localDayKey(currentTime()), error: '' });
      return true;
    } catch {
      publish({ ...snapshot, error: 'Не удалось сохранить изменение в этом браузере. Оно не применено; попробуй ещё раз.' });
      return false;
    }
  };
  const changeJobs = change => {
    if (blocked || !writable) return false;
    const jobs = change(snapshot.session.jobs);
    return jobs !== snapshot.session.jobs && update(session => ({ ...session, jobs }));
  };
  return {
    getSnapshot: () => snapshot,
    now: currentTime,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    connectAccess: (onReady = () => {}) => {
      if (!managedAccess) { onReady(); return () => {}; }
      return acquireSessionAccess({
        locks: lockManager, key: `chewy-session:${storageKey}`,
        onAcquired: () => {
          // A waiting tab must discard its stale snapshot before it can mutate.
          writable = true;
          entered = false;
          try {
            const session = load(true);
            blocked = false;
            publish({ session, hero: idleHero(), dayKey: localDayKey(currentTime()), error: '' });
          } catch {
            blocked = true;
            publish({ ...snapshot, error: readError });
          }
          onReady();
        },
        onReleased: () => {
          writable = false;
          entered = false;
          publish({ ...snapshot, error: waitingMessage });
        },
        onError: () => {
          writable = false;
          publish({ ...snapshot, error: 'Не удалось получить безопасный доступ к сохранению. Перезагрузи страницу или открой прототип в другом браузере.' });
        },
      });
    },
    update,
    enter: () => {
      if (entered || blocked || !writable) return false;
      const timestamp = currentTime();
      const returning = shouldWelcomeBack(snapshot.session.lastSeenAt, timestamp);
      if (!update(session => ({ ...session, lastSeenAt: timestamp }), false, { hero: { lastPhotoAt: null, returning } })) return false;
      entered = true;
      return true;
    },
    leave: () => {
      if (!entered || !writable) return false;
      if (!update(session => ({ ...session, lastSeenAt: currentTime() }))) return false;
      entered = false;
      return true;
    },
    reactToPhoto: () => {
      if (!blocked && writable) publish({ ...snapshot, hero: { lastPhotoAt: currentTime(), returning: false } });
    },
    completeAnalysis: () => changeJobs(jobs => completeDueCaptures(jobs, Infinity)),
    deliverCaptureReply: reply => changeJobs(jobs => applyCaptureReply(jobs, reply)),
    cancelCapture: id => changeJobs(jobs => cancelCapture(jobs, id)),
    deleteCapture: id => changeJobs(jobs => deleteCapture(jobs, id)),
    replaceJobs: jobs => update(session => sessionWithJobs(session, jobs)),
    setInventory: change => update(session => ({ ...session, inventory: typeof change === 'function' ? change(session.inventory) : change })),
    purchaseAppearance: id => {
      if (blocked || !writable) return false;
      const previous = snapshot.session.inventory;
      if (ownsGardenAppearance(previous, id)) return true;
      const inventory = buyGardenAppearance(previous, id);
      return inventory !== previous && update(session => ({ ...session, inventory }));
    },
    applyAppearance: id => {
      if (blocked || !writable || !ownsGardenAppearance(snapshot.session.inventory, id)) return false;
      const previous = snapshot.session.inventory;
      const inventory = applyGardenAppearance(previous, id);
      return inventory === previous || update(session => ({ ...session, inventory }));
    },
    selectExplorationRoute: id => {
      if (blocked || !writable || !EXPLORATION_ROUTES.some(route => route.id === id)) return false;
      const previous = snapshot.session.exploration;
      const exploration = selectExplorationRoute(previous, id, sessionJourneyStep(snapshot.session));
      return exploration === previous || update(session => ({ ...session, exploration }));
    },
    observeActivity: sample => {
      if (blocked || !writable) return false;
      const { kind, amount } = sample ?? {};
      const activity = EXPLORATION_ACTIVITIES.find(item => item.id === kind);
      if (!activity || !Number.isSafeInteger(amount) || amount < 0
        || !Number.isSafeInteger(amount * (EXPLORATION_DEMO.progressPerDiscovery / activity.samplePerDiscovery))) return false;
      const previous = snapshot.session.exploration;
      const exploration = observeExplorationActivity(previous, { dayKey: localDayKey(currentTime()), kind, amount });
      if (exploration === previous) return true;
      return update(session => ({ ...session, exploration, inventory: { ...session.inventory,
        owned: [...new Set([...session.inventory.owned, ...exploration.found])] } }));
    },
    applyHeadwear: id => {
      if (blocked || !writable || (id !== null && (!EXPLORATION_ROUTES.some(route => route.findingId === id)
        || !snapshot.session.inventory.owned.includes(id)))) return false;
      if ((snapshot.session.inventory.applied.headwear ?? null) === id) return true;
      return update(session => ({ ...session, inventory: { ...session.inventory,
        applied: { ...session.inventory.applied, headwear: id } } }));
    },
    markExplorationSeen: () => {
      if (blocked || !writable) return false;
      const previous = snapshot.session.exploration;
      if (previous.found.every(id => previous.seenFindings.includes(id))) return true;
      return update(session => ({ ...session, exploration: { ...session.exploration, seenFindings: [...session.exploration.found] } }));
    },
    startEntry: (id = crypto.randomUUID()) => {
      if (blocked || !writable) return false;
      const existing = snapshot.session.entries.find(entry => entry.id === id);
      if (existing) return existing;
      const firstPhotoAt = currentTime();
      const entry = { id, firstPhotoAt, dayKey: localDayKey(firstPhotoAt) };
      return update(session => awardPhotoEntry(session, entry, firstPhotoAt).session, false,
        { hero: { lastPhotoAt: firstPhotoAt, returning: false } }) ? entry : false;
    },
    advanceDays: days => {
      if (blocked || !writable || !Number.isInteger(days) || days <= 0) return false;
      const current = currentTime();
      const next = new Date(current);
      next.setDate(next.getDate() + days);
      const offset = clockOffset + next.getTime() - current;
      try {
        if (db) db.setItem(clockKey, String(offset));
        clockOffset = offset;
        publish({ ...snapshot, hero: { lastPhotoAt: null, returning: shouldWelcomeBack(current, currentTime()) && (entered || snapshot.session.lastSeenAt != null) }, dayKey: localDayKey(currentTime()), error: '' });
        return true;
      } catch {
        publish({ ...snapshot, error: 'Не удалось сохранить тестовое время. Дата не изменена.' });
        return false;
      }
    },
    tick: () => {
      if (blocked || !writable) return;
      const jobs = snapshot.session.jobs;
      const next = completeDueCaptures(jobs, currentTime());
      if (next.some((job, index) => job !== jobs[index])) update(session => ({ ...session, jobs: next }));
      // The viewing day follows the clock even when saving a due answer fails.
      // Keep the pending task and persistence error while refreshing this UI state.
      if (snapshot.dayKey !== localDayKey(currentTime())) publish({ ...snapshot, dayKey: localDayKey(currentTime()) });
      if (snapshot.hero.lastPhotoAt != null && currentTime() - snapshot.hero.lastPhotoAt >= HERO_DEMO_TIMING.happyMs) {
        publish({ ...snapshot, hero: { ...snapshot.hero, lastPhotoAt: null } });
      }
    },
    reset: () => update(() => createDemoSession(), true, { hero: idleHero() }),
  };
}
