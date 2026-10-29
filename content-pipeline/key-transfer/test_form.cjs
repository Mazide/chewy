const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const template = fs.readFileSync(path.join(__dirname, 'form.html'), 'utf8');
const script = [...template.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
const ciphertext = 'CHEWYKEY1.ZW5jcnlwdGVk';
async function setup({encrypt = async () => ciphertext, unavailable = false} = {}) {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {value: '', textContent: '', hidden: true,
      disabled: true, dataset: {}, handlers: {}, addEventListener(name, fn) { this.handlers[name] = fn; },
      focus() {}, select() { this.selected = true; }, setSelectionRange() {}});
    return elements.get(id);
  };
  const root = element('root');
  root.querySelector = selector => element(selector);
  element('#chewy-transfer-config-v2').textContent = '{}';
  const sent = [];
  const window = {addEventListener() {}, openai: {async sendFollowUpMessage(value) { sent.push(value); }},
    ChewyKeyTransfer: {async createEncryptor() {
      if (unavailable) throw new Error('unavailable');
      return {mode: 'portable', encrypt};
    }}};
  vm.runInNewContext(script, {window, document: {getElementById() { return root; }}, navigator: {}});
  await new Promise(resolve => setImmediate(resolve));
  return {root, sent, get: name => element('#chewy-transfer-' + name + '-v2')};
}
test('unavailable encryption keeps secret entry disabled', async () => {
  const h = await setup({unavailable: true});
  assert.equal(h.get('secret').disabled, true);
  assert.equal(h.get('encrypt').disabled, true);
  assert.equal(h.get('error').hidden, false);
});
test('portable encryption clears plaintext and only ciphertext reaches explicit chat action', async () => {
  const secret = 'fake-only-never-a-real-api-key';
  const h = await setup({encrypt: async input => {assert.equal(input, secret); return ciphertext;}});
  assert.equal(h.root.dataset.cryptoMode, 'portable');
  h.get('secret').value = secret;
  await h.get('encrypt').handlers.click();
  assert.equal(h.get('secret').value, '');
  assert.equal(h.sent.length, 0);
  assert.equal(h.get('cipher').value, ciphertext);
  await h.get('send').handlers.click();
  assert.equal(h.sent.length, 1);
  assert.ok(h.sent[0].prompt.endsWith(ciphertext));
  assert.ok(!JSON.stringify(h.sent).includes(secret));
});
test('encryption error clears input, restores controls and never sends', async () => {
  const h = await setup({encrypt: async () => {throw new Error('failed');}});
  h.get('secret').value = 'fake-only-never-a-real-api-key';
  await h.get('encrypt').handlers.click();
  assert.equal(h.get('secret').value, '');
  assert.equal(h.get('secret').disabled, false);
  assert.equal(h.get('encrypt').disabled, false);
  assert.equal(h.get('copy').disabled, true);
  assert.equal(h.sent.length, 0);
});
test('clipboard restriction selects only encrypted output for manual copy', async () => {
  const h = await setup();
  h.get('secret').value = 'fake-only-never-a-real-api-key';
  await h.get('encrypt').handlers.click();
  await h.get('copy').handlers.click();
  assert.equal(h.get('cipher').selected, true);
  assert.equal(h.get('cipher').value, ciphertext);
  assert.match(h.get('status').textContent, /Шифр выделен/);
});
