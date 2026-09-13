const test = require('node:test');
const assert = require('node:assert/strict');

test('SQL migration, shared quotes, execution and settlement', { skip: process.env.MOMENTUM_SQL_TEST !== '1' }, async t => {
  // Fixed disposable test database; never use the application's connection string.
  process.env.DB_CONNECTION_STRING = 'Server=127.0.0.1,14439;Database=FantasyMomentumTest;User Id=sa;Password=MomentumTestOnly_2026!;Encrypt=false;TrustServerCertificate=true';
  const db = require('../database');
  await db.init();
  const { observePost, readQuote } = require('../module/priceCalculator');
  const { buy, sell } = require('../trades');
  const query = sql => db.pool.request().query(sql);
  const symbol = 't' + Date.now().toString(36);
  let userId;
  try {
    await t.test('migration is repeatable and preserves legacy history', async () => {
      await query("INSERT INTO stock_price_history(stock_symbol, score, price) VALUES ('legacy', 100, 25)");
      await db.pool.close();
      await db.init();
      const row = (await query("SELECT price, pricing_model FROM stock_price_history WHERE stock_symbol = 'legacy'")).recordset[0];
      assert.equal(Number(row.price), 25);
      assert.equal(row.pricing_model, 'legacy-age-v1');
    });
    await t.test('concurrent discovery creates one non-executable baseline', async () => {
      await Promise.all(Array.from({ length: 5 }, () => observePost({ id: symbol, score: 100 }, { registerOnly: true })));
      assert.equal((await readQuote(symbol)).status, 'collecting');
      await assert.rejects(readQuote(symbol, undefined, null), /expired/);
      assert.equal((await query(`SELECT COUNT(*) AS n FROM stock_price_history WHERE stock_symbol = '${symbol}'`)).recordset[0].n, 0);
    });
    await t.test('collector publishes once; reads and short intervals leave it unchanged', async () => {
      const time = new Date((await query('SELECT DATEADD(second, -301, SYSUTCDATETIME()) AS now')).recordset[0].now);
      await db.pool.request().input('samples', db.sql.NVarChar(db.sql.MAX), JSON.stringify([{ score: 100, time: time.getTime() }]))
        .query(`UPDATE momentum_quotes SET observations = @samples WHERE stock_symbol = '${symbol}'`);
      await Promise.all([observePost({ id: symbol, score: 150 }), observePost({ id: symbol, score: 150 })]);
      const quote = await readQuote(symbol);
      assert.equal(quote.status, 'ready');
      assert.equal(quote.price, 60);
      await observePost({ id: symbol, score: 9999 }, { registerOnly: true });
      assert.deepEqual(await readQuote(symbol), quote);
      assert.equal((await query(`SELECT COUNT(*) AS n FROM stock_price_history WHERE stock_symbol = '${symbol}' AND pricing_model = 'momentum-v1'`)).recordset[0].n, 1);
    });
    await t.test('trades execute shared quotes, reject stale IDs, and leave observations untouched', async () => {
      userId = (await query(`INSERT INTO users(username, reddit_id) OUTPUT INSERTED.id VALUES ('${symbol}', '${symbol}')`)).recordset[0].id;
      const quote = await readQuote(symbol);
      await assert.rejects(buy(userId, symbol, 2, 'old'), /expired/);
      assert.equal(await buy(userId, symbol, 1, quote.id), 60);
      assert.equal(await buy(userId, symbol, 1, quote.id), 60);
      assert.equal(await sell(userId, symbol, 1, quote.id), 60);
      assert.equal(Number((await query(`SELECT credits FROM users WHERE id = ${userId}`)).recordset[0].credits), 9940);
      assert.equal((await query(`SELECT COUNT(*) AS n FROM stock_price_history WHERE stock_symbol = '${symbol}'`)).recordset[0].n, 1);
      await query(`UPDATE momentum_quotes SET quote_at = DATEADD(minute, -11, SYSUTCDATETIME()) WHERE stock_symbol = '${symbol}'`);
      const stale = await readQuote(symbol);
      assert.equal(stale.status, 'stale');
      await assert.rejects(sell(userId, symbol, 1, stale.id), /expired/);
      assert.equal(Number((await query(`SELECT shares FROM holdings WHERE user_id = ${userId}`)).recordset[0].shares), 1);
    });
    await t.test('stale options remain pending; concurrent settlement pays once', async () => {
      const { exerciseOptions } = require('../module/optionSettlement');
      const id = (await query(`INSERT INTO options(user_id, stock_symbol, option_type, strike_price, premium_paid, quantity, expires_at)
        OUTPUT INSERTED.id VALUES (${userId}, '${symbol}', 'CALL', 20, 1, 1, DATEADD(day, 1, SYSUTCDATETIME()))`)).recordset[0].id;
      await assert.rejects(exerciseOptions([id]), /unavailable/);
      assert.equal((await query(`SELECT COUNT(*) AS n FROM options WHERE id = ${id}`)).recordset[0].n, 1);
      await query(`UPDATE momentum_quotes SET quote_at = SYSUTCDATETIME() WHERE stock_symbol = '${symbol}'`);
      await Promise.all([exerciseOptions([id]), exerciseOptions([id])]);
      assert.equal(Number((await query(`SELECT credits FROM users WHERE id = ${userId}`)).recordset[0].credits), 9980);
      assert.equal((await query(`SELECT COUNT(*) AS n FROM option_transactions WHERE user_id = ${userId}`)).recordset[0].n, 1);
    });
    await t.test('expiry uses the published price at expiry rather than a later price', async () => {
      const { processExpiredOptions } = require('../module/optionSettlement');
      const expiry = (await query(`INSERT INTO options(user_id, stock_symbol, option_type, strike_price, premium_paid, quantity, expires_at)
        OUTPUT INSERTED.id, INSERTED.expires_at VALUES (${userId}, '${symbol}', 'CALL', 20, 1, 1, SYSUTCDATETIME())`)).recordset[0];
      await query(`INSERT INTO stock_price_history(stock_symbol, score, price, timestamp, pricing_model)
        VALUES ('${symbol}', 999, 999, DATEADD(second, 1, SYSUTCDATETIME()), 'momentum-v1')`);
      await processExpiredOptions();
      assert.equal((await query(`SELECT COUNT(*) AS n FROM options WHERE id = ${expiry.id}`)).recordset[0].n, 0);
      assert.equal(Number((await query(`SELECT credits FROM users WHERE id = ${userId}`)).recordset[0].credits), 10020);
    });
    await t.test('option purchase validates shared quote and charges all 100-share contracts', async () => {
      await query(`UPDATE users SET access_token = 'test', token_expiry = DATEADD(day, 1, SYSUTCDATETIME()) WHERE id = ${userId}`);
      const originalFetch = global.fetch;
      global.fetch = async () => ({ ok: true, json: async () => ({ data: { children: [{ data: { id: symbol, score: 150 } }] } }) });
      try {
        const controller = require('../controllers/optionController');
        const response = () => ({ statusCode: 200, status(n) { this.statusCode = n; return this; }, json(value) { this.body = value; } });
        const chain = response();
        await controller.getOptionChain({ params: { symbol }, user: { id: userId } }, chain);
        assert.equal(chain.statusCode, 200);
        const contract = chain.body.contracts.find(c => c.type === 'call' && c.strike === 60);
        const body = { stockSymbol: symbol, optionType: 'call', strikePrice: contract.strike,
          premiumPaid: contract.premium, quantity: 2, expiresAt: contract.expiration.toISOString(), quoteId: chain.body.quoteId };
        const rejected = response();
        await controller.buyOption({ body: { ...body, quoteId: 'old' }, user: { id: userId } }, rejected);
        assert.equal(rejected.statusCode, 409);
        const accepted = response();
        await controller.buyOption({ body, user: { id: userId } }, accepted);
        assert.equal(accepted.statusCode, 200);
        const bought = (await query(`SELECT TOP 1 quantity, premium_paid FROM options WHERE user_id = ${userId} ORDER BY id DESC`)).recordset[0];
        assert.equal(Number(bought.quantity), 200);
        assert.equal(Number(bought.premium_paid), contract.premium * 200);
        assert.equal(Number((await query(`SELECT credits FROM users WHERE id = ${userId}`)).recordset[0].credits), 10020 - contract.premium * 200);
      } finally { global.fetch = originalFetch; }
    });
  } finally { await db.pool.close(); }
});
