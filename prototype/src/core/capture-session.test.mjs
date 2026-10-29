import test from 'node:test';
import assert from 'node:assert/strict';
import { CAPTURE_STORAGE_KEY, captureDay, capturePhotos, completeDueCaptures, createCapture, readCaptureSession, reviseCapture, writeCaptureSession } from './capture-session.js';
import { dailyCampContributions, mealAssessment, nutritionSupplies } from './food-assessment.js';

const storage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};
const capture = (now = Date.now()) => createCapture({ source: 'camera', theme: 'science', portion: 1, notes: 'Соус отдельно', delay: 20000 }, now);

test('a capture keeps its details through closing and completes once on return', () => {
  const db = storage();
  const job = capture(Date.now() - 30000);
  writeCaptureSession(db, [job]);
  const loaded = readCaptureSession(db);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].id, job.id);
  assert.equal(loaded[0].status, 'ready');
  assert.equal(loaded[0].result.notes, 'Соус отдельно');
  assert.strictEqual(completeDueCaptures(loaded)[0], loaded[0]);
});

test('unfinished capture remains pending after restart', () => {
  const db = storage();
  const job = capture();
  writeCaptureSession(db, [job]);
  assert.equal(readCaptureSession(db)[0].status, 'processing');
});

test('revision retains the prior meal, identity and date without a duplicate', () => {
  const db = storage();
  const now = Date.now();
  const original = completeDueCaptures([{ ...capture(now), imageKey: 'breakfast' }], now + 30000)[0];
  const revised = reviseCapture(original, { dishName: 'Чечевичный суп', notes: 'Без сливок', portion: 0 }, 20000, now);
  writeCaptureSession(db, [revised]);
  const loaded = readCaptureSession(db);
  assert.equal(loaded[0].result.name, original.result.name);
  assert.equal(captureDay(loaded).meals.length, 1);
  assert.equal(loaded[0].notes, 'Без сливок');
  const completed = completeDueCaptures(loaded, now + 30000);
  assert.equal(completed[0].id, original.id);
  assert.equal(completed[0].createdAt, original.createdAt);
  assert.equal(completed[0].result.name, 'Чечевичный суп');
  assert.equal(completed[0].result.portion, 0);
  assert.equal(captureDay(completed).meals[0].imageKey, 'breakfast');
  assert.equal(captureDay(completed).meals.length, 1);
});

test('late results keep the capture day and pending jobs survive day boundaries', () => {
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); yesterday.setHours(23, 50, 0, 0);
  const job = capture(yesterday.getTime());
  const done = completeDueCaptures([job], Infinity);
  assert.equal(captureDay(done).meals.length, 0);
  assert.equal(captureDay(done, yesterday).meals.length, 1);
});

test('multiple captures stay independent when one is revised', () => {
  const done = completeDueCaptures([capture(), capture()], Infinity);
  assert.notEqual(done[0].id, done[1].id);
  const changed = [reviseCapture(done[0], { dishName: 'Суп', notes: '', portion: 1 }, 20000), done[1]];
  assert.strictEqual(changed[1], done[1]);
  assert.equal(captureDay(changed).meals.length, 2);
});

test('broken storage fails explicitly instead of confirming a saved capture', () => {
  const db = storage();
  db.setItem(CAPTURE_STORAGE_KEY, '{broken');
  assert.throws(() => readCaptureSession(db));
  assert.equal(db.getItem(CAPTURE_STORAGE_KEY), '{broken');
  assert.throws(() => writeCaptureSession({ setItem() { throw new Error('quota'); } }, [capture()]));
});

const photos = [
  { id:'plate', imageKey:'meal', source:'camera' },
  { id:'detail', imageKey:'breakfast', source:'gallery' },
];

test('several photos survive closing as one meal, including their order', () => {
  const db = storage();
  const job = createCapture({ source:'camera', theme:'alchemy', portion:1, notes:'Соус отдельно', delay:20000, photos }, Date.now()-30000);
  writeCaptureSession(db,[job]);
  const [loaded] = readCaptureSession(db);
  assert.deepEqual(capturePhotos(loaded),photos);
  assert.deepEqual(loaded.result.photos,photos);
  assert.equal(captureDay([loaded]).meals.length,1);
  assert.equal(captureDay([loaded]).meals[0].imageKey,'meal');
});

test('photo revision keeps old meal and photos until replacement is complete', () => {
  const now=Date.now();
  const old=completeDueCaptures([createCapture({source:'camera',theme:'science',portion:1,notes:'',delay:20000,photos},now)],Infinity)[0];
  const replacement=[{id:'new-plate',imageKey:'chicken',source:'camera'}];
  const updated=reviseCapture(old,{dishName:'Ужин',notes:'Новый ракурс',portion:2,photos:replacement},20000,now);
  assert.equal(updated.id,old.id);
  assert.equal(updated.createdAt,old.createdAt);
  assert.deepEqual(captureDay([updated]).meals[0].photos,photos);
  const db=storage(); writeCaptureSession(db,[updated]);
  assert.equal(readCaptureSession(db)[0].result.photos[0].imageKey,'meal');
  const completed=completeDueCaptures([updated],Infinity);
  assert.equal(captureDay(completed).meals.length,1);
  assert.deepEqual(captureDay(completed).meals[0].photos,replacement);
  assert.equal(captureDay(completed).meals[0].imageKey,'chicken');
  assert.deepEqual(old.photos,photos);
});

