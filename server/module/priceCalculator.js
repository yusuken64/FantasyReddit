const database = require('../database');
const { advance, publicQuote, assertQuote, VERSION } = require('./momentum');

async function readQuote(symbol, transaction, expectedId) {
  await database.poolConnect;
  const request = transaction ? transaction.request() : database.pool.request();
  const result = await request.input('symbol', database.sql.NVarChar(10), symbol).query(`
    SELECT *, SYSUTCDATETIME() AS now FROM momentum_quotes ${transaction ? 'WITH (UPDLOCK, HOLDLOCK)' : ''}
    WHERE stock_symbol = @symbol
  `);
  const row = result.recordset[0];
  const quote = publicQuote(row, row ? new Date(row.now).getTime() : Date.now());
  if (expectedId !== undefined) assertQuote(quote, expectedId);
  return quote;
}

// Reads may register a baseline; only the scheduled collector advances existing observations.
async function observePost(post, { registerOnly = false } = {}) {
  if (!/^[a-z0-9]{1,10}$/i.test(post.id) || !Number.isSafeInteger(post.score)) throw new Error('Invalid post observation');
  await database.poolConnect;
  const tx = new database.sql.Transaction(database.pool);
  await tx.begin();
  try {
    const request = tx.request().input('symbol', database.sql.NVarChar(10), post.id);
    await request.query(`DECLARE @lockResult int;
      EXEC @lockResult = sp_getapplock @Resource = @symbol, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 5000;
      IF @lockResult < 0 THROW 50001, 'Cannot acquire pricing lock', 1;`);
    const result = await request.query('SELECT * FROM momentum_quotes WITH (UPDLOCK, HOLDLOCK) WHERE stock_symbol = @symbol');
    const row = result.recordset[0];
    if (row && registerOnly) {
      await request.query('UPDATE momentum_quotes SET registered_at = SYSUTCDATETIME() WHERE stock_symbol = @symbol');
      await tx.commit(); return;
    }
    const clock = await tx.request().query('SELECT SYSUTCDATETIME() AS now');
    const now = new Date(clock.recordset[0].now);
    const next = advance(row ? JSON.parse(row.observations) : [], post.score, now.getTime());
    if (next) {
      await tx.request()
        .input('symbol', database.sql.NVarChar(10), post.id)
        .input('samples', database.sql.NVarChar(database.sql.MAX), JSON.stringify(next.observations))
        .input('price', database.sql.BigInt, next.price)
        .input('momentum', database.sql.Float, next.momentum)
        .input('now', database.sql.DateTime2, now)
        .query(`IF EXISTS (SELECT 1 FROM momentum_quotes WHERE stock_symbol = @symbol)
          UPDATE momentum_quotes SET observations = @samples, observed_at = @now,
            price = COALESCE(@price, price), momentum = @momentum,
            quote_at = CASE WHEN @price IS NULL THEN NULL ELSE @now END WHERE stock_symbol = @symbol;
          ELSE INSERT INTO momentum_quotes (stock_symbol, observations, observed_at, price, momentum, quote_at)
            VALUES (@symbol, @samples, @now, @price, @momentum, NULL);`);
      if (next.price !== null) await tx.request()
        .input('symbol', database.sql.NVarChar(10), post.id)
        .input('score', database.sql.BigInt, post.score)
        .input('price', database.sql.BigInt, next.price)
        .input('now', database.sql.DateTime2, now)
        .input('version', database.sql.NVarChar(32), VERSION)
        .query(`INSERT INTO stock_price_history (stock_symbol, score, price, timestamp, pricing_model)
          VALUES (@symbol, @score, @price, @now, @version)`);
    }
    await tx.commit();
  } catch (error) { await tx.rollback(); throw error; }
}
module.exports = { readQuote, observePost };
