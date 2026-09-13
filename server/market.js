const { amount, symbol, randomUUID, fail } = require('./domain');
const chunks = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
function removed(post) {
  return ['deleted', 'moderator', 'automod_filtered', 'reddit', 'content_takedown', 'anti_evil_ops', 'community_ops', 'copyright_takedown'].includes(post.removed_by_category)
    || post.removed === true || post.deleted === true || post.selftext === '[removed]' || post.selftext === '[deleted]';
}
function calculate(post, previous, now) {
  if (removed(post)) return 0n;
  if (!Number.isSafeInteger(post.score) || !Number.isFinite(post.created_utc) || post.created_utc <= 0 || post.created_utc * 1000 > now) fail(503, 'MARKET_UNAVAILABLE', 'Market data is incomplete. Retry later.');
  const minutes = (now - (previous ? new Date(previous.observed_at).getTime() : post.created_utc * 1000)) / 60000;
  if (minutes <= 0) return amount(previous?.price || 10);
  const age = Math.max(1, (now - post.created_utc * 1000) / 3600000);
  return amount(Math.max(10, Math.round(10 + ((post.score - Number(previous?.score ?? 1)) / minutes) * 5 / Math.log(age + 2))));
}
function createReddit(config, fetcher = fetch) {
  let cached, renewing, blockedUntil = 0, failures = 0, lastSuccess = 0;
  async function request(url, options = {}) {
    if (Date.now() < blockedUntil) fail(503, 'MARKET_UNAVAILABLE', 'Reddit is temporarily unavailable. Retry later.');
    try {
      const response = await fetcher(url, { ...options, signal: AbortSignal.timeout(10000), headers: { 'User-Agent': config.userAgent, ...options.headers } });
      if (!response.ok) {
        const retry = response.headers.get('retry-after');
        const delay = retry ? (/^\d+$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - Date.now()) : 0;
        blockedUntil = Date.now() + Math.max(Number.isFinite(delay) ? delay : 0, Math.min(300000, 1000 * 2 ** Math.min(++failures, 8)));
        if (response.status === 401) cached = undefined;
        fail(503, 'MARKET_UNAVAILABLE', 'Reddit is temporarily unavailable. Retry later.');
      }
      const data = await response.json(); failures = 0; return data;
    } catch {
      blockedUntil = Math.max(blockedUntil, Date.now() + Math.min(300000, 1000 * 2 ** Math.min(++failures, 8)));
      fail(503, 'MARKET_UNAVAILABLE', 'Reddit is temporarily unavailable. Retry later.');
    }
  }
  async function exchange(fields) {
    const data = await request('https://www.reddit.com/api/v1/access_token', { method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields) });
    if (typeof data.access_token !== 'string' || !Number.isFinite(data.expires_in) || data.expires_in <= 0) fail(503, 'MARKET_UNAVAILABLE', 'Reddit authentication is unavailable.');
    return data;
  }
  async function appToken() {
    if (cached && cached.expires > Date.now() + 60000) return cached.token;
    if (!renewing) renewing = exchange({ grant_type: 'client_credentials' }).then(data => {
      cached = { token: data.access_token, expires: Date.now() + data.expires_in * 1000 }; return cached.token;
    }).finally(() => { renewing = undefined; });
    return renewing;
  }
  async function listing(path) {
    const data = await request(`https://oauth.reddit.com${path}`, { headers: { Authorization: `Bearer ${await appToken()}` } });
    if (!Array.isArray(data?.data?.children)) fail(503, 'MARKET_UNAVAILABLE', 'Reddit returned incomplete data.');
    const posts = data.data.children.filter(c => c.kind === 't3' && c.data).map(c => c.data);
    if (posts.some(p => /^[a-z0-9]{1,10}$/.test(p.id) && Number.isFinite(p.created_utc) && Number.isSafeInteger(p.score))) lastSuccess = Date.now();
    return posts;
  }
  return { exchange, async identity(code) {
    const data = await exchange({ grant_type: 'authorization_code', code, redirect_uri: config.redirectUri });
    const user = await request('https://oauth.reddit.com/api/v1/me', { headers: { Authorization: `Bearer ${data.access_token}` } });
    if (!/^[a-z0-9]{1,50}$/.test(user.id) || typeof user.name !== 'string' || user.name.length > 255) fail(503, 'AUTH_UNAVAILABLE', 'Reddit identity is unavailable.');
    return user;
  }, listing, async posts(ids) { const posts = []; for (const batch of chunks(ids, 100)) posts.push(...await listing(`/by_id/${batch.map(id => `t3_${symbol(id)}`).join(',')}.json`)); return posts; },
  async ready() { if (Date.now() - lastSuccess > 60000) await listing('/r/all/hot?limit=1'); return Date.now() - lastSuccess <= 60000 && Date.now() >= blockedUntil; } };
}
function createMarket(db, reddit) {
  async function latest(id) { return (await db.query('SELECT TOP 1 * FROM observations WHERE symbol=@symbol ORDER BY observed_at DESC,id DESC', { symbol: id }))[0]; }
  async function persist(post) {
    const id = symbol(post.id);
    return db.transaction(async q => {
      let instrument = (await q('SELECT * FROM instruments WITH(UPDLOCK,HOLDLOCK) WHERE symbol=@symbol', { symbol: id }))[0];
      if (!instrument) { await q('INSERT INTO instruments(symbol,title) VALUES(@symbol,@title)', { symbol: id, title: String(post.title || id).slice(0, 300) }); instrument = { terminal: false }; }
      const previous = (await q('SELECT TOP 1 * FROM observations WHERE symbol=@symbol ORDER BY observed_at DESC,id DESC', { symbol: id }))[0];
      if (instrument.terminal) return previous;
      const now = (await q('SELECT SYSUTCDATETIME() AS now'))[0].now;
      if (previous && new Date(now) - new Date(previous.observed_at) < 15000 && !removed(post)) return previous;
      const price = calculate(post, previous, new Date(now).getTime());
      const observation = { id: randomUUID(), symbol: id, price, score: BigInt(Number.isSafeInteger(post.score) ? post.score : previous?.score || 0),
        created_utc: Number.isFinite(post.created_utc) && post.created_utc > 0 ? new Date(post.created_utc * 1000) : previous?.created_utc || now,
        observed_at: now, terminal: removed(post) };
      await q('INSERT INTO observations(id,symbol,price,score,created_utc,observed_at,terminal) VALUES(@id,@symbol,@price,@score,@created_utc,@observed_at,@terminal)', observation);
      if (observation.terminal) await q('UPDATE instruments SET terminal=1 WHERE symbol=@symbol', { symbol: id });
      return observation;
    });
  }
  async function current(id, { fresh = true } = {}) {
    symbol(id); const old = await latest(id);
    if (old?.terminal || (old && Date.now() - new Date(old.observed_at) < 15000)) return old;
    try { const post = (await reddit.posts([id])).find(p => p.id === id); if (!post) fail(503, 'MARKET_UNAVAILABLE', 'Post unavailable; no deletion has been confirmed.'); return await persist(post); }
    catch (error) { if (!fresh && old) return { ...old, stale: true }; throw error; }
  }
  return { latest, persist, current, async refresh(ids) { for (const batch of chunks(ids, 100)) { const posts = await reddit.posts(batch); for (const post of posts) if (batch.includes(post.id)) await persist(post); } },
    async browse() { const posts = await reddit.listing('/r/all/hot?limit=50'); const rows = []; for (const post of posts) { try { rows.push({ title: post.title, ...await persist(post) }); } catch { /* Invalid posts are never priced. */ } } return rows; } };
}
module.exports = { createReddit, createMarket, calculate, removed, chunks };