test('legacy single-photo records remain editable, malformed photo lists fail', () => {
  const legacy=completeDueCaptures([{...capture(),imageKey:'breakfast'}],Infinity)[0];
  delete legacy.result.photos;
  assert.equal(capturePhotos(legacy,true)[0].imageKey,'breakfast');
  const revised=reviseCapture(legacy,{dishName:'Уточнение',notes:'',portion:1,photos},20000);
  assert.equal(captureDay([revised]).meals[0].imageKey,'breakfast');
  const db=storage();
  writeCaptureSession(db,[{...legacy,photos:[]}]);
  assert.throws(()=>readCaptureSession(db));
  assert.throws(()=>createCapture({source:'camera',theme:'science',portion:1,notes:'',delay:20000,photos:[photos[0],photos[0]]}));
});

test('completed gallery entries save distinct answers and contribute before their result is viewed', () => {
  const jobs = ['breakfast', 'chicken'].map(imageKey => createCapture({ source: 'gallery', theme: 'science', portion: 1, notes: '', delay: 0,
    photos: [{ id: imageKey, imageKey, source: 'gallery' }] }));
  const ready = completeDueCaptures(jobs);
  assert.ok(ready.every(job => !job.seen && job.result.assessment));
  assert.deepEqual(ready.map(job => job.result.name), ['Овсянка с ягодами', 'Курица с картофелем']);
  assert.deepEqual(dailyCampContributions(captureDay([ready[0]]).meals), { protein: false, carbs: true, fats: false, plants: true });
  assert.deepEqual(dailyCampContributions(captureDay([ready[1]]).meals), { protein: true, carbs: false, fats: false, plants: false });
  assert.deepEqual(dailyCampContributions(captureDay(ready).meals), { protein: true, carbs: true, fats: false, plants: true });
  assert.deepEqual(nutritionSupplies(captureDay(completeDueCaptures(ready, Infinity)).meals), nutritionSupplies(captureDay(ready).meals));
});

test('a saved answer and its supplies survive storage without being inferred again from the cover', () => {
  const db = storage();
  const [ready] = completeDueCaptures([capture()], Infinity);
  ready.result.assessment.reason = 'Сохранённый ответ демоанализа.';
  writeCaptureSession(db, [ready]);
  const [loaded] = readCaptureSession(db);
  assert.deepEqual(loaded.result.assessment, ready.result.assessment);
  const [meal] = captureDay([loaded]).meals;
  assert.strictEqual(meal.assessment, loaded.result.assessment);
  assert.equal(mealAssessment(meal).reason, 'Сохранённый ответ демоанализа.');
  assert.deepEqual(nutritionSupplies([meal]), nutritionSupplies(captureDay([ready]).meals));
});

test('extra views stay one meal with one contribution', () => {
  const now = Date.now();
  const make = photos => createCapture({ source: 'gallery', theme: 'science', portion: 1, notes: '', delay: 0, photos }, now);
  const photo = { id: 'cover', imageKey: 'breakfast', source: 'gallery' };
  const [single, multiple] = completeDueCaptures([make([photo]), make([photo, { ...photo, id: 'detail' }])], Infinity);
  assert.equal(captureDay([multiple]).meals.length, 1);
  assert.deepEqual(nutritionSupplies(captureDay([multiple]).meals), nutritionSupplies(captureDay([single]).meals));
});

test('a replacement answer changes only the original day after successful analysis', () => {
  const now = Date.now();
  const originalDate = new Date(now); originalDate.setDate(originalDate.getDate() - 1);
  const [old] = completeDueCaptures([createCapture({ source: 'gallery', theme: 'science', portion: 1, notes: '', delay: 0,
    photos: [{ id: 'old-photo', imageKey: 'chicken', source: 'gallery' }] }, originalDate.getTime())], Infinity);
  const before = dailyCampContributions(captureDay([old], originalDate).meals);
  const pending = reviseCapture(old, { dishName: 'Овсянка с ягодами', notes: '', portion: 1,
    photos: [{ id: 'new-photo', imageKey: 'breakfast', source: 'gallery' }] }, 1000, now);
  assert.deepEqual(dailyCampContributions(captureDay([pending], originalDate).meals), before);
  const [ready] = completeDueCaptures([pending], now + 1000);
  assert.equal(ready.id, old.id);
  assert.equal(ready.createdAt, old.createdAt);
  assert.equal(captureDay([ready], originalDate).meals.length, 1);
  assert.deepEqual(dailyCampContributions(captureDay([ready], originalDate).meals), { protein: false, carbs: true, fats: false, plants: true });
  assert.deepEqual(dailyCampContributions(captureDay([ready]).meals), { protein: false, carbs: false, fats: false, plants: false });
});

test('legacy answers have a conservative fallback and malformed saved assessments fail explicitly', () => {
  const db = storage();
  const [legacy] = completeDueCaptures([capture()], Infinity);
  delete legacy.result.assessment;
  writeCaptureSession(db, [legacy]);
  const loaded = readCaptureSession(db);
  assert.deepEqual(dailyCampContributions(captureDay(loaded).meals), { protein: true, carbs: true, fats: false, plants: true });
  legacy.result.name = 'Неизвестное блюдо';
  assert.equal(mealAssessment(captureDay([legacy]).meals[0]).tone, 'unknown');
  assert.deepEqual(dailyCampContributions(captureDay([legacy]).meals), { protein: false, carbs: false, fats: false, plants: false });
  writeCaptureSession(db, [{ ...legacy, result: { ...legacy.result, assessment: { supplies: { fats: [30, 'масло'] } } } }]);
  assert.throws(() => readCaptureSession(db), /Invalid capture session/);
});
