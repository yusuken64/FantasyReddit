// Test-only harness: never imported by the runtime or copied into the production image.
const { fixture, fakeReddit, settings, warm } = require('../server/test/fixture');
const { createMarket } = require('../server/market');
const { createTrading } = require('../server/trading');
const { createWorker } = require('../server/worker');
const { createApp } = require('../server/app');
(async () => {
  const f = await fixture(), reddit = fakeReddit(), market = createMarket(f.db, reddit), trading = createTrading(f.db, market), worker = createWorker(f.db, market, trading);
  await warm(f.db, market, reddit, 'abc123');
  const server = createApp({ db: f.db, config: settings, reddit, market, trading, worker }).listen(18088, '127.0.0.1');
  server.on('error', async error => { console.error(error.code); await f.close(); process.exit(1); });
  async function stop() { await new Promise(resolve => server.close(resolve)); await f.close(); process.exit(0); }
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
})().catch(error => { console.error(error); process.exit(1); });
