const test = require('node:test');
const assert = require('node:assert/strict');
const { advance, publicQuote, assertQuote, INTERVAL_MS: step, STALE_MS } = require('../momentum');

function replay(scores) {
  let state = { observations: [] };
  return scores.map((score, i) => { state = advance(state.observations, score, i * step); return state; });
}
test('initial observations are not executable; sub-five-minute calls cannot reset them', () => {
  const first = advance([], 100, 0);
  assert.equal(first.price, null);
  assert.equal(advance(first.observations, 101, 1000), null);
  assert.equal(advance(first.observations, 150, step).price, 60);
  assert.throws(() => assertQuote(publicQuote(null), null), /unavailable/);
});
test('equal sustained momentum has equal value at any post age and score level', () => {
  assert.equal(replay([100, 150, 200, 250, 300]).at(-1).price, 60);
  assert.equal(replay([100000, 100050, 100100, 100150, 100200]).at(-1).price, 60);
});
test('a burst is spread across the trailing window, then leaves it', () => {
  assert.deepEqual(replay([0, 0, 0, 150, 150, 150, 150]).map(x => x.price), [null, 10, 10, 60, 60, 60, 10]);
});
test('slowing growth tapers to floor; revival raises the same old post', () => {
  assert.deepEqual(replay([0, 50, 100, 150, 150, 150, 150, 300]).map(x => x.price), [null, 60, 60, 60, 43, 27, 10, 60]);
});
test('negative growth cannot violate the floor', () => {
  assert.equal(replay([100, 50, 0]).at(-1).price, 10);
});
test('an outage resets measurement instead of turning old growth into an executable quote', () => {
  const old = replay([0, 50]).at(-1);
  const reset = advance(old.observations, 500, step + STALE_MS + 1);
  assert.equal(reset.price, null);
  assert.equal(reset.observations.length, 1);
});
test('irregular samples interpolate the start of the 15-minute window', () => {
  let state = advance([], 0, 0);
  for (const minutes of [6, 12, 18]) state = advance(state.observations, minutes * 10, minutes * 60000);
  assert.equal(state.price, 60);
});
test('quotes expire at the boundary and reject missing or superseded IDs', () => {
  const row = { quote_at: new Date(1000000), price: 60, momentum: 10 };
  const quote = publicQuote(row, 1000001);
  assert.equal(assertQuote(quote, quote.id), 60);
  assert.throws(() => assertQuote(quote, null), /expired/);
  assert.throws(() => assertQuote(quote, 'old'), /expired/);
  assert.equal(publicQuote(row, 1000000 + STALE_MS).status, 'stale');
  assert.equal(publicQuote({ ...row, quote_at: null }).status, 'collecting');
});
test('malformed observations fail instead of producing invalid prices', () => {
  for (const score of [NaN, Infinity, undefined, 1.5]) assert.throws(() => advance([], score, 0));
});
