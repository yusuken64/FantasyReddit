const VERSION = 'momentum-v1';
const INTERVAL_MS = 5 * 60 * 1000;
const STALE_MS = 10 * 60 * 1000;
const HORIZON_MS = 15 * 60 * 1000;
const SCORE_WEIGHT = Number(process.env.MOMENTUM_SCORE_WEIGHT ?? 5);
if (!Number.isFinite(SCORE_WEIGHT) || SCORE_WEIGHT <= 0) throw new Error('Invalid MOMENTUM_SCORE_WEIGHT');

function advance(observations, score, now) {
  if (!Number.isSafeInteger(score)) throw new Error('Invalid Reddit score');
  const last = observations.at(-1);
  if (last && now - last.time < INTERVAL_MS) return null;
  if (!last || now - last.time > STALE_MS) {
    return { observations: [{ score, time: now }], price: null, momentum: null };
  }
  const samples = [...observations, { score, time: now }];
  const cutoff = now - HORIZON_MS;
  while (samples.length > 2 && samples[1].time <= cutoff) samples.shift();
  let start = samples[0];
  if (start.time < cutoff) {
    const next = samples[1];
    start = { time: cutoff, score: start.score + (next.score - start.score) * (cutoff - start.time) / (next.time - start.time) };
  }
  const momentum = (score - start.score) / ((now - start.time) / 60000);
  const price = Math.max(10, Math.round(10 + SCORE_WEIGHT * momentum));
  if (!Number.isSafeInteger(price)) throw new Error('Price exceeds supported range');
  return { observations: samples, momentum, price };
}

function publicQuote(row, now = Date.now()) {
  const ready = row?.quote_at && row.price != null && now - new Date(row.quote_at).getTime() < STALE_MS;
  return {
    id: row?.quote_at ? new Date(row.quote_at).toISOString() : null,
    price: row?.price == null ? null : Number(row.price),
    score: row?.observations ? JSON.parse(row.observations).at(-1)?.score ?? null : null,
    momentum: row?.momentum == null ? null : Number(row.momentum),
    status: ready ? 'ready' : row?.price == null || !row?.quote_at ? 'collecting' : 'stale',
    expiresAt: row?.quote_at ? new Date(new Date(row.quote_at).getTime() + STALE_MS).toISOString() : null,
    model: VERSION,
  };
}
function assertQuote(quote, expectedId) {
  if (quote.status !== 'ready' || !expectedId || quote.id !== expectedId) {
    const error = new Error('Quote unavailable or expired. Refresh the post and confirm again.');
    error.status = 409;
    throw error;
  }
  return quote.price;
}
module.exports = { advance, publicQuote, assertQuote, VERSION, INTERVAL_MS, STALE_MS, HORIZON_MS };
