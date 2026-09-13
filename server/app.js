const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('node:path');
const { createAuth } = require('./auth');
const { gauges } = require('./metrics');
const { AppError, fail, randomUUID, json, symbol, amount } = require('./domain');
function createApp({ db, config, reddit, market, trading, worker, assets = path.resolve(__dirname, '../client/dist') }) {
  const app = express(), auth = createAuth(db, config, reddit);
  app.disable('x-powered-by'); app.set('trust proxy', config.trustProxy);
  app.use((req, res, next) => {
    req.requestId = randomUUID(); res.set('X-Request-ID', req.requestId);
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.redd.it; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'", 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()' });
    if (config.production) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    const started = Date.now();
    res.on('finish', () => console.log(JSON.stringify({ event: 'request', requestId: req.requestId, method: req.method, status: res.statusCode, durationMs: Date.now() - started })));
    next();
  });
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use(express.json({ limit: '16kb' }), cookieParser());
  app.get('/api/health/live', (req, res) => res.json({ status: 'ok' }));
  app.get('/api/health/ready', async (req, res) => {
    try { if (!await db.ready() || !await reddit.ready()) throw new Error(); res.json({ status: 'ready' }); }
    catch { res.status(503).json({ error: { code: 'NOT_READY', message: 'Required database or Reddit access is unavailable.' }, requestId: req.requestId }); }
  });
  app.get('/api/auth/reddit', auth.login);
  app.get('/api/auth/reddit/callback', auth.callback);
  // An API miss must never return the SPA document, including /api itself.
  const api = express.Router(); app.use('/api', api);
  api.use(auth.authenticate);
  api.use((req, res, next) => ['GET','HEAD','OPTIONS'].includes(req.method) ? next() : auth.mutation(req, res, next));
  const send = fn => async (req, res) => res.json(json(await fn(req)));
  api.get('/me', send(async req => {
    const user = (await db.query('SELECT id,username,credits,generation FROM accounts WHERE id=@id', { id: req.session.user_id }))[0];
    if (!user) fail(401, 'UNAUTHORIZED', 'Account no longer exists.'); return { ...user, csrfToken: req.session.csrf_token };
  }));
  api.post('/auth/logout', auth.logout);
  api.get('/market', send(() => market.browse()));
  api.get('/market/:symbol', send(req => market.current(symbol(req.params.symbol), { fresh: false })));
  api.get('/prices/:symbol', send(req => db.query('SELECT TOP 500 price,observed_at,pricing_model,momentum FROM observations WHERE symbol=@symbol ORDER BY observed_at DESC,id DESC', { symbol: symbol(req.params.symbol) })));
  api.post('/quotes', send(req => trading.quote(req.session, req.body)));
  api.post('/orders', send(req => trading.execute(req.session, req.get('Idempotency-Key'), req.body)));
  api.post('/options/:id/exercise', send(req => trading.exercise(req.session, req.get('Idempotency-Key'), req.params.id, req.body)));
  api.post('/account/reset', send(req => trading.reset(req.session, req.get('Idempotency-Key'), req.body)));
  api.delete('/account', async (req, res) => { const result = await trading.deleteAccount(req.session, req.body); res.clearCookie(auth.cookieName, auth.cookie); res.json(result); });
  api.delete('/holdings/:symbol', send(req => trading.remove(req.session, req.get('Idempotency-Key'), req.params.symbol, req.body)));
  api.get('/holdings', send(req => db.query(`SELECT h.*,i.title,i.terminal,p.price,p.observed_at,
    CASE WHEN p.observed_at<DATEADD(minute,-10,SYSUTCDATETIME()) AND i.terminal=0 THEN 1 ELSE 0 END AS stale
    FROM holdings h JOIN instruments i ON i.symbol=h.symbol OUTER APPLY(SELECT TOP 1 price,observed_at FROM observations WHERE symbol=h.symbol ORDER BY observed_at DESC,id DESC) p WHERE h.user_id=@user ORDER BY h.symbol`, { user: req.session.user_id })));
  function page(req, fields, fallback) {
    const limit = Number(req.query.limit || 25), offset = Number(req.query.offset || 0);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(offset) || offset < 0 || offset > 1000000) fail(400, 'INVALID_PAGE', 'Invalid pagination.');
    const sort = req.query.sort || fallback, dir = req.query.dir || 'DESC';
    if (!fields.includes(sort) || !['ASC','DESC'].includes(dir)) fail(400, 'INVALID_SORT', 'Invalid sort order.');
    return { limit, offset, sort, dir };
  }
  async function history(req, instrument) {
    const { limit, offset, sort, dir } = page(req, ['created_at','quantity','payout'], 'created_at');
    return db.query(`SELECT * FROM ledger WHERE user_id=@user ${instrument ? 'AND instrument=@instrument' : ''} ORDER BY ${sort} ${dir},id ${dir} OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`, { user: req.session.user_id, instrument: instrument || null, limit, offset });
  }
  api.get('/options/history', send(req => history(req, 'OPTION')));
  api.get('/transactions', send(req => history(req)));
  api.get('/options', send(req => {
    const { limit, offset, sort, dir } = page(req, ['expires_at','created_at','quantity'], 'expires_at');
    return db.query(`SELECT o.*,100 AS contract_size,p.price,p.observed_at,CASE WHEN i.terminal=0 AND p.observed_at<DATEADD(minute,-10,SYSUTCDATETIME()) THEN 1 ELSE 0 END AS stale,
      CASE WHEN status='OPEN' AND (expires_at<=SYSUTCDATETIME() OR i.terminal=1) THEN 'PENDING' ELSE status END AS settlement_status
      FROM options o JOIN instruments i ON i.symbol=o.symbol OUTER APPLY(SELECT TOP 1 price,observed_at FROM observations WHERE symbol=o.symbol ORDER BY observed_at DESC,id DESC) p
      WHERE user_id=@user ORDER BY o.${sort} ${dir},o.id ${dir} OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`, { user: req.session.user_id, limit, offset });
  }));
  api.get('/portfolio', send(req => db.transaction(async q => {
    const user = await trading.lock(q, req.session.user_id, req.session);
    const rows = await q(`SELECT h.shares,p.price,p.observed_at,i.terminal FROM holdings h JOIN instruments i ON i.symbol=h.symbol
      OUTER APPLY(SELECT TOP 1 price,observed_at FROM observations WHERE symbol=h.symbol ORDER BY observed_at DESC,id DESC) p WHERE user_id=@user`, { user: user.id });
    const holdings = rows.reduce((total, h) => amount(total + BigInt(h.shares) * BigInt(h.price)), 0n);
    return { credits: user.credits, holdings_value: holdings, portfolio_value: amount(holdings + BigInt(user.credits)), stale: rows.some(r => !r.terminal && Date.now() - new Date(r.observed_at) > 600000),
      history: await q('SELECT TOP 500 * FROM snapshots WHERE user_id=@user ORDER BY bucket DESC', { user: user.id }) };
  })));
  api.get('/metrics', send(async () => ({ ...worker.metrics, databaseErrors: db.errors, ...await gauges(db) })));
  app.use('/api', (req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API endpoint not found.' }, requestId: req.requestId }));
  app.use(express.static(assets, { index: false, maxAge: config.production ? '1h' : 0 }));
  app.use((req, res, next) => { if (req.method === 'GET' && req.accepts('html') && !path.extname(req.path)) res.sendFile(path.join(assets, 'index.html')); else next(); });
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const known = error instanceof AppError;
    const status = known ? error.status : error.type === 'entity.parse.failed' ? 400 : error.type === 'entity.too.large' ? 413 : 500;
    if (status === 429) res.set('Retry-After', '60');
    res.status(status).json({ error: { code: known ? error.code : status < 500 ? 'INVALID_INPUT' : 'INTERNAL_ERROR', message: known ? error.message : status < 500 ? 'Invalid request body.' : 'Request failed. Retry using the same request key.' }, requestId: req.requestId });
  });
  return app;
}
module.exports = { createApp };
