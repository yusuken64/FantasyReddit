# API v2

All routes are under `/api`. Personal responses have `Cache-Control: no-store`. Errors are `{ "error": { "code": "QUOTE_EXPIRED", "message": "..." }, "requestId": "..." }`. Codes distinguish invalid input (400), login required (401), CSRF failure (403), not found (404), conflicts/insufficient funds (409), throttling (429) and unavailable upstream data (503). Unexpected transaction failures are 500 and roll back completely.

OAuth: GET `/auth/reddit` starts a ten-minute browser-bound flow, GET `/auth/reddit/callback` consumes state before exchanging the code. GET `/me` returns `id`, `username`, `credits`, `generation`, and `csrfToken`. POST `/auth/logout` revokes the opaque session. No app JWT or Reddit user token is persisted. The production cookie is `__Host-session`, HttpOnly, Secure, SameSite=Lax, path `/`; idle lifetime is one hour and absolute lifetime is 24 hours.

Every authenticated mutation requires `Origin` equal to `PUBLIC_ORIGIN` and `X-CSRF-Token` from `/me`. Use a UUID v4 `Idempotency-Key` for order execution, exercise, reset and zero-value removal. Keep the same key and exact body when retrying after an uncertain network response. A committed repeat returns its original result, a changed input conflicts. Refresh `/me` after success. Account generation prevents requests constructed before reset from applying later.

| Method / path | Input or result |
| --- | --- |
| GET `/health/live`, `/health/ready` | Process liveness; migration and app-only Reddit access readiness |
| GET `/market` | Hot Reddit posts with persisted observations |
| GET `/market/:symbol` | Current observation, or stale persisted observation on upstream failure |
| GET `/prices/:symbol` | Latest 500 persisted price observations |
| POST `/quotes` | `{generation,symbol,action,quantity}`; `action` is BUY, SELL, SELL_REMOVE, OPTION |
| POST `/quotes` for OPTION | Also `{optionType:"CALL" or "PUT",step:90/95/100/105/110,days:1/3/7/30}`; arbitrary strikes, premium, price or expiry are rejected |
| POST `/orders` | **Only** `{quoteId}`; requires idempotency key |
| GET `/holdings` | Shares, cost basis, latest price, terminal and stale flags |
| DELETE `/holdings/:symbol` | `{generation}` plus idempotency key; only zero-share or confirmed zero-value holdings, no Reddit call |
| GET `/options` | Contracts including per-share premium, total premium, contract size 100, price freshness, OPEN/SETTLED and PENDING expiry status |
| POST `/options/:id/exercise` | `{generation}` plus idempotency key; ownership and unexpired state checked inside transaction |
| GET `/options/history` | Option ledger including BUY/EXERCISE/EXPIRE/DELIST, observation and quote references |
| GET `/transactions` | Stock and option ledger |
| GET `/portfolio` | Cash, stock holdings value, sum of both, freshness and five-minute history; open options excluded from these totals |
| POST `/account/reset` | `{generation}` plus idempotency key; atomically clear all game data, restore 10,000, increment generation and revoke other sessions |
| DELETE `/account` | `{generation}`; atomically remove account and its dependent data, including all sessions |
| GET `/metrics` | Authenticated operational counters and global aggregate stale/pending counts; no personal data from other accounts |

Symbols are lowercase Reddit base36 post IDs without a `t3_` prefix. Quantities are JSON numbers, positive safe integers bounded at 1,000,000 per request. Monetary totals cannot exceed Number.MAX_SAFE_INTEGER. Quotes expire after 30 seconds and bind the account generation, observation, quantity and complete economics. They return `cost`, `premium` per share (options), `total_premium`, `contract_size`, `strike`, `option_expiry`, `expires_at`, and `price_observed_at`. A sell-and-remove quote must still match the entire holding at execution; any intervening change conflicts. Confirmed removal invalidates all nonzero-price quotes and prevents purchases permanently.

Options accept `limit` (1–100, default 25), `offset` (0–1,000,000), `sort` (expires_at, created_at, quantity) and `dir` (ASC/DESC). Both history routes use the same paging bounds, sort by created_at/quantity/payout, and add ID as a deterministic tie-breaker. Defaults are descending except clients may request ASC expiry order.

There are no `/debug/*` endpoints or legacy root trade routes. Non-API page paths return the SPA; API paths never fall through to it. All state-changing operations use the authenticated identity, never a caller-supplied user ID.

Stocks without measured history can trade at a persisted `opening-score-age-v1` estimate derived from score and age (minimum age one minute). Market and quote responses include `pricing_model`; momentum remains null until measured. The first measured observation replaces the estimate and supersedes its outstanding quotes normally. OPTION quotes and exercise require a measured price. Quote expiry, replay, stale-data rejection, and removal behavior still apply.
