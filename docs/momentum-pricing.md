# Momentum pricing

Merged into the hardened application. `server/momentum.js` provides the model and `server/pricing.js` publishes observations through the shared market service.

## Model

`price = max(10, round(10 + weight * smoothedScoreGrowthPerMinute))`

Weight defaults to 5 (`MOMENTUM_SCORE_WEIGHT`, finite and positive). There is no post-age multiplier. Samples are at least five minutes apart; growth is measured across a trailing 15-minute window, interpolating the score at its start for irregular samples. During initialization, use the available measured window once it spans five minutes. A first observation is a baseline, not an executable 10-credit price. A gap over ten minutes resets that baseline and blocks trading until another measured interval exists. The last published price remains visible as a reference.

Browsing and order requests register interest but never advance existing samples. Independent workers wake every 15 seconds and collect only due symbols: recently browsed posts (24 hours), positive holdings, and open options. Collection uses application-only Reddit OAuth, not player sessions. SQL instrument locks serialize publication. No failed fetch becomes a zero-growth sample.

## Quotes and settlement

A published momentum observation is usable for ten minutes. The hardened API then creates a **30-second order quote** binding the account generation, quantity and complete economics. Execution validates the persisted observation again while holding the instrument lock; stale or superseded observations return PRICE_CHANGED rather than silently repricing. Prices, charts, holdings, options and settlement all read persisted observations tagged `momentum-v1`. Market responses include collecting/ready/stale status, sampled score and momentum. Options use the published price and timestamp to derive stable strikes, premiums and expiration terms.

The hardened contract and security rules remain authoritative: 100 shares per option contract, server-owned economics, idempotency keys, ownership checks, account locks, and exactly-once payouts. Early exercise rejects expired options. Normal expiry uses the **first valid published observation at or after expiry**, retaining the already-agreed outage rule rather than the older branch's pre-expiry fallback. Confirmed deletion/removal publishes terminal zero immediately, invalidates purchases and settles PUT/CALL intrinsic value at zero. Ambiguous missing posts and upstream failures never trigger a crash.

## Migration and rollout

Run the dedicated migration command before restarting the image. `002_momentum.sql` adds market state and observation model tags; existing observations keep `legacy-age-v1` and their references. Readiness requires migrations 1 and 2. Runtime does not create schema. Existing held symbols are registered by the collector and must collect a new baseline and interval before further trading; new installations still use the fresh-database setup in the operations guide.

All replicas must use the same weight. Persisted state records that weight and refuses publication or trading if a replica differs. Changing weight requires an intentional model cutover, not an environment-only rolling update. Stop old writers before switching models. Removing age decay can materially revalue older posts; replay representative histories and review balance before public rollout. Weight 5 remains provisional, not a claim of validated game balance.

## Verification

`npm test` includes nine pure momentum tests alongside the hardening tests. `npm run test:integration` exercises the current migrations, baseline collection, no publication from reads, stale/superseded quote rejection, outages, collection without holdings, and the full hardening transaction suite. Use the disposable SQL setup in [operations.md](operations.md). Browser tests seed a measured interval through the real publisher before exercising the trading flows.

`node server/scripts/replayMomentum.js` prints synthetic sustained-growth, slowdown, burst and revival comparisons. These examples demonstrate the formula, not production calibration.
