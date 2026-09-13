const { config } = require('./config');
const { createDatabase } = require('./database');
const { createReddit, createMarket } = require('./market');
const { createTrading } = require('./trading');
const { createWorker } = require('./worker');
const { createApp } = require('./app');
async function start() {
  const settings = config(), db = createDatabase(settings.connectionString);
  await db.connect();
  const reddit = createReddit(settings), market = createMarket(db, reddit), trading = createTrading(db, market);
  const worker = createWorker(db, market, trading);
  const app = createApp({ db, config: settings, reddit, market, trading, worker });
  const server = app.listen(settings.port);
  if (await db.ready().catch(() => false)) worker.start();
  let closing = false;
  async function shutdown() {
    if (closing) return; closing = true;
    const timeout = setTimeout(() => process.exit(1), 30000); timeout.unref();
    await Promise.all([new Promise(resolve => server.close(resolve)), worker.stop().catch(() => {})]);
    await db.close(); clearTimeout(timeout);
  }
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
  return { server, shutdown };
}
if (require.main === module) start().catch(() => { console.error(JSON.stringify({ event: 'startup_failed', message: 'Check required configuration, SQL connectivity and migrations.' })); process.exitCode = 1; });
module.exports = { start };
