const { amount, quantity, symbol, uuid, generation, exact, premium, payout, hash, randomUUID, fail, json } = require('./domain');
function createTrading(db, market) {
  async function lock(q, userId, session) {
    const user = (await q('SELECT * FROM accounts WITH(UPDLOCK,HOLDLOCK) WHERE id=@id', { id: userId }))[0];
    if (!user) fail(401, 'UNAUTHORIZED', 'Account no longer exists.');
    if (session && !(await q('SELECT token_hash FROM sessions WHERE token_hash=@hash AND user_id=@id AND last_seen>DATEADD(hour,-1,SYSUTCDATETIME()) AND created_at>DATEADD(hour,-24,SYSUTCDATETIME())', { hash: session.token_hash, id: userId })).length) fail(401, 'UNAUTHORIZED', 'Session no longer exists.');
    return user;
  }
  function checkGeneration(user, expected) { if (BigInt(user.generation) !== expected) fail(409, 'ACCOUNT_CHANGED', 'Account was reset. Refresh before trading.'); }
  async function mutate(session, key, input, expected, work) {
    uuid(key); const fingerprint = hash(JSON.stringify(input));
    return db.transaction(async q => {
      const user = await lock(q, session.user_id, session);
      const prior = (await q('SELECT * FROM idempotency WHERE user_id=@user AND request_key=@key', { user: user.id, key }))[0];
      if (prior) {
        if (prior.fingerprint !== fingerprint) fail(409, 'IDEMPOTENCY_CONFLICT', 'This request key was already used for another request.');
        return JSON.parse(prior.result);
      }
      if (expected !== undefined) checkGeneration(user, expected);
      const result = json(await work(q, user));
      await q('INSERT INTO idempotency(user_id,request_key,fingerprint,result) VALUES(@user,@key,@fingerprint,@result)', { user: user.id, key, fingerprint, result: JSON.stringify(result) });
      return result;
    });
  }
  async function record(q, data) {
    await q(`INSERT INTO ledger(id,user_id,symbol,instrument,action,quantity,price,cost,payout,quote_id,option_id,observation_id)
      VALUES(@id,@user_id,@symbol,@instrument,@action,@quantity,@price,@cost,@payout,@quote_id,@option_id,@observation_id)`,
    { id: randomUUID(), quote_id: null, option_id: null, cost: 0n, payout: 0n, ...data });
  }
  async function quote(session, body) {
    exact(body, ['generation','symbol','action','quantity','optionType','step','days']);
    const count = quantity(body.quantity), id = symbol(body.symbol), gen = generation(body.generation);
    if (!['BUY','SELL','SELL_REMOVE','OPTION'].includes(body.action)) fail(400, 'INVALID_ACTION', 'Select a supported order action.');
    if (body.action !== 'OPTION' && ['optionType','step','days'].some(k => body[k] !== undefined)) fail(400, 'INVALID_INPUT', 'Stock orders cannot specify option terms.');
    const observation = await market.current(id);
    let contract = { strike: null, premium: null };
    if (body.action === 'OPTION') contract = premium(observation.price, observation.score, body.optionType, body.step, body.days);
    const cost = amount((body.action === 'OPTION' ? contract.premium * 100n : BigInt(observation.price)) * count);
    return db.transaction(async q => {
      const user = await lock(q, session.user_id, session); checkGeneration(user, gen);
      const instrument = (await q('SELECT * FROM instruments WITH(UPDLOCK,HOLDLOCK) WHERE symbol=@symbol', { symbol: id }))[0];
      if (instrument.terminal && (body.action === 'BUY' || body.action === 'OPTION')) fail(409, 'DELISTED', 'This post is removed and cannot be purchased.');
      // A crash observed between the network fetch and this lock invalidates this observation.
      if (instrument.terminal && !observation.terminal) fail(409, 'PRICE_CHANGED', 'Price changed. Request a new quote.');
      const result = { id: randomUUID(), user_id: user.id, generation: gen, symbol: id, observation_id: observation.id,
        action: body.action, quantity: count, price: amount(observation.price), cost, option_type: body.action === 'OPTION' ? body.optionType : null, ...contract };
      const rows = await q(`INSERT INTO quotes(id,user_id,generation,symbol,observation_id,action,quantity,price,cost,option_type,strike,premium,option_expiry,expires_at)
        OUTPUT inserted.* VALUES(@id,@user_id,@generation,@symbol,@observation_id,@action,@quantity,@price,@cost,@option_type,@strike,@premium,
        CASE WHEN @days IS NULL THEN NULL ELSE DATEADD(day,CAST(@days AS int),SYSUTCDATETIME()) END, DATEADD(second,30,SYSUTCDATETIME()))`, { ...result, days: body.action === 'OPTION' ? body.days : null });
      return json({ ...rows[0], contract_size: body.action === 'OPTION' ? 100 : 1, total_premium: body.action === 'OPTION' ? cost : null, price_observed_at: observation.observed_at });
    });
  }
  async function execute(session, key, body) {
    exact(body, ['quoteId']); const quoteId = uuid(body.quoteId);
    return mutate(session, key, ['execute', quoteId], undefined, async (q, user) => {
      const order = (await q('SELECT *, CASE WHEN expires_at>SYSUTCDATETIME() THEN 1 ELSE 0 END AS valid FROM quotes WHERE id=@id AND user_id=@user', { id: quoteId, user: user.id }))[0];
      if (!order) fail(409, 'QUOTE_UNAVAILABLE', 'Quote is unavailable. Request a new quote.');
      checkGeneration(user, BigInt(order.generation));
      if (!order.valid || order.consumed) fail(409, 'QUOTE_EXPIRED', 'Quote expired or was used. Request a new quote.');
      const instrument = (await q('SELECT * FROM instruments WITH(UPDLOCK,HOLDLOCK) WHERE symbol=@symbol', { symbol: order.symbol }))[0];
      if (instrument.terminal && (order.action === 'BUY' || order.action === 'OPTION' || BigInt(order.price) !== 0n)) fail(409, 'DELISTED', 'The post was removed. Request a new quote.');
      const cost = amount(order.cost), count = BigInt(order.quantity);
      let credits = amount(user.credits), optionId = null;
      const buying = order.action === 'BUY' || order.action === 'OPTION';
      if (buying) {
        if (credits < cost) fail(409, 'INSUFFICIENT_FUNDS', 'Insufficient credits for this order.');
        credits -= cost;
        if (!(await q('UPDATE accounts SET credits=credits-@cost OUTPUT inserted.id WHERE id=@user AND credits>=@cost', { user: user.id, cost })).length) fail(409, 'INSUFFICIENT_FUNDS', 'Insufficient credits.');
      }
      if (order.action === 'OPTION') {
        optionId = randomUUID();
        await q(`INSERT INTO options(id,user_id,symbol,option_type,strike,premium,total_premium,quantity,expires_at)
          VALUES(@id,@user,@symbol,@type,@strike,@premium,@cost,@quantity,@expiry)`,
        { id: optionId, user: user.id, symbol: order.symbol, type: order.option_type, strike: amount(order.strike), premium: amount(order.premium), cost, quantity: count, expiry: order.option_expiry });
      } else {
        const holding = (await q('SELECT * FROM holdings WITH(UPDLOCK,HOLDLOCK) WHERE user_id=@user AND symbol=@symbol', { user: user.id, symbol: order.symbol }))[0];
        if (order.action === 'BUY') {
          if (!holding) {
            if ((await q('SELECT COUNT(*) AS n FROM holdings WHERE user_id=@user', { user: user.id }))[0].n >= 20) fail(409, 'HOLDING_LIMIT', 'Remove a holding before adding a 21st symbol.');
            await q('INSERT INTO holdings VALUES(@user,@symbol,@quantity,@cost)', { user: user.id, symbol: order.symbol, quantity: count, cost });
          } else {
            amount(BigInt(holding.shares) + count); amount(BigInt(holding.total_spent) + cost);
            await q('UPDATE holdings SET shares=shares+@quantity,total_spent=total_spent+@cost WHERE user_id=@user AND symbol=@symbol', { user: user.id, symbol: order.symbol, quantity: count, cost });
          }
        } else {
          if (!holding || BigInt(holding.shares) < count) fail(409, 'INSUFFICIENT_SHARES', 'Not enough shares to sell.');
          if (order.action === 'SELL_REMOVE' && BigInt(holding.shares) !== count) fail(409, 'POSITION_CHANGED', 'Holding changed. Request a new sell-and-remove quote.');
          credits = amount(credits + cost);
          const remaining = BigInt(holding.shares) - count;
          await q('UPDATE holdings SET shares=shares-@quantity,total_spent=@spent WHERE user_id=@user AND symbol=@symbol AND shares>=@quantity',
            { user: user.id, symbol: order.symbol, quantity: count, spent: amount(BigInt(holding.total_spent) * remaining / BigInt(holding.shares)) });
          if (order.action === 'SELL_REMOVE') await q('DELETE FROM holdings WHERE user_id=@user AND symbol=@symbol AND shares=0', { user: user.id, symbol: order.symbol });
          await q('UPDATE accounts SET credits=@credits WHERE id=@user', { user: user.id, credits });
        }
      }
      await record(q, { user_id: user.id, symbol: order.symbol, instrument: order.action === 'OPTION' ? 'OPTION' : 'STOCK', action: buying ? 'BUY' : 'SELL',
        quantity: count, price: amount(order.price), cost: buying ? cost : 0n, payout: buying ? 0n : cost, quote_id: order.id, option_id: optionId, observation_id: order.observation_id });
      await q('UPDATE quotes SET consumed=1 WHERE id=@id', { id: order.id });
      return { success: true, credits, optionId };
    });
  }
  async function settleInTransaction(q, user, option, observation, action) {
    const paid = payout(option, observation.price), credits = amount(BigInt(user.credits) + paid);
    const claimed = await q("UPDATE options SET status='SETTLED',observation_id=@observation OUTPUT inserted.id WHERE id=@id AND user_id=@user AND status='OPEN'", { id: option.id, user: user.id, observation: observation.id });
    if (!claimed.length) fail(409, 'OPTION_SETTLED', 'Option is already settled.');
    await q('INSERT INTO settlements VALUES(@option,@user,@observation,@payout)', { option: option.id, user: user.id, observation: observation.id, payout: paid });
    await q('UPDATE accounts SET credits=@credits WHERE id=@user', { credits, user: user.id });
    await record(q, { user_id: user.id, symbol: option.symbol, instrument: 'OPTION', action, quantity: BigInt(option.quantity), price: amount(observation.price), payout: paid, option_id: option.id, observation_id: observation.id });
    return { success: true, payout: paid, credits, status: 'SETTLED' };
  }
  async function exercise(session, key, optionId, body) {
    exact(body, ['generation']); uuid(optionId); uuid(key); const gen = generation(body.generation);
    // Replays must succeed during a subsequent market outage as well.
    const prior = (await db.query('SELECT result,fingerprint FROM idempotency WHERE user_id=@user AND request_key=@key', { user: session.user_id, key }))[0];
    const input = ['exercise', optionId, body.generation];
    if (prior) return mutate(session, key, input, gen, () => { throw new Error('Missing replay'); });
    const option = (await db.query("SELECT * FROM options WHERE id=@id AND user_id=@user AND status='OPEN' AND expires_at>SYSUTCDATETIME()", { id: optionId, user: session.user_id }))[0];
    if (!option) fail(409, 'OPTION_UNAVAILABLE', 'Option unavailable or expired; expired options settle automatically.');
    const observation = await market.current(option.symbol);
    return mutate(session, key, input, gen, async (q, user) => {
      const current = (await q("SELECT * FROM options WHERE id=@id AND user_id=@user AND status='OPEN' AND expires_at>SYSUTCDATETIME()", { id: optionId, user: user.id }))[0];
      if (!current) fail(409, 'OPTION_UNAVAILABLE', 'Option unavailable or expired.');
      const instrument = (await q('SELECT * FROM instruments WITH(UPDLOCK,HOLDLOCK) WHERE symbol=@symbol', { symbol: current.symbol }))[0];
      if (instrument.terminal && !observation.terminal) fail(409, 'PRICE_CHANGED', 'Post removed; settlement is pending.');
      return settleInTransaction(q, user, current, observation, observation.terminal ? 'DELIST' : 'EXERCISE');
    });
  }
  async function settleDue(optionId, userId) {
    // Pin the first eligible persisted observation before payout. A retry can never reprice it.
    const pinned = await db.transaction(async q => {
      const user = (await q('SELECT * FROM accounts WITH(UPDLOCK,HOLDLOCK) WHERE id=@id', { id: userId }))[0];
      if (!user) return false;
      const option = (await q("SELECT * FROM options WHERE id=@id AND user_id=@user AND status='OPEN'", { id: optionId, user: userId }))[0];
      if (!option) return false;
      if (option.observation_id) return true;
      await q('SELECT symbol FROM instruments WITH(UPDLOCK,HOLDLOCK) WHERE symbol=@symbol', { symbol: option.symbol });
      const observation = (await q(`SELECT TOP 1 * FROM observations WHERE symbol=@symbol AND (observed_at>=@expiry OR terminal=1) ORDER BY observed_at,id`, { symbol: option.symbol, expiry: option.expires_at }))[0];
      if (!observation) return false;
      await q('UPDATE options SET observation_id=@observation WHERE id=@id', { id: optionId, observation: observation.id }); return true;
    });
    if (!pinned) return;
    return db.transaction(async q => {
      const user = (await q('SELECT * FROM accounts WITH(UPDLOCK,HOLDLOCK) WHERE id=@id', { id: userId }))[0];
      if (!user) return;
      const option = (await q("SELECT * FROM options WHERE id=@id AND user_id=@user AND status='OPEN'", { id: optionId, user: userId }))[0];
      if (!option) return;
      const observation = (await q('SELECT * FROM observations WHERE id=@id', { id: option.observation_id }))[0];
      return settleInTransaction(q, user, option, observation, observation.terminal ? 'DELIST' : 'EXPIRE');
    });
  }
  async function clear(q, userId) {
    for (const table of ['settlements','ledger','options','holdings','snapshots','quotes']) await q(`DELETE FROM ${table} WHERE user_id=@user`, { user: userId });
  }
  return { quote, execute, exercise, settleDue, lock,
    async recordCrashes(q, userId, holdings) {
      for (const holding of holdings) {
        if (!holding.terminal || BigInt(holding.shares) === 0n) continue;
        if ((await q("SELECT id FROM ledger WHERE user_id=@user AND symbol=@symbol AND instrument='STOCK' AND action='DELIST'", { user: userId, symbol: holding.symbol })).length) continue;
        await record(q, { user_id: userId, symbol: holding.symbol, instrument: 'STOCK', action: 'DELIST', quantity: BigInt(holding.shares), price: 0n, observation_id: holding.observation_id });
      }
    },
    async reset(session, key, body) {
      exact(body, ['generation']); const gen = generation(body.generation);
      return mutate(session, key, ['reset', body.generation], gen, async (q, user) => {
        await clear(q, user.id); const next = amount(BigInt(user.generation) + 1n);
        await q('UPDATE accounts SET credits=10000,generation=@generation WHERE id=@user', { user: user.id, generation: next });
        await q('DELETE FROM sessions WHERE user_id=@user AND token_hash<>@hash', { user: user.id, hash: session.token_hash });
        return { success: true, credits: 10000, generation: next };
      });
    },
    async deleteAccount(session, body) {
      exact(body, ['generation']); const gen = generation(body.generation);
      return db.transaction(async q => { const user = await lock(q, session.user_id, session); checkGeneration(user, gen); await clear(q, user.id); await q('DELETE FROM accounts WHERE id=@id', { id: user.id }); return { success: true }; });
    },
    async remove(session, key, id, body) {
      symbol(id); exact(body, ['generation']); const gen = generation(body.generation);
      return mutate(session, key, ['remove', id, body.generation], gen, async (q, user) => {
        const instrument = (await q('SELECT * FROM instruments WITH(UPDLOCK,HOLDLOCK) WHERE symbol=@symbol', { symbol: id }))[0];
        const holding = (await q('SELECT * FROM holdings WHERE user_id=@user AND symbol=@symbol', { user: user.id, symbol: id }))[0];
        if (!holding) fail(404, 'NOT_FOUND', 'Holding not found.');
        if (!instrument.terminal && BigInt(holding.shares) !== 0n) fail(409, 'SALE_REQUIRED', 'Request a sell-and-remove quote for this holding.');
        if (BigInt(holding.shares) > 0n) {
          const observation = (await q('SELECT TOP 1 * FROM observations WHERE symbol=@symbol AND terminal=1 ORDER BY observed_at,id', { symbol: id }))[0];
          await record(q, { user_id: user.id, symbol: id, instrument: 'STOCK', action: 'REMOVE', quantity: BigInt(holding.shares), price: 0n, observation_id: observation.id });
        }
        await q('DELETE FROM holdings WHERE user_id=@user AND symbol=@symbol', { user: user.id, symbol: id }); return { success: true };
      });
    }
  };
}
module.exports = { createTrading };
