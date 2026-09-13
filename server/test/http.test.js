const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../app');
const { settings } = require('./fixture');

test('legacy configured OAuth callback reaches the same state validation, not the SPA', async t => {
  const db = { transaction: async work => work(async () => [{ hits: 1 }]) };
  const app = createApp({ db, config: { ...settings, redirectUri: `${settings.origin}/auth/reddit/callback` }, reddit: {}, worker: {} });
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/auth/reddit/callback`);
  assert.equal(response.status, 400);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).error.code, 'INVALID_STATE');
});
test('liveness is independent, readiness fails closed and personal APIs are not cacheable', async t => {
  const app = createApp({ db: { ready: async () => false }, config: settings, reddit: {}, worker: {} });
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${base}/api/health/live`)).status, 200);
  const ready = await fetch(`${base}/api/health/ready`); assert.equal(ready.status, 503);
  const me = await fetch(`${base}/api/me`); assert.equal(me.status, 401); assert.equal(me.headers.get('cache-control'), 'no-store'); assert.ok(me.headers.get('x-request-id'));
  assert.equal((await me.json()).error.code, 'UNAUTHORIZED');
  assert.equal((await fetch(`${base}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })).status, 400);
});
