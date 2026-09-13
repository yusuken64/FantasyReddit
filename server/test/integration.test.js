const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture, fakeReddit, settings } = require('./fixture');
const { createMarket } = require('../market');
const { createTrading } = require('../trading');
const { createWorker } = require('../worker');
const { createApp } = require('../app');
const { randomUUID, hash, token, MAX } = require('../domain');
test('disposable SQL Server integrity and lifecycle', { timeout: 360000 }, async t => {
  const f = await fixture(); t.after(() => f.close());
  const { db } = f, reddit = fakeReddit(), market = createMarket(db, reddit), trading = createTrading(db, market);
  const buy = async (session, overrides = {}) => trading.quote(session, { generation: 0, symbol: 'abc123', action: 'BUY', quantity: 1, ...overrides });
  const balance = async session => BigInt((await db.query('SELECT credits FROM accounts WHERE id=@id', { id: session.user_id }))[0].credits);
  await t.test('migrations are repeatable and constraints reject negative balances', async () => {
    await require('../migrate').migrate(db); assert.equal(await db.ready(), true);
    const user = await f.user(); await assert.rejects(db.query('UPDATE accounts SET credits=-1 WHERE id=@id', { id: user.user_id })); assert.equal(await balance(user), 10000n);
  });
  await t.test('invalid orders do not alter balances; economics cannot be client supplied', async () => {
    const user = await f.user();
    for (const quantity of [-1,0,1.2,'2',{},1000001,9007199254740992]) await assert.rejects(buy(user, { quantity }));
    await assert.rejects(buy(user, { price: -100 })); await assert.rejects(buy(user, { action: 'OPTION', strike: 99999999 }));
    assert.equal(await balance(user), 10000n);
  });
  await t.test('concurrent buys cannot overspend and replays return identical results', async () => {
    const user = await f.user(100n), orders = await Promise.all(Array.from({ length: 5 }, () => buy(user, { quantity: 5 })));
    const results = await Promise.allSettled(orders.map(o => trading.execute(user, randomUUID(), { quoteId: o.id })));
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 2); assert.equal(await balance(user), 0n);
    const another = await f.user(), order = await buy(another), key = randomUUID();
    const replays = await Promise.all(Array.from({ length: 6 }, () => trading.execute(another, key, { quoteId: order.id })));
    for (const result of replays) assert.deepEqual(result, replays[0]);
    assert.equal(await balance(another), 9990n);
    await assert.rejects(trading.execute(another, key, { quoteId: randomUUID() }), { code: 'IDEMPOTENCY_CONFLICT' });
  });
  await t.test('concurrent sells and sell-and-remove cannot oversell or delete new shares', async () => {
    const user = await f.user(), order = await buy(user, { quantity: 10 }); await trading.execute(user, randomUUID(), { quoteId: order.id });
    const sells = await Promise.all([buy(user, { action: 'SELL', quantity: 10 }), buy(user, { action: 'SELL_REMOVE', quantity: 10 })]);
    const results = await Promise.allSettled(sells.map(o => trading.execute(user, randomUUID(), { quoteId: o.id })));
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal(await balance(user), 10000n);
  });
  await t.test('quote expiry, cross-user orders and safe-range overflows roll back', async () => {
    const user = await f.user(), other = await f.user(), order = await buy(user);
    await assert.rejects(trading.execute(other, randomUUID(), { quoteId: order.id }));
    await db.query('UPDATE quotes SET expires_at=DATEADD(second,-1,SYSUTCDATETIME()) WHERE id=@id', { id: order.id });
    await assert.rejects(trading.execute(user, randomUUID(), { quoteId: order.id }), { code: 'QUOTE_EXPIRED' });
    const valid = await buy(user); await trading.execute(user, randomUUID(), { quoteId: valid.id });
    await db.query('UPDATE accounts SET credits=@max WHERE id=@id', { id: user.user_id, max: MAX });
    const sell = await buy(user, { action: 'SELL' }); await assert.rejects(trading.execute(user, randomUUID(), { quoteId: sell.id }), { code: 'OVERFLOW' });
    assert.equal(await balance(user), MAX);
  });
  await t.test('20-symbol limit is checked under account lock', async () => {
    const user = await f.user();
    for (let i = 0; i < 19; i++) { const quote = await buy(user, { symbol: `sym${i}` }); await trading.execute(user, randomUUID(), { quoteId: quote.id }); }
    const quotes = await Promise.all(['sym19', 'sym20'].map(symbol => buy(user, { symbol })));
    const results = await Promise.allSettled(quotes.map(quote => trading.execute(user, randomUUID(), { quoteId: quote.id })));
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  });
  await t.test('option ownership, 100-share cost and exactly-once concurrent exercise', async () => {
    const user = await f.user(), other = await f.user();
    const quote = await buy(user, { action: 'OPTION', optionType: 'PUT', step: 110, days: 30, quantity: 2 });
    assert.equal(quote.cost, quote.premium * 100 * 2);
    const order = await trading.execute(user, randomUUID(), { quoteId: quote.id });
    await assert.rejects(trading.exercise(other, randomUUID(), order.optionId, { generation: 0 }));
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => trading.exercise(user, randomUUID(), order.optionId, { generation: 0 })));
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal((await db.query('SELECT * FROM settlements WHERE option_id=@id', { id: order.optionId })).length, 1);
    assert.equal(await balance(user), 10000n - BigInt(quote.cost) + 200n);
  });
  await t.test('outages retain options; crash settles PUTs at zero and CALLs worthless', async () => {
    const user = await f.user(), ids = [], quotes = [];
    for (const optionType of ['CALL','PUT']) {
      const quote = await buy(user, { symbol: 'crash', action: 'OPTION', optionType, step: 100, days: 30, quantity: 2 }); quotes.push(quote);
      ids.push((await trading.execute(user, randomUUID(), { quoteId: quote.id })).optionId);
    }
    await db.query('UPDATE observations SET observed_at=DATEADD(minute,-10,SYSUTCDATETIME()) WHERE symbol=@symbol', { symbol: 'crash' });
    const fetchPosts = reddit.posts; reddit.posts = async () => { throw new Error('temporary failure'); };
    await assert.rejects(trading.exercise(user, randomUUID(), ids[0], { generation: 0 }));
    assert.equal((await db.query("SELECT * FROM options WHERE user_id=@user AND status='OPEN'", { user: user.user_id })).length, 2); reddit.posts = fetchPosts;
    const outstanding = await buy(user, { symbol: 'crash' });
    await market.persist({ id: 'crash', selftext: '[removed]', score: 1, created_utc: Date.now()/1000 - 3600 });
    await assert.rejects(trading.execute(user, randomUUID(), { quoteId: outstanding.id }), { code: 'DELISTED' });
    await Promise.all(ids.flatMap(id => Array.from({ length: 4 }, () => trading.settleDue(id, user.user_id))));
    const settlements = await db.query('SELECT * FROM settlements WHERE user_id=@user', { user: user.user_id });
    assert.deepEqual(settlements.map(s => Number(s.payout)).sort((a,b) => a-b), [0, 2000]);
    assert.equal(await balance(user), 10000n - BigInt(quotes.reduce((s,q) => s+q.cost,0)) + 2000n);
  });
  await t.test('expiry uses first eligible observation and cannot be exercised after expiration', async () => {
    const user = await f.user(), quote = await buy(user, { symbol: 'expiry', action: 'OPTION', optionType: 'PUT', step: 100, days: 30 });
    const order = await trading.execute(user, randomUUID(), { quoteId: quote.id });
    await db.query('UPDATE options SET expires_at=DATEADD(second,-1,SYSUTCDATETIME()) WHERE id=@id', { id: order.optionId });
    await db.query('UPDATE observations SET observed_at=DATEADD(minute,-10,SYSUTCDATETIME()) WHERE symbol=@symbol', { symbol: 'expiry' });
    await trading.settleDue(order.optionId, user.user_id);
    assert.equal((await db.query('SELECT status FROM options WHERE id=@id', { id: order.optionId }))[0].status, 'OPEN');
    await assert.rejects(trading.exercise(user, randomUUID(), order.optionId, { generation: 0 }));
    const first = await market.persist({ id: 'expiry', score: 1, created_utc: Date.now()/1000-3600 });
    await market.persist({ id: 'expiry', selftext: '[removed]' });
    await trading.settleDue(order.optionId, user.user_id);
    assert.equal((await db.query('SELECT observation_id FROM settlements WHERE option_id=@id', { id: order.optionId }))[0].observation_id.toLowerCase(), first.id.toLowerCase());
  });
  await t.test('reset clears all game state, invalidates other sessions and pre-reset requests', async () => {
    const user = await f.user(), order = await buy(user); await trading.execute(user, randomUUID(), { quoteId: order.id });
    const optionQuote = await buy(user, { action: 'OPTION', optionType: 'CALL', step: 100, days: 1 }); await trading.execute(user, randomUUID(), { quoteId: optionQuote.id });
    const outstanding = await buy(user), otherSession = hash(token());
    await db.query('INSERT INTO sessions(token_hash,user_id,csrf_token) VALUES(@hash,@user,@csrf)', { hash: otherSession, user: user.user_id, csrf: token() });
    const worker = createWorker(db, market, trading); await worker.tick();
    const key = randomUUID(), results = await Promise.all(Array.from({ length: 3 }, () => trading.reset(user, key, { generation: 0 })));
    assert.deepEqual(results[0], results[1]); assert.equal(await balance(user), 10000n);
    for (const table of ['holdings','options','settlements','ledger','snapshots','quotes']) assert.equal((await db.query(`SELECT * FROM ${table} WHERE user_id=@user`, { user: user.user_id })).length, 0, table);
    assert.equal((await db.query('SELECT * FROM sessions WHERE user_id=@user', { user: user.user_id })).length, 1);
    await assert.rejects(trading.execute(user, randomUUID(), { quoteId: outstanding.id })); await assert.rejects(buy(user), { code: 'ACCOUNT_CHANGED' });
    await trading.deleteAccount(user, { generation: 1 }); assert.equal((await db.query('SELECT * FROM sessions WHERE user_id=@user', { user: user.user_id })).length, 0);
    await worker.stop();
  });
  await t.test('SQL-backed OAuth consumes state once; CSRF, idle expiry, renewal and logout', async () => {
    const worker = createWorker(db, market, trading), server = createApp({ db, config: settings, reddit, market, trading, worker }).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    try {
      const base = `http://127.0.0.1:${server.address().port}`, get = (path, init = {}) => fetch(`${base}/api${path}`, { redirect: 'manual', ...init });
      assert.equal((await get('/auth/reddit/callback?code=test')).status, 400);
      const flow = await get('/auth/reddit'), location = new URL(flow.headers.get('location')), state = location.searchParams.get('state'), cookie = flow.headers.get('set-cookie').split(';')[0];
      assert.equal((await get(`/auth/reddit/callback?code=test&state=${state}`, { headers: { Cookie: 'oauth=wrong' } })).status, 400);
      const callback = await get(`/auth/reddit/callback?code=test&state=${state}`, { headers: { Cookie: cookie } }); assert.equal(callback.status, 302);
      assert.equal((await get(`/auth/reddit/callback?code=test&state=${state}`, { headers: { Cookie: cookie } })).status, 400);
      const sessionCookie = callback.headers.getSetCookie().find(c => c.startsWith('session=')).split(';')[0];
      const me = await get('/me', { headers: { Cookie: sessionCookie } }), user = await me.json(); assert.equal(me.status, 200); assert.match(me.headers.get('set-cookie'), /SameSite=Lax/);
      assert.equal((await get('/account/reset', { method: 'POST', headers: { Cookie: sessionCookie, 'Content-Type': 'application/json' }, body: '{"generation":0}' })).status, 403);
      assert.equal((await get('/auth/logout', { method: 'POST', headers: { Cookie: sessionCookie, Origin: settings.origin, 'X-CSRF-Token': user.csrfToken } })).status, 200);
      assert.equal((await get('/me', { headers: { Cookie: sessionCookie } })).status, 401);
      const idle = await f.user(); await db.query('UPDATE sessions SET last_seen=DATEADD(hour,-2,SYSUTCDATETIME()) WHERE token_hash=@hash', { hash: idle.token_hash });
      assert.equal((await get('/me', { headers: { Cookie: `session=${idle.raw}` } })).status, 401);
      const expiredFlow = await get('/auth/reddit'), expiredState = new URL(expiredFlow.headers.get('location')).searchParams.get('state');
      await db.query('UPDATE oauth_flows SET expires_at=DATEADD(minute,-1,SYSUTCDATETIME()) WHERE state_hash=@hash', { hash: hash(expiredState) });
      assert.equal((await get(`/auth/reddit/callback?code=test&state=${expiredState}`, { headers: { Cookie: expiredFlow.headers.get('set-cookie').split(';')[0] } })).status, 400);
    } finally { await new Promise(resolve => server.close(resolve)); }
  });
  await t.test('reset, delete, execute and expiry racing preserve account invariants', async () => {
    for (let i=0; i<3; i++) {
      const user = await f.user(), stock = await buy(user), optionQuote = await buy(user, { action: 'OPTION', optionType: 'PUT', step: 110, days: 1 });
      const option = await trading.execute(user, randomUUID(), { quoteId: optionQuote.id });
      await db.query('UPDATE options SET expires_at=DATEADD(minute,-1,SYSUTCDATETIME()) WHERE id=@id', { id: option.optionId });
      await Promise.allSettled([trading.reset(user, randomUUID(), { generation: 0 }), trading.execute(user, randomUUID(), { quoteId: stock.id }), trading.settleDue(option.optionId,user.user_id)]);
      assert.equal(await balance(user), 10000n);
      assert.equal((await db.query('SELECT * FROM holdings WHERE user_id=@user', { user: user.user_id })).length, 0);
      const next = await buy(user, { generation: 1 });
      await Promise.allSettled([trading.deleteAccount(user, { generation: 1 }), trading.execute(user, randomUUID(), { quoteId: next.id })]);
      assert.equal((await db.query('SELECT * FROM accounts WHERE id=@id', { id: user.user_id })).length, 0);
    }
  });
  await t.test('failure after debit rolls back balance, position, ledger and idempotency', async () => {
    const user = await f.user(), order = await buy(user);
    const failing = createTrading({ ...db, transaction: work => db.transaction(q => work(async (sql, params) => {
      if (sql.includes('INSERT INTO ledger')) throw new Error('Injected write failure'); return q(sql, params);
    })) }, market);
    await assert.rejects(failing.execute(user, randomUUID(), { quoteId: order.id }));
    assert.equal(await balance(user), 10000n);
    for (const table of ['holdings','ledger','idempotency']) assert.equal((await db.query(`SELECT * FROM ${table} WHERE user_id=@user`, { user: user.user_id })).length, 0);
    await trading.execute(user, randomUUID(), { quoteId: order.id }); assert.equal(await balance(user), 9990n);
  });
  await t.test('confirmed zero-value holding removal never calls Reddit', async () => {
    const user = await f.user(), quote = await buy(user, { symbol: 'zero', quantity: 2 });
    await trading.execute(user, randomUUID(), { quoteId: quote.id });
    await market.persist({ id: 'zero', deleted: true });
    const unavailableMarket = { current: async () => { throw new Error('No network permitted'); } };
    const safe = createTrading(db, unavailableMarket);
    const key = randomUUID(); await safe.remove(user,key,'zero',{generation:0}); await safe.remove(user,key,'zero',{generation:0});
    assert.equal(await balance(user), 9980n); assert.equal((await db.query('SELECT * FROM holdings WHERE user_id=@user',{user:user.user_id})).length,0);
  });
  await t.test('a failed settlement preserves its pinned observation across price changes', async () => {
    const user = await f.user(), quote = await buy(user, { symbol:'pinned',action:'OPTION',optionType:'PUT',step:110,days:1 });
    const order = await trading.execute(user,randomUUID(),{quoteId:quote.id});
    await db.query('UPDATE accounts SET credits=@max WHERE id=@user; UPDATE options SET expires_at=DATEADD(day,-1,SYSUTCDATETIME()) WHERE id=@id',{max:MAX,user:user.user_id,id:order.optionId});
    await assert.rejects(trading.settleDue(order.optionId,user.user_id),{code:'OVERFLOW'});
    const pinned = (await db.query('SELECT observation_id FROM options WHERE id=@id',{id:order.optionId}))[0].observation_id;
    await market.persist({id:'pinned',deleted:true});
    await db.query('UPDATE accounts SET credits=1000 WHERE id=@user',{user:user.user_id});
    await trading.settleDue(order.optionId,user.user_id);
    const result = (await db.query('SELECT * FROM settlements WHERE option_id=@id',{id:order.optionId}))[0];
    assert.equal(result.observation_id,pinned); assert.equal(Number(result.payout),100);
  });
  await t.test('two workers and restart snapshot more than 5,000 users without duplicates or oversized SQL batches', async () => {
    for (let offset=0; offset<5001; offset+=500) {
      const params = {}, values = [];
      for (let i=offset; i<Math.min(offset+500,5001); i++) { params[`id${i}`]=randomUUID(); params[`reddit${i}`]=`scale${i}`; values.push(`(@id${i},@reddit${i},'Scale test')`); }
      await db.query(`INSERT INTO accounts(id,reddit_id,username) VALUES ${values.join(',')}`, params);
    }
    const one = createWorker(db,market,trading), two = createWorker(db,market,trading);
    await Promise.all([one.tick(),two.tick()]); await one.stop(); await two.stop();
    const restarted = createWorker(db,market,trading); await restarted.tick(); await restarted.stop();
    assert.ok((await db.query('SELECT COUNT(DISTINCT user_id) AS n FROM snapshots'))[0].n >= 5001);
    assert.equal((await db.query('SELECT user_id,bucket FROM snapshots GROUP BY user_id,bucket HAVING COUNT(*)>1')).length, 0);
  });
});
