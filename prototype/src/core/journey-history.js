import { captureDay, localDayKey } from './capture-session.js';
import { JOURNEY_STOPS } from './journey-world.js';

// Reading the road never awards a day, moves the hero or completes analysis.
// Days without an entry are absent; old entries can exist without a reward.
export function sessionJourneyHistory(session) {
  const creditedDays = new Set(session.creditedDays);
  const jobDay = job => job.dayKey ?? localDayKey(job.createdAt);
  const days = new Set([
    ...creditedDays,
    ...session.entries.map(entry => entry.dayKey),
    ...session.jobs.map(jobDay),
  ]);
  return [...days].sort().reverse().map(dayKey => ({
    dayKey,
    stopIndex: Math.min(JOURNEY_STOPS.length - 1, [...creditedDays].filter(day => day <= dayKey).length),
    credited: creditedDays.has(dayKey),
    meals: captureDay(session.jobs, dayKey).meals,
    jobs: session.jobs.filter(job => jobDay(job) === dayKey),
  }));
}

const dayFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
});

// The label describes a saved calendar date, independently of the viewing zone.
export function formatJourneyDay(dayKey) {
  return dayFormatter.format(new Date(`${dayKey}T00:00:00.000Z`));
}
