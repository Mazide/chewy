import { createCapture } from './capture-session.js';
import { createDemoSession, createDemoSessionStore } from './demo-session.js';

// Only for isolated path stories. Never used to seed the persistent prototype.
export function journeyExampleSession(state, now = Date.now()) {
  if (state === 'first') return createDemoSession();
  let time = now;
  const store = createDemoSessionStore({ now: () => time });
  const samples = ['breakfast', 'chicken', 'meal'];
  for (let index = 0; index < samples.length; index++) {
    const date = new Date(now);
    date.setDate(date.getDate() - (state === 'return' ? 9 : 2) + index);
    date.setHours(12, 0, 0, 0);
    time = date.getTime();
    const entry = store.startEntry();
    const job = createCapture({ source: 'gallery', theme: 'science', portion: 1,
      notes: index === 2 ? 'С оливковым маслом' : '', delay: 0,
      photos: [{ id: `example-photo-${index}`, imageKey: samples[index], source: 'gallery' }],
    }, time);
    store.replaceJobs([...store.getSnapshot().session.jobs, { ...job, id: entry.id }]);
    store.completeAnalysis();
  }
  store.purchaseAppearance('flowers');
  store.applyAppearance('flowers');
  store.update(session => ({ ...session, lastSeenAt: time, jobs: session.jobs.map(job => ({ ...job, seen: true })) }));
  return store.getSnapshot().session;
}
