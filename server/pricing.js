const { amount, symbol, randomUUID, fail } = require('./domain');
const { advance, VERSION, STALE_MS, SCORE_WEIGHT } = require('./momentum');
function createPricing(db, reddit, removed, chunks) {
  const latestSql = 'SELECT TOP 1 * FROM observations WHERE symbol=@symbol ORDER BY observed_at DESC,id DESC';
  async function read(q, id) {
    const previous = (await q(latestSql, { symbol: id }))[0];
    if (previous?.terminal) return { ...previous, status: 'ready', stale: false };
    const state = (await q('SELECT *,SYSUTCDATETIME() AS now FROM market_state WHERE symbol=@symbol', { symbol: id }))[0];
    const ready = state?.quote_at && new Date(state.now) - new Date(state.quote_at) < STALE_MS && state.weight === SCORE_WEIGHT;
    return { ...previous, id: previous?.id || null, symbol: id, price: previous?.price ?? null,
      observed_at: previous?.observed_at || null, score: state ? JSON.parse(state.samples).at(-1).score : null,
      momentum: state?.momentum ?? null, pricing_model: previous?.pricing_model || VERSION, terminal: false,
      status: ready ? 'ready' : !state?.quote_at ? 'collecting' : 'stale', stale: !ready };
  }
  async function persist(post, { registerOnly = false } = {}) {
    const id = symbol(post.id);
    return db.transaction(async q => {
      let instrument = (await q('SELECT * FROM instruments WITH(UPDLOCK,HOLDLOCK) WHERE symbol=@symbol', { symbol: id }))[0];
      if (!instrument) { await q('INSERT INTO instruments(symbol,title) VALUES(@symbol,@title)', { symbol: id, title: String(post.title || id).slice(0, 300) }); instrument = { terminal: false }; }
      if (instrument.terminal) return read(q, id);
      const state = (await q('SELECT * FROM market_state WHERE symbol=@symbol', { symbol: id }))[0];
      if (state && state.weight !== SCORE_WEIGHT) fail(503, 'PRICING_CONFIGURATION', 'Pricing configuration changed. A coordinated model cutover is required.');
      const now = (await q('SELECT SYSUTCDATETIME() AS now'))[0].now;
      if (registerOnly && state) await q('UPDATE market_state SET registered_at=@now WHERE symbol=@symbol', { symbol: id, now });
      const terminal = removed(post);
      if (registerOnly && state && !terminal) return read(q, id);
      if (!terminal && (!Number.isSafeInteger(post.score) || !Number.isFinite(post.created_utc) || post.created_utc <= 0 || post.created_utc * 1000 > new Date(now).getTime())) fail(503, 'MARKET_UNAVAILABLE', 'Market data is incomplete. Retry later.');
      const next = terminal ? null : advance(state ? JSON.parse(state.samples) : [], post.score, new Date(now).getTime());
      if (!terminal && !next) return read(q, id);
      if (next) {
        const values = { symbol: id, samples: JSON.stringify(next.observations), now, quote: next.price === null ? null : now, momentum: next.momentum, weight: SCORE_WEIGHT };
        if (state) await q('UPDATE market_state SET samples=@samples,sampled_at=@now,quote_at=@quote,momentum=@momentum WHERE symbol=@symbol', values);
        else await q('INSERT INTO market_state(symbol,samples,sampled_at,quote_at,momentum,weight) VALUES(@symbol,@samples,@now,@quote,@momentum,@weight)', values);
      }
      if (terminal || next.price !== null) {
        const previous = (await q(latestSql, { symbol: id }))[0];
        const observation = { id: randomUUID(), symbol: id, price: terminal ? 0n : amount(next.price),
          score: BigInt(Number.isSafeInteger(post.score) ? post.score : previous?.score || 0),
          created_utc: Number.isFinite(post.created_utc) && post.created_utc > 0 ? new Date(post.created_utc * 1000) : previous?.created_utc || now,
          observed_at: now, terminal, model: VERSION, momentum: next?.momentum ?? null };
        await q('INSERT INTO observations(id,symbol,price,score,created_utc,observed_at,terminal,pricing_model,momentum) VALUES(@id,@symbol,@price,@score,@created_utc,@observed_at,@terminal,@model,@momentum)', observation);
        if (terminal) await q('UPDATE instruments SET terminal=1 WHERE symbol=@symbol', { symbol: id });
      }
      return read(q, id);
    });
  }
  async function current(id, { fresh = true } = {}) {
    symbol(id);
    if (!(await db.query('SELECT symbol FROM market_state WHERE symbol=@symbol', { symbol: id })).length && !(await db.query(latestSql, { symbol: id }))[0]?.terminal) {
      const post = (await reddit.posts([id])).find(p => p.id === id);
      if (!post) fail(503, 'MARKET_UNAVAILABLE', 'Post unavailable; no deletion has been confirmed.');
      await persist(post, { registerOnly: true });
    }
    await db.query('UPDATE market_state SET registered_at=SYSUTCDATETIME() WHERE symbol=@symbol', { symbol: id });
    const result = await read(db.query, id);
    if (fresh && result.status !== 'ready') fail(503, 'MARKET_UNAVAILABLE', result.status === 'collecting' ? 'Collecting momentum. A measured five-minute interval is required before trading.' : 'Price is stale. Wait for the collector to publish a fresh observation.');
    return result;
  }
  async function validate(q, id, observationId) {
    // Caller holds the instrument lock; publication and validation cannot overlap.
    const current = await read(q, id);
    if (current.status !== 'ready' || current.id?.toLowerCase() !== observationId.toLowerCase()) fail(409, 'PRICE_CHANGED', 'Market quote expired or changed. Request a new order quote.');
    return current;
  }
  return { current, persist, validate, latest: id => read(db.query, id), async refresh(ids) {
    for (const batch of chunks(ids, 100)) for (const post of await reddit.posts(batch)) if (batch.includes(post.id)) await persist(post);
  }, async browse() {
    const posts = await reddit.listing('/r/all/hot?limit=50'), rows = [];
    for (const post of posts) { try { rows.push({ title: post.title, ...await persist(post, { registerOnly: true }) }); } catch { /* Incomplete posts never receive a fabricated price. */ } }
    return rows;
  } };
}
module.exports = { createPricing };
