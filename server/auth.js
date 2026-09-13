const { token, hash, randomUUID, fail } = require('./domain');
function createAuth(db, config, reddit) {
  const cookieName = config.production ? '__Host-session' : 'session';
  const flowName = config.production ? '__Host-oauth' : 'oauth';
  const cookie = { httpOnly: true, secure: config.production, sameSite: 'lax', path: '/' };
  async function rate(key, limit) {
    const rows = await db.transaction(async q => q(`
      IF EXISTS(SELECT 1 FROM rate_limits WITH(UPDLOCK,HOLDLOCK) WHERE bucket_key=@key)
        UPDATE rate_limits SET hits=CASE WHEN window_start<DATEADD(minute,-1,SYSUTCDATETIME()) THEN 1 ELSE hits+1 END,
        window_start=CASE WHEN window_start<DATEADD(minute,-1,SYSUTCDATETIME()) THEN SYSUTCDATETIME() ELSE window_start END WHERE bucket_key=@key;
      ELSE INSERT INTO rate_limits VALUES(@key,SYSUTCDATETIME(),1);
      SELECT hits FROM rate_limits WHERE bucket_key=@key`, { key: hash(key) }));
    if (rows[0].hits > limit) fail(429, 'RATE_LIMITED', 'Too many requests. Retry in one minute.');
  }
  async function authenticate(req, res, next) {
    const raw = req.cookies[cookieName];
    if (typeof raw !== 'string' || raw.length !== 43) fail(401, 'UNAUTHORIZED', 'Please log in.');
    const rows = await db.query(`UPDATE sessions SET last_seen=SYSUTCDATETIME()
      OUTPUT inserted.* WHERE token_hash=@hash AND last_seen>DATEADD(hour,-1,SYSUTCDATETIME()) AND created_at>DATEADD(hour,-24,SYSUTCDATETIME())`, { hash: hash(raw) });
    if (!rows.length) fail(401, 'UNAUTHORIZED', 'Your session expired. Please log in.');
    req.session = rows[0];
    res.cookie(cookieName, raw, { ...cookie, maxAge: Math.max(0, Math.min(3600000, new Date(rows[0].created_at).getTime() + 86400000 - Date.now())) });
    next();
  }
  async function mutation(req, res, next) {
    if (req.get('Origin') !== config.origin || req.get('X-CSRF-Token') !== req.session.csrf_token) fail(403, 'CSRF_REJECTED', 'Refresh the page and retry from this site.');
    await rate(`mutation:${req.session.user_id}`, config.mutationLimit); next();
  }
  return { authenticate, mutation, rate, cookieName, cookie,
    async login(req, res) {
      await rate(`auth:${req.ip}`, config.authLimit);
      const state = token(), browser = token();
      await db.query('INSERT INTO oauth_flows VALUES(@state,@browser,DATEADD(minute,10,SYSUTCDATETIME()))', { state: hash(state), browser: hash(browser) });
      res.cookie(flowName, browser, { ...cookie, maxAge: 600000 });
      res.redirect(`https://www.reddit.com/api/v1/authorize?${new URLSearchParams({ client_id: config.clientId, response_type: 'code', state, redirect_uri: config.redirectUri, duration: 'temporary', scope: 'identity' })}`);
    },
    async callback(req, res) {
      await rate(`auth:${req.ip}`, config.authLimit);
      if (typeof req.query.state !== 'string' || req.query.state.length !== 43 || typeof req.cookies[flowName] !== 'string') fail(400, 'INVALID_STATE', 'Login flow is missing or expired. Start login again.');
      const rows = await db.query('DELETE FROM oauth_flows OUTPUT deleted.state_hash WHERE state_hash=@state AND browser_hash=@browser AND expires_at>SYSUTCDATETIME()', { state: hash(req.query.state), browser: hash(req.cookies[flowName]) });
      res.clearCookie(flowName, cookie);
      if (!rows.length) fail(400, 'INVALID_STATE', 'Login flow is missing or expired. Start login again.');
      if (typeof req.query.code !== 'string' || !req.query.code || req.query.code.length > 2048) fail(400, 'INVALID_CODE', 'Login was not completed. Start again.');
      const identity = await reddit.identity(req.query.code), raw = token();
      await db.transaction(async q => {
        let user = (await q('SELECT * FROM accounts WITH(UPDLOCK,HOLDLOCK) WHERE reddit_id=@reddit', { reddit: identity.id }))[0];
        if (!user) { user = { id: randomUUID() }; await q('INSERT INTO accounts(id,reddit_id,username) VALUES(@id,@reddit,@name)', { id: user.id, reddit: identity.id, name: identity.name }); }
        else await q('UPDATE accounts SET username=@name WHERE id=@id', { id: user.id, name: identity.name });
        await q('INSERT INTO sessions(token_hash,user_id,csrf_token) VALUES(@hash,@id,@csrf)', { hash: hash(raw), id: user.id, csrf: token() });
      });
      res.cookie(cookieName, raw, { ...cookie, maxAge: 3600000 }); res.redirect('/portfolio');
    },
    async logout(req, res) { await db.query('DELETE FROM sessions WHERE token_hash=@hash', { hash: req.session.token_hash }); res.clearCookie(cookieName, cookie); res.json({ success: true }); }
  };
}
module.exports = { createAuth };
