import test from 'node:test';
import assert from 'node:assert/strict';
import { acquireSessionAccess } from './demo-session-access.js';

const flush = () => new Promise(resolve => setImmediate(resolve));

function fakeLocks() {
  const active = new Set();
  const queues = new Map();
  const pump = key => {
    const queue = queues.get(key);
    if (active.has(key) || !queue?.length) return;
    const request = queue.shift();
    request.signal.removeEventListener('abort', request.abort);
    active.add(key);
    Promise.resolve().then(() => request.callback({ name: key, mode: 'exclusive' }))
      .then(request.resolve, request.reject).finally(() => { active.delete(key); pump(key); });
  };
  return {
    request(key, { mode, signal }, callback) {
      assert.equal(mode, 'exclusive');
      return new Promise((resolve, reject) => {
        const queue = queues.get(key) ?? [];
        queues.set(key, queue);
        const request = { signal, callback, resolve, reject };
        request.abort = () => {
          const index = queue.indexOf(request);
          if (index >= 0) queue.splice(index, 1);
          reject(new DOMException('Cancelled', 'AbortError'));
        };
        if (signal.aborted) { request.abort(); return; }
        signal.addEventListener('abort', request.abort, { once: true });
        queue.push(request);
        queueMicrotask(() => pump(key));
      });
    },
  };
}

function client(locks, key, name, events, errors = []) {
  return acquireSessionAccess({ locks, key,
    onAcquired: () => events.push(`${name}:acquired`),
    onReleased: () => events.push(`${name}:released`),
    onError: error => errors.push(error),
  });
}

test('one session writer holds ownership until synchronous cleanup revokes it', async () => {
  const locks = fakeLocks();
  const events = [];
  const errors = [];
  const first = client(locks, 'main', 'first', events, errors);
  const second = client(locks, 'main', 'second', events, errors);
  await flush();
  assert.deepEqual(events, ['first:acquired']);
  first();
  assert.deepEqual(events, ['first:acquired', 'first:released']);
  await flush();
  assert.deepEqual(events, ['first:acquired', 'first:released', 'second:acquired']);
  first();
  second();
  second();
  await flush();
  assert.deepEqual(events, ['first:acquired', 'first:released', 'second:acquired', 'second:released']);
  assert.deepEqual(errors, []);
});

test('different storage keys can own independent sessions', async () => {
  const locks = fakeLocks();
  const events = [];
  const first = client(locks, 'main', 'first', events);
  const second = client(locks, 'workbench', 'second', events);
  await flush();
  assert.deepEqual(events, ['first:acquired', 'second:acquired']);
  first(); second();
  await flush();
});

test('cancelled queued requests never acquire and do not report intentional aborts', async () => {
  const locks = fakeLocks();
  const events = [];
  const errors = [];
  const owner = client(locks, 'main', 'owner', events, errors);
  await flush();
  const cancelled = client(locks, 'main', 'cancelled', events, errors);
  const next = client(locks, 'main', 'next', events, errors);
  cancelled();
  owner();
  await flush();
  assert.deepEqual(events, ['owner:acquired', 'owner:released', 'next:acquired']);
  assert.deepEqual(errors, []);
  next();
  await flush();
});

test('effect setup-cleanup-setup only grants the surviving subscription', async () => {
  const locks = fakeLocks();
  const events = [];
  const errors = [];
  const abandoned = client(locks, 'main', 'abandoned', events, errors);
  abandoned();
  const current = client(locks, 'main', 'current', events, errors);
  await flush();
  assert.deepEqual(events, ['current:acquired']);
  current();
  await flush();
  assert.deepEqual(errors, []);
});

test('a grant delivered after cleanup cannot activate the disposed store', async () => {
  const events = [];
  const errors = [];
  let grant;
  const locks = { request: (_key, _options, callback) => new Promise(resolve => {
    grant = () => resolve(callback({ name: 'main', mode: 'exclusive' }));
  }) };
  const cleanup = client(locks, 'main', 'late', events, errors);
  cleanup();
  grant();
  await flush();
  assert.deepEqual(events, []);
  assert.deepEqual(errors, []);
});

test('a late failure from a disposed request cannot affect its replacement connection', async () => {
  const events = [];
  const errors = [];
  const requests = [];
  const locks = { request: (_key, _options, callback) => new Promise((resolve, reject) => {
    requests.push({ callback, resolve, reject });
  }) };
  const old = client(locks, 'main', 'old', events, errors);
  old();
  const current = client(locks, 'main', 'current', events, errors);
  requests[1].resolve(requests[1].callback({ name: 'main', mode: 'exclusive' }));
  await flush();
  requests[0].reject(new Error('Late request failure'));
  await flush();
  assert.deepEqual(events, ['current:acquired']);
  assert.deepEqual(errors, []);
  current();
  await flush();
  assert.deepEqual(events, ['current:acquired', 'current:released']);
});

test('missing, throwing and rejecting lock managers report failure without acquiring', async () => {
  for (const locks of [undefined, {},
    { request: () => { throw new Error('Request failed'); } },
    { request: () => Promise.reject(new Error('Request failed')) },
    { request: () => Promise.reject(new DOMException('Unexpected abort', 'AbortError')) },
  ]) {
    const events = [];
    const errors = [];
    const cleanup = client(locks, 'main', 'failed', events, errors);
    await flush();
    assert.equal(errors.length, 1);
    assert.deepEqual(events, []);
    cleanup();
  }
});

test('acquisition callback failure revokes partial ownership and releases the next writer', async () => {
  const locks = fakeLocks();
  const events = [];
  const errors = [];
  const failure = new Error('Reload failed');
  const failed = acquireSessionAccess({ locks, key: 'main',
    onAcquired: () => { events.push('failed:acquired'); throw failure; },
    onReleased: () => events.push('failed:released'),
    onError: error => errors.push(error),
  });
  const next = client(locks, 'main', 'next', events, errors);
  await flush();
  assert.deepEqual(events, ['failed:acquired', 'failed:released', 'next:acquired']);
  assert.deepEqual(errors, [failure]);
  failed();
  next();
  await flush();
  assert.deepEqual(events, ['failed:acquired', 'failed:released', 'next:acquired', 'next:released']);
});
