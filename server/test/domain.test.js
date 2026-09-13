const { test } = require('node:test');
const assert = require('node:assert/strict');
const { quantity, amount, MAX, premium, payout, symbol } = require('../domain');
const { removed, createReddit, chunks } = require('../market');
const { config } = require('../config');
test('quantities, symbols and safe integer bounds reject malformed and overflowing values', () => {
  for (const value of [-10, 0, 1.5, '1', null, {}, NaN, Infinity, 1000001, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => quantity(value));
  for (const value of ['t3_abc', 'ABC', '../a', 'a;DROP', '', null]) assert.throws(() => symbol(value));
  assert.equal(quantity(1), 1n); assert.equal(amount(MAX), MAX); assert.throws(() => amount(MAX + 1n));
});
test('option premiums and intrinsic payouts use 100 shares for each contract', () => {
  for (const days of [1,3,7,30]) for (const step of [90,95,100,105,110]) {
    const contract = premium(100n, 50, 'CALL', step, days); assert.equal(contract.strike, BigInt(step)); assert.ok(contract.premium > 0n);
  }
  assert.equal(payout({ option_type: 'PUT', strike: 100, quantity: 2 }, 0), 20000n);
  assert.equal(payout({ option_type: 'CALL', strike: 100, quantity: 2 }, 0), 0n);
  assert.throws(() => payout({ option_type: 'PUT', strike: MAX, quantity: 1000000 }, 0));
});
test('only explicit deletion or removal crashes', () => {
  const now = Date.now(), post = { id: 'abc', score: 100, created_utc: now / 1000 - 3600 };
  assert.equal(removed({ ...post, author: '[deleted]' }), false); assert.equal(removed({ ...post, author: null }), false);
  assert.equal(removed({ ...post, removed_by_category: 'moderator' }), true);
  assert.equal(removed({ ...post, selftext: '[removed]' }), true);
});
test('Reddit timeouts, auth failures, throttling, malformed payloads never fabricate posts', async () => {
  for (const status of [401,429,500]) {
    const reddit = createReddit({ userAgent: 'test', clientId: 'test', clientSecret: 'test' }, async () => new Response('{}', { status, headers: { 'Retry-After': '60' } }));
    await assert.rejects(reddit.posts(['abc']), { code: 'MARKET_UNAVAILABLE' });
  }
  const reddit = createReddit({}, async () => { throw new Error('timeout with secret'); });
  await assert.rejects(reddit.posts(['abc']), error => !error.message.includes('secret'));
});
test('empty and malformed listings cannot turn readiness green', async () => {
  for (const payload of [{}, { data: { children: [] } }, { data: { children: [{ kind: 't3', data: { id: 'abc' } }] } }]) {
    const reddit = createReddit({}, async url => Response.json(url.includes('access_token') ? { access_token: 'test', expires_in: 3600 } : payload));
    for (let i=0;i<2;i++) { let ready = false; try { ready = await reddit.ready(); } catch { /* Unavailable is expected. */ } assert.equal(ready, false); }
  }
});
test('application token renewal is shared and Reddit batches never exceed 100 IDs', async () => {
  let exchanges = 0, batches = 0;
  const reddit = createReddit({}, async (url) => {
    if (url.includes('access_token')) { exchanges++; return Response.json({ access_token: 'test', expires_in: 3600 }); }
    batches++; assert.ok(url.split('t3_').length - 1 <= 100); return Response.json({ data: { children: [] } });
  });
  await Promise.all([reddit.posts(Array.from({ length: 501 }, (_, i) => i.toString(36))), reddit.posts(['abc'])]);
  assert.equal(exchanges, 1); assert.equal(batches, 7);
  assert.deepEqual(chunks(Array(5001), 500).map(c => c.length), [...Array(10).fill(500), 1]);
});
test('configuration rejects absent secrets and insecure production origins', () => {
  assert.throws(() => config({}));
  assert.throws(() => config({ DB_CONNECTION_STRING: 'x', PUBLIC_ORIGIN: 'http://site.test', REDDIT_CLIENT_ID: 'x', REDDIT_CLIENT_SECRET: 'x', REDDIT_USER_AGENT: 'x', NODE_ENV: 'production' }));
  const { createDatabase } = require('../database');
  assert.throws(() => createDatabase('Server=localhost;Database=master;User Id=test;Password=test'));
  assert.throws(() => createDatabase('Server=localhost;User Id=test;Password=test'));
});

test('configured Reddit callback is exact, same-origin, and served by a supported route', () => {
  const env = { DB_CONNECTION_STRING: 'x', PUBLIC_ORIGIN: 'http://localhost:8080', REDDIT_CLIENT_ID: 'x', REDDIT_CLIENT_SECRET: 'x', REDDIT_USER_AGENT: 'x', NODE_ENV: 'development' };
  assert.equal(config(env).redirectUri, 'http://localhost:8080/api/auth/reddit/callback');
  assert.equal(config({ ...env, REDDIT_REDIRECT_URI: 'http://localhost:8080/auth/reddit/callback' }).redirectUri, 'http://localhost:8080/auth/reddit/callback');
  for (const redirect of ['http://localhost:5173/auth/reddit/callback', 'https://other.test/auth/reddit/callback', 'http://localhost:8080/auth/reddit/callback?x=1', 'http://localhost:8080/unsupported']) {
    assert.throws(() => config({ ...env, REDDIT_REDIRECT_URI: redirect }), /REDDIT_REDIRECT_URI/);
  }
});
