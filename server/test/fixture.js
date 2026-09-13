const { createDatabase } = require('../database');
const { migrate } = require('../migrate');
const { randomUUID, token, hash } = require('../domain');
async function fixture() {
  if (!process.env.TEST_SQL_CONNECTION) throw new Error('TEST_SQL_CONNECTION is required; use the disposable server in compose.test.yml.');
  const master = createDatabase(process.env.TEST_SQL_CONNECTION, { allowSystemDatabase: true });
  await master.connect();
  const name = `fantasy_test_${randomUUID().replaceAll('-', '')}`;
  await master.query(`CREATE DATABASE [${name}]`);
  const db = createDatabase({ ...master.pool.config, database: name });
  await db.connect(); await migrate(db);
  async function user(credits = 10000n) {
    const id = randomUUID(), raw = token(), csrf = token();
    await db.query('INSERT INTO accounts(id,reddit_id,username,credits) VALUES(@id,@reddit,@name,@credits)', { id, reddit: id.replaceAll('-', ''), name: 'Test trader', credits });
    await db.query('INSERT INTO sessions(token_hash,user_id,csrf_token) VALUES(@hash,@id,@csrf)', { hash: hash(raw), id, csrf });
    return { user_id: id, token_hash: hash(raw), csrf_token: csrf, raw };
  }
  return { db, user, async close() { await db.close(); await master.query(`ALTER DATABASE [${name}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [${name}]`); await master.close(); } };
}
function fakeReddit() {
  const posts = new Map();
  const post = id => posts.get(id) || { id, title: `Reddit post ${id}`, score: 1, created_utc: Math.floor(Date.now() / 1000) - 3600, selftext: 'A discussion' };
  return { postsData: posts, ready: async () => true, identity: async () => ({ id: 'testreddit', name: 'Browser trader' }), posts: async ids => ids.map(post), listing: async () => [post('abc123')] };
}
const settings = { production: false, origin: 'http://127.0.0.1:18088', clientId: 'test-client', clientSecret: 'test-secret', userAgent: 'test/1.0', redirectUri: 'http://127.0.0.1:18088/api/auth/reddit/callback', authLimit: 1000, mutationLimit: 10000, trustProxy: false };
// Seed a measured interval using the same publisher; no fake executable baseline.
async function warm(db, market, reddit, symbol) {
  if ((await db.query('SELECT symbol FROM market_state WHERE symbol=@symbol', { symbol })).length) return;
  const post = (await reddit.posts([symbol]))[0]; await market.persist(post);
  const time = (await db.query('SELECT DATEADD(minute,-5,SYSUTCDATETIME()) AS time'))[0].time;
  await db.query('UPDATE market_state SET sampled_at=@time,samples=@samples WHERE symbol=@symbol', { symbol, time, samples: JSON.stringify([{ score: post.score, time: new Date(time).getTime() }]) });
  await market.persist(post);
}
module.exports = { fixture, fakeReddit, settings, warm };
