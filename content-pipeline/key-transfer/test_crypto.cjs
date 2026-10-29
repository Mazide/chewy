'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {createEncryptor} = require('./crypto.js');
const context = {Uint8Array, ArrayBuffer, DataView, TextEncoder, setTimeout, clearTimeout};
context.Math = Object.create(Math);
context.Math.random = () => { throw new Error('Math.random must never supply encryption entropy'); };
context.window = context;
context.self = context;
context.crypto = crypto.webcrypto;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'vendor/forge-1.4.2.min.js'), 'utf8'), context);
const forge = context.forge;
// No Forge PRNG is permitted in this application, even for OAEP padding.
forge.random.getBytes = forge.random.getBytesSync = () => { throw new Error('Unexpected Forge PRNG'); };
const keys = crypto.generateKeyPairSync('rsa', {modulusLength: 3072, publicExponent: 65537});
const manifest = {id: '0123456789abcdef0123456789abcdef', publicKeySpki:
  keys.publicKey.export({type: 'spki', format: 'der'}).toString('base64')};
const fakeSecret = 'qa-fake-runway-key-NOT-A-REAL-SECRET';

function envelope(value) {
  assert.ok(value.startsWith('CHEWYKEY1.'));
  return JSON.parse(Buffer.from(value.slice(10), 'base64url').toString());
}

function decrypt(value, id) {
  const data = envelope(value);
  const key = crypto.privateDecrypt({key: keys.privateKey,
    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256'},
  Buffer.from(data.ek, 'base64url'));
  const ciphertext = Buffer.from(data.ct, 'base64url');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(data.iv, 'base64url'));
  decipher.setAAD(Buffer.from('chewy-runway-transfer-v1:' + (id || data.id)));
  decipher.setAuthTag(ciphertext.subarray(-16));
  return Buffer.concat([decipher.update(ciphertext.subarray(0, -16)), decipher.final()]).toString();
}

for (const mode of ['native', 'portable']) {
  test(mode + ': interoperable RSA-OAEP SHA256 + AES256GCM with unique ciphertext', async () => {
    const encryptor = await createEncryptor(manifest, {crypto: crypto.webcrypto, forge,
      forcePortable: mode === 'portable'});
    assert.equal(encryptor.mode, mode);
    const first = await encryptor.encrypt(fakeSecret);
    const second = await encryptor.encrypt(fakeSecret);
    assert.equal(decrypt(first), fakeSecret);
    assert.equal(decrypt(second), fakeSecret);
    assert.notEqual(first, second);
    assert.throws(() => decrypt(first, '11111111111111111111111111111111'));
    const changed = envelope(first);
    const damaged = Buffer.from(changed.ct, 'base64url'); damaged[0] ^= 1;
    changed.ct = damaged.toString('base64url');
    assert.throws(() => decrypt('CHEWYKEY1.' + Buffer.from(JSON.stringify(changed)).toString('base64url')));
    assert.equal(Buffer.from(changed.ek, 'base64url').length, 384);
    assert.equal(Buffer.from(changed.iv, 'base64url').length, 12);
  });
}

test('portable works with no subtle, draws only CSPRNG bytes, clears owned buffers', async () => {
  const draws = [];
  const source = {getRandomValues(bytes) { draws.push(bytes); return crypto.webcrypto.getRandomValues(bytes); }};
  const encryptor = await createEncryptor(manifest, {crypto: source, forge});
  assert.equal(encryptor.mode, 'portable');
  assert.equal(decrypt(await encryptor.encrypt(fakeSecret)), fakeSecret);
  assert.deepEqual(draws.map(bytes => bytes.length), [1, 32, 12, 32]);
  assert.ok(draws.every(bytes => bytes.every(value => value === 0)));
});

test('native import blocked by sandbox falls back to portable', async () => {
  const source = {getRandomValues: bytes => crypto.webcrypto.getRandomValues(bytes),
    subtle: {importKey: async () => { throw new Error('NotSupportedError'); }}};
  const encryptor = await createEncryptor(manifest, {crypto: source, forge});
  assert.equal(encryptor.mode, 'portable');
  assert.equal(decrypt(await encryptor.encrypt(fakeSecret)), fakeSecret);
});

test('missing or throwing CSPRNG fails before an encryptor is returned', async () => {
  for (const source of [null, {}, {getRandomValues() { throw new Error(fakeSecret); }}]) {
    await assert.rejects(createEncryptor(manifest, {crypto: source, forge}),
      error => error.message === 'Secure key transfer is unavailable.');
  }
});

test('entropy failure during encryption rejects safely and clears prior draws', async () => {
  const draws = [];
  const source = {getRandomValues(bytes) {
    draws.push(bytes);
    if (draws.length === 4) throw new Error(fakeSecret);
    return crypto.webcrypto.getRandomValues(bytes);
  }};
  const encryptor = await createEncryptor(manifest, {crypto: source, forge});
  await assert.rejects(encryptor.encrypt(fakeSecret),
    error => error.message === 'Secure key transfer is unavailable.');
  assert.ok(draws.every(bytes => bytes.every(value => value === 0)));
});

test('invalid manifests, wrong RSA size and invalid secrets fail safely', async () => {
  const smallKey = crypto.generateKeyPairSync('rsa', {modulusLength: 2048}).publicKey;
  const invalid = [null, {...manifest, id: '../escape'}, {...manifest, publicKeySpki: 'AAAA'},
    {...manifest, publicKeySpki: smallKey.export({type: 'spki', format: 'der'}).toString('base64')}];
  for (const value of invalid) {
    await assert.rejects(createEncryptor(value, {crypto: crypto.webcrypto, forge}));
    await assert.rejects(createEncryptor(value, {crypto: crypto.webcrypto, forge, forcePortable: true}));
  }
  const encryptor = await createEncryptor(manifest, {crypto: crypto.webcrypto, forge});
  for (const value of ['', 'short', 'with space', 'q'.repeat(2049), null]) {
    await assert.rejects(encryptor.encrypt(value),
      error => error.message === 'Secure key transfer is unavailable.');
  }
});
