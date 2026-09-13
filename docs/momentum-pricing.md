# Momentum pricing

Implemented on `feat/momentum-pricing` in `.worktrees/momentum-pricing`.

## Rules

`price = max(10, round(10 + weight * smoothedScoreGrowthPerMinute))`

- No post-age multiplier. Weight defaults to 5, configurable through `MOMENTUM_SCORE_WEIGHT` (finite and positive).
- The collector wakes every minute and samples each due post no more frequently than every five minutes. Scheduling and API latency normally make intervals five to six minutes.
- Growth is measured across a trailing 15-minute window. For irregular observations, interpolate the score at the start of that window. During initialization, use the available window once it spans at least five minutes.
- A new post has a baseline, not an executable 10-credit quote. Browsing registers it for collection but never advances an existing score observation.
- A gap longer than ten minutes resets the observation baseline. The last price remains available for reference, but trading waits for a new measured interval.
- Quotes expire after ten minutes. Missing, stale, or replaced quote IDs return HTTP 409 with a refresh-and-confirm message; orders never silently accept a replacement quote.
- Keep the floor and integer prices. These settings remain provisional balance choices, including the favorable downside profile of buying at the floor.

## Shared prices

`momentum_quotes` stores observations separately from price history. Collection serializes each symbol in SQL Server and atomically publishes the quote and its history row. Trades lock and validate that quote in their transaction. Reads and trades cannot create extra history samples.

The collector tracks recently browsed posts for 24 hours, positive holdings, and open options, batches Reddit requests in groups of 100, and refreshes access tokens. Collection requires at least one usable authenticated account; inaccessible or deleted posts eventually become stale. No fabricated zero-growth observation is recorded for a failed fetch.

Browsing returns `post.quote` with `id`, `price`, `momentum`, sampled `score`, `status`, `expiresAt`, and `model`. Existing numeric `post.price` remains for UI compatibility; its fallback during initialization is not executable. Stock buy, sell, and delete-with-sale requests must include `quoteId`. Option chains also return `quoteId`, required when buying an option.

Portfolio snapshots and charts use the same published history. During an outage they retain the last valuation, while post details mark the quote stale. Before the first new-model quote, existing holdings retain their legacy historical valuation.

## Options

Option expirations and premiums are derived from the published quote, so reloading within that quote does not change the offered contract. Orders validate the selected contract and premium on the server. New purchases charge `premium * contracts * 100` and store underlying share quantity (`contracts * 100`) to match settlement. Existing stored quantities and premiums are not rewritten.

Early exercise requires a fresh shared quote and validates it again at settlement. Expired options use the last published new-model price within ten minutes before expiry. If no such price exists, use the first published price after expiry; until then the option remains pending. This outage rule exposes the contract to delayed price discovery and should be explained to players before rollout. Concurrent settlement cannot pay the same option twice. An early-exercise request for an already expired option follows the expiry rule.

## Cutover

Startup adds the quote table and a `pricing_model` column to history, preserving old rows as `legacy-age-v1`. New rows are tagged `momentum-v1`; the price-history API exposes the tag. The migration is repeatable.

Deploy the server and client together because execution now requires quote IDs. Stop the old collector before starting this version; mixed old/new writers would contaminate canonical history. Existing positions wait for baseline collection and the next eligible observation before they can trade. No live database was migrated during development.

Removing decay reprices old momentum upward. At ten score points per minute, the old formula gives about 56 at one hour and 25 at 24 hours; the new model gives 60 at either age. Sustained growth followed by three five-minute periods of no growth produces new prices 60, 43, 27, 10. A revival can increase the same old post again.

Before rollout, replay representative real post histories and review existing holdings/options for valuation jumps. No real player or historical production dataset was available for calibration. Weight 5 is a baseline, not a claim of validated balance. Changing weight requires a deliberate new model version/cutover; do not run collectors with different weights against the same database.

## Validation

From `server`, run `npm ci` and `npm test` for pure pricing tests. From `client`, run `npm ci` and `npm run build`.

The optional SQL integration suite uses only a disposable local database at port 14439, with fixed test-only credentials encoded in the test. Start it with:

```powershell
docker run --name fantasy-momentum-test -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD=MomentumTestOnly_2026! -p 127.0.0.1:14439:1433 -d mcr.microsoft.com/mssql/server:2022-latest
$env:MOMENTUM_SQL_TEST='1'
npm test
```

Wait for SQL Server readiness before testing. The suite checks repeatable migration, concurrent discovery/publication, quote validation, repeated buys, stale execution rejection, option contract charges, expiry pricing, and single-payment settlement. Remove the disposable container after use: `docker rm -f fantasy-momentum-test`.

Run `node server/scripts/replayMomentum.js` from the worktree root for a synthetic balance comparison. These scenarios validate behavior; they do not establish strategy profitability or player retention.
