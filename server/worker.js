const { randomUUID, amount } = require('./domain');
const { gauges } = require('./metrics');
function createWorker(db, market, trading) {
  const owner = randomUUID();
  const timers = [], running = new Map();
  let stopping = false;
  const metrics = { failedJobs: 0, lastSuccess: null };
  async function lease(name) {
    return db.transaction(async q => {
      const row = (await q('SELECT * FROM job_leases WITH(UPDLOCK,HOLDLOCK) WHERE name=@name', { name }))[0];
      if (!row) { await q('INSERT INTO job_leases VALUES(@name,@owner,DATEADD(second,60,SYSUTCDATETIME()))', { owner, name }); return true; }
      return (await q('UPDATE job_leases SET owner=@owner,expires_at=DATEADD(second,60,SYSUTCDATETIME()) OUTPUT inserted.owner WHERE name=@name AND (owner=@owner OR expires_at<SYSUTCDATETIME())', { owner, name })).length > 0;
    });
  }
  async function snapshots() {
    const bucket = (await db.query("SELECT DATEADD(minute,(DATEDIFF(minute,'20200101',SYSUTCDATETIME())/5)*5,CAST('20200101' AS datetime2)) AS bucket"))[0].bucket;
    let after = '00000000-0000-0000-0000-000000000000';
    while (!stopping) {
      const users = await db.query(`SELECT TOP 500 id FROM accounts a WHERE id>CAST(@after AS uniqueidentifier) AND
        (NOT EXISTS(SELECT 1 FROM snapshots s WHERE s.user_id=a.id AND s.bucket=@bucket) OR
        EXISTS(SELECT 1 FROM holdings h JOIN instruments i ON h.symbol=i.symbol WHERE h.user_id=a.id AND h.shares>0 AND i.terminal=1
          AND NOT EXISTS(SELECT 1 FROM ledger l WHERE l.user_id=a.id AND l.symbol=h.symbol AND l.instrument='STOCK' AND l.action='DELIST'))) ORDER BY id`, { after, bucket });
      if (!users.length || !await lease('snapshots')) break;
      for (const user of users) {
        if (stopping) break;
        try { await db.transaction(async q => {
          const locked = (await q('SELECT credits FROM accounts WITH(UPDLOCK,HOLDLOCK) WHERE id=@id', { id: user.id }))[0];
          if (!locked) return;
          const rows = await q(`SELECT h.symbol,h.shares,p.price,p.id AS observation_id,i.terminal FROM holdings h JOIN instruments i ON i.symbol=h.symbol OUTER APPLY(SELECT TOP 1 id,price FROM observations WHERE symbol=h.symbol ORDER BY observed_at DESC,id DESC) p WHERE user_id=@id`, { id: user.id });
          if (rows.some(r => r.price === null)) return;
          await trading.recordCrashes(q, user.id, rows);
          const value = rows.reduce((sum, r) => amount(sum + BigInt(r.shares) * BigInt(r.price)), 0n);
          await q(`IF NOT EXISTS(SELECT 1 FROM snapshots WHERE user_id=@id AND bucket=@bucket)
            INSERT INTO snapshots VALUES(@id,@bucket,@credits,@value)`, { id: user.id, credits: amount(locked.credits), value, bucket });
        }); } catch { metrics.failedJobs++; }
      }
      after = users.at(-1).id;
    }
  }
  async function prices() {
    let after = '';
    while (!stopping) {
      const symbols = await db.query(`SELECT TOP 100 i.symbol FROM instruments i LEFT JOIN market_state m ON m.symbol=i.symbol
        WHERE i.symbol>@after AND terminal=0 AND (m.sampled_at IS NULL OR m.sampled_at<=DATEADD(minute,-5,SYSUTCDATETIME())) AND
        (m.registered_at>DATEADD(day,-1,SYSUTCDATETIME()) OR EXISTS(SELECT 1 FROM holdings h WHERE h.symbol=i.symbol AND h.shares>0) OR EXISTS(SELECT 1 FROM options o WHERE o.symbol=i.symbol AND status='OPEN')) ORDER BY i.symbol`, { after });
      if (!symbols.length || !await lease('prices')) break;
      try { await market.refresh(symbols.map(s => s.symbol)); } catch { metrics.failedJobs++; }
      after = symbols.at(-1).symbol;
    }
  }
  async function settlements() {
    let cursor = '00000000-0000-0000-0000-000000000000';
    while (!stopping) {
      const due = await db.query(`SELECT TOP 500 o.id,o.user_id FROM options o JOIN instruments i ON i.symbol=o.symbol
        WHERE status='OPEN' AND (expires_at<=SYSUTCDATETIME() OR i.terminal=1) AND o.id>CAST(@after AS uniqueidentifier) ORDER BY o.id`, { after: cursor });
      if (!due.length || !await lease('settlements')) break;
      for (const option of due) { if (stopping) break; try { await trading.settleDue(option.id, option.user_id); } catch { metrics.failedJobs++; } }
      cursor = due.at(-1).id;
    }
  }
  async function maintenance() {
    await db.query(`DELETE TOP(500) FROM snapshots WHERE bucket<DATEADD(day,-90,SYSUTCDATETIME());
      DELETE TOP(500) FROM quotes WHERE expires_at<DATEADD(day,-1,SYSUTCDATETIME());
      DELETE TOP(500) FROM oauth_flows WHERE expires_at<SYSUTCDATETIME();
      DELETE TOP(500) FROM sessions WHERE last_seen<DATEADD(hour,-1,SYSUTCDATETIME()) OR created_at<DATEADD(hour,-24,SYSUTCDATETIME());
      DELETE TOP(500) FROM rate_limits WHERE window_start<DATEADD(day,-1,SYSUTCDATETIME());
      DELETE TOP(500) o FROM observations o WHERE observed_at<DATEADD(day,-90,SYSUTCDATETIME()) AND terminal=0
      AND EXISTS(SELECT 1 FROM observations newer WHERE newer.symbol=o.symbol AND newer.observed_at>o.observed_at)
      AND NOT EXISTS(SELECT 1 FROM ledger l WHERE l.observation_id=o.id)
      AND NOT EXISTS(SELECT 1 FROM quotes q WHERE q.observation_id=o.id)
      AND NOT EXISTS(SELECT 1 FROM options p WHERE p.observation_id=o.id OR (p.symbol=o.symbol AND p.status='OPEN' AND o.observed_at>=p.expires_at))
      AND NOT EXISTS(SELECT 1 FROM settlements s WHERE s.observation_id=o.id);`);
  }
  function run(name, work) {
    if (stopping) return Promise.resolve();
    if (!running.has(name)) running.set(name, (async () => {
      if (name === 'report' || await lease(name)) { await work(); if (name !== 'report') metrics.lastSuccess = new Date().toISOString(); }
    })().catch(() => { metrics.failedJobs++; }).finally(() => { running.delete(name); }));
    return running.get(name);
  }
  const jobs = { prices, settlements, snapshots, maintenance };
  async function tick() { for (const [name, work] of Object.entries(jobs)) await run(name, work); }
  async function report() {
    let current = {}; try { current = await gauges(db); } catch { metrics.failedJobs++; }
    console.log(JSON.stringify({ event: 'worker_metrics', instance: owner, ...metrics, databaseErrors: db.errors, ...current }));
  }
  return { metrics, tick, start() {
    stopping = false;
    // Independent loops: large snapshot batches and Reddit outages cannot block due-work polling.
    for (const [name, work] of Object.entries({ ...jobs, report })) {
      const job = () => run(name, work); job();
      const timer = setInterval(job, 15000); timer.unref(); timers.push(timer);
    }
  }, async stop() { stopping = true; timers.forEach(clearInterval); await Promise.all(running.values()); await db.query('DELETE FROM job_leases WHERE owner=@owner', { owner }); } };
}
module.exports = { createWorker };
