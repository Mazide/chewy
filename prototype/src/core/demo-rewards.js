import { localDayKey } from './capture-session.js';
import { DEMO_REWARDS } from './demo-config.js';

// Count calendar dates, not elapsed local hours: DST days can be 23 or 25 hours.
const dayOrdinal = dayKey => {
  const [year, month, day] = dayKey.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86400000;
};
const roundMultiplier = value => Math.round((value + Number.EPSILON) * 100) / 100;
const boundedMultiplier = value => roundMultiplier(Math.max(DEMO_REWARDS.baseMultiplier,
  Math.min(DEMO_REWARDS.maxMultiplier, value)));

export function effectiveMultiplier(session, now = Date.now()) {
  const { multiplier, lastCreditedDay } = session.regularity;
  if (!lastCreditedDay) return DEMO_REWARDS.baseMultiplier;
  const missingDays = Math.max(0, dayOrdinal(localDayKey(now)) - dayOrdinal(lastCreditedDay) - 1);
  const decayingDays = Math.max(0, missingDays - DEMO_REWARDS.graceDays);
  // Derive from the stored earning-day anchor. Merely reading never compounds decay.
  return boundedMultiplier(multiplier - decayingDays * DEMO_REWARDS.decayPerDay);
}

export function awardPhotoEntry(session, entry, now = entry.firstPhotoAt) {
  // Old entries have no reward event; never retroactively reward their retry/view.
  if (session.entries.some(saved => saved.id === entry.id)
    || session.rewardEvents.some(event => event.entryId === entry.id)) return { session, event: null };

  const newDay = !session.creditedDays.includes(entry.dayKey);
  const multiplierBefore = effectiveMultiplier(session, now);
  const multiplier = newDay
    ? boundedMultiplier(multiplierBefore + DEMO_REWARDS.multiplierStep)
    : multiplierBefore;
  const event = {
    entryId: entry.id,
    dayKey: entry.dayKey,
    coins: Math.round(DEMO_REWARDS.baseCoins * multiplier),
    multiplier,
    multiplierBefore,
    grew: multiplier > multiplierBefore,
  };
  return {
    session: {
      ...session,
      entries: [...session.entries, entry],
      rewardEvents: [...session.rewardEvents, event],
      creditedDays: newDay ? [...session.creditedDays, entry.dayKey] : session.creditedDays,
      regularity: newDay ? { ...session.regularity, multiplier, lastCreditedDay: entry.dayKey } : session.regularity,
      inventory: { ...session.inventory, coins: session.inventory.coins + event.coins },
    },
    event,
  };
}
