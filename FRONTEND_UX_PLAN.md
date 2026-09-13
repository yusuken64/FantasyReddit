# Frontend player experience implementation plan

Status: Implemented and frontend-validated; SQL-backed integration and player comprehension remain unverified.
Updated: 2026-09-13

## Objective and boundaries

Help players understand prices and options, trade confidently, and recover from interrupted requests. Retain the current visual style and existing authentication flow.

Implementation changes stay within `client/`; this plan may also be updated. Do not change server, database, pricing, authentication policy, or API contracts. Progression systems, challenges, leaderboards, market-wide search, and redesign are deferred.

## Verified baseline

The audit was source-based, not a live playtest. Recheck repository instructions and the working tree before implementation. Current components exist; the earlier missing-component warning is historical. Preserve unrelated staged `.env` and conflicted `.gitignore` changes.

Already present; verify rather than rebuild:

- Portfolio and Account navigation, with reset/delete confirmations on Account.
- Homepage entry through the existing login flow.
- Separate Sell shares, Sell and remove, and Remove zero-value holding actions.
- Positive-integer validation, quote confirmation, inline errors, and component-local submission guards.
- Server observation timestamps and collecting/stale labels on market cards.
- Options/history pagination and disclosure that portfolio totals exclude open option value.

Gaps include component-local order identity, missing receipts, one-time market loading, missing market ownership, incomplete loading/error states, no pre-purchase history, and immediate exercise without confirmation.

Read `server/trading.js`, `server/pricing.js`, `server/momentum.js`, `server/domain.js`, and route implementations to verify contracts. Use `docs/api.md` and `docs/momentum-pricing.md` for context. Do not invent missing response fields.

## Delivery sequence

Implement phases 0–5 in order, adding focused tests alongside behavior changes. Phase 1 supplies shared recovery and read-state behavior for phases 2–3. Keep each phase reviewable and record results below.

## Phase 0 — Baseline and test harness

Files: `client/package.json`, a new client Playwright config, and `client/tests/`.

- [x] Record `npm run build --prefix client` and `npm run lint --prefix client` baseline results.
- [x] Add a client-local Playwright command/config using the repository's existing Playwright installation. Serve Vite on a dedicated local port and mock existing `/api/**` contracts; no SQL or Reddit dependency.
- [x] Keep configuration compatible with client TypeScript and add appropriate lint coverage for new test/config files.
- [x] Create account, market, holdings, quotes, orders, options, and history fixtures. Smoke-test the login gate and market route.
- [x] Capture current desktop/mobile presentation as baseline evidence.

Acceptance: The browser harness runs independently of SQL and build/lint baselines are recorded. Do not resolve unrelated repository conflicts to make checks clean.

## Phase 1 — Shared request recovery and read states

Files: `client/src/api.ts`, `context/AuthContext.tsx`, `context/auth.ts`, `App.tsx`, and small new state/hooks modules.

- [x] Preserve API error codes/status. Treat fetch failures, interrupted responses, and unreadable mutation responses as potentially uncertain outcomes.
- [x] Add an app-level pending-operation store for orders and exercise. Before sending, save account ID, generation, operation kind, exact path/body, idempotency key, and minimal confirmation summary to session storage. Never store session or CSRF tokens.
- [x] If storage fails, prevent submission with a recoverable error instead of promising reload-safe recovery.
- [x] Model preparing, quoted/confirming, submitting, outcome unknown, confirmed success, and definitive rejection explicitly. Keep post-success refresh failures separate from mutation failure.
- [x] Restore unresolved operations after navigation, reload, and same-tab re-login for the same account/generation. Offer Retry same operation using the exact saved body/key; never retry mutations automatically on mount.
- [x] Block replacement orders/new quotes while an earlier result is unknown. Closing the panel or selecting another post must not erase submitted operation state.
- [x] If the quote expires after an ambiguous result, replay the original order first: the server can return its committed result after expiry. Only definitive rejection permits replacement economics and a new key.
- [x] Validate restored records and isolate accounts. Never display/replay another account's operation. Generation changes invalidate old operations and require fresh account data. Explicit logout clears local personal state. Recovery covers the same tab, not closed tabs or other devices.
- [x] Centralize authenticated 401 handling: clear authenticated presentation, retain only eligible unresolved recovery state, offer re-login, and obtain fresh CSRF through `/me` before resuming. Transient read failures must not log the player out.
- [x] Standardize initial loading, loaded, refreshing, error without data, and refresh error with retained data. Keep retained data associated with its original query/page.
- [x] Ignore obsolete responses after account/query changes. Invalidate affected reads after mutations; clear personal caches on logout/reset/account change.

Acceptance: Lost responses followed by navigation, reload, or same-account re-login preserve request identity. Repeated confirmation sends one in-flight request. Successful mutations remain successful when subsequent reads fail.

## Phase 2 — Trade confirmation, receipts, and exercise

Files: `components/Trade.tsx`, `Market.tsx`, `Holdings.tsx`, `Options.tsx`, and formatting helpers.

- [x] Keep the existing inline trade panel. Pass title with symbol fallback; focus its heading on opening and return focus to its trigger on closing.
- [x] Show action, title/symbol, quantity, quoted unit price, total cost/proceeds, available virtual credits, and quote expiry. Options also show CALL/PUT, strike, per-share premium, contract size/count, and actual option expiry.
- [x] Validate whole quantities from 1 to 1,000,000, safe monetary arithmetic, affordability against quoted cost, and sales against known ownership. Preserve input on failure; server validation remains authoritative.
- [x] Use phase 1 recovery. Give actionable messages for expired/changed quotes, changed account/holding, insufficient funds/shares, holding limit, and delisting. Requotes require fresh confirmation; never silently reprice.
- [x] Build receipts from confirmed responses and saved quote summaries. Show cost/proceeds without inventing realized profit. Retry refresh must never resubmit a successful trade.
- [x] Refresh account and affected ownership/options/history/portfolio data after success. Failed ownership refresh means unknown/stale ownership, not zero.
- [x] Preserve distinct sale/removal semantics: sell-and-remove closes the entire holding and frees its slot; zero-value removal is not a paid sale. Preserve account confirmations.
- [x] Add exercise confirmation explaining that it ends the contract and can pay zero. Show estimated payout and profit after premium from a current observation when available; clearly label stale/unavailable estimates.
- [x] Do not promise a locked exercise payout: the API has no exercise quote. Show the actual returned payout in the receipt and use exact-body/key recovery even if an ambiguous exercise is retried after expiry.

Acceptance: Buy, partial sell, sell-and-remove, option purchase, and exercise have clear confirmation, pending, uncertainty, rejection, and receipt states. Reopening an unresolved operation cannot create a replacement trade.

## Phase 3 — Market, holdings, and history recovery

Files: `components/Market.tsx`, `Holdings.tsx`, `Options.tsx`, `History.tsx`, `Portfolio.tsx`, and a small price-history component.

- [x] Add visible manual Refresh for the market listing or searched symbol, including successful collecting/stale responses. Defer polling to avoid unnecessary upstream requests.
- [x] Preserve server readiness flags. Permit purchase only with a fresh ready nonterminal observation; a displayed historical price is only a reference.
- [x] Age ready observations against the current server freshness rule while the page remains open and recheck on tab return. Refresh to discover readiness; elapsed five minutes alone does not prove collection succeeded.
- [x] Load market ownership from `/holdings`, keeping market and ownership errors separate.
- [x] Apply distinct initial loading, empty, error, and retained-data refresh warning states across all five pages. Separate fetch failure from stale market observations and use server observation timestamps.
- [x] Keep paging/history controls visible on empty/error pages. Reset offset when changing filters/order, ignore racing responses, and retain Previous on empty later pages.
- [x] Keep current post-ID lookup and history/options paging. Do not add unsupported market-wide filters/pagination; explicitly label any future page-local filtering.
- [x] Load `/prices/:symbol` on demand. Sort real observations chronologically and handle loading, retry, empty, and one-point history honestly. Label the latest-500-observation limit.
- [x] Check history pricing-model tags and distinguish legacy/momentum transitions instead of drawing a misleading uninterrupted comparable trend.
- [x] Preserve portfolio cash-plus-stocks meaning and its options exclusion; add an insufficient-history state to that chart too.

Acceptance: Collecting -> ready and ready -> stale recover without page reload. Failed reads never look like lost holdings or another filter's results. Charts do not fabricate data.

## Phase 4 — Feature explanations and mobile polish

Files: `App.tsx`, relevant components, optional shared explanation components, and `index.css`.

- [x] Format integer currency consistently as virtual credits.
- [x] Add a short How prices work explanation above the market with an expandable worked example. Explain Reddit score growth over the measured trailing window, not raw upvotes, comments, or shares.
- [x] Illustrative weight-5 example: growth of 10 points/minute gives 60 credits; slowing to 4 gives 30 even while total score rises. Explain the normal 10-credit floor and removed-post zero exception. Label the assumption because server weight is configurable and not exposed in the API.
- [x] Explain the initial measured interval of at least five minutes, renewed collection after long sampling gaps, and why stale prices cannot be traded. Refresh retrieves observations; it does not accelerate collection.
- [x] Stock example: buy 3 shares at 30 for 90 credits, sell at 40 for 120 proceeds and 30 profit. Distinguish proceeds from profit.
- [x] Explain calls, puts, cash settlement, upfront premium, and 100 shares per contract. Hypothetical call: strike 50, premium 5, one contract costs 500; settlement at 60 pays 1,000, profit 500, break-even 55. A hypothetical put with those terms breaks even at 45. These are examples, not offered quotes.
- [x] Derive actual explanations from returned terms: call payout is `max(price - strike, 0) * 100 * contracts`; put payout is `max(strike - price, 0) * 100 * contracts`. Profit subtracts total premium; maximum buyer loss is that premium. Do not promise attainable put break-even when premium exceeds strike.
- [x] Explain that exercise ends a contract, automatic expiry settlement uses the first valid observation at or after expiry, and unavailable observations can delay settlement. Display the actual expiry timestamp; selected days do not necessarily start at purchase time.
- [x] Explain confirmed removal: shares become worth zero, new purchases stop, calls pay zero, and puts settle using zero as the underlying price. Unavailable posts are not necessarily removed.
- [x] Rename the homepage action Start trading and add Browse stocks to genuinely empty holdings through existing routes. Verify Portfolio/Account navigation and account confirmations.
- [x] Keep basic explanations visible, examples expandable with native accessible controls, and exercise consequences beside confirmation.
- [x] Verify 320px/375px widths and desktop: wrapping navigation, panel, fields, receipts, and history. Provide visible focus, associated labels, announced statuses/errors, and text beyond Buy/Sell colors. Horizontal scrolling belongs within the history table, not across the page.

Acceptance: A new player can distinguish price from score, proceeds from profit, and per-share premium from total contract cost, and explain exercise/expiry/removal. Browse -> buy -> holdings -> sell works by keyboard and on narrow screens.

## Phase 5 — Validation and delivery

- [x] Run frontend build/lint and the client browser suite; record commands and results.
- [x] Cover invalid/fractional/oversized quantities, insufficient funds/shares, repeated confirmation, changed/expired quotes, delisting, and generation changes.
- [x] Simulate server commit followed by dropped response. Verify navigation/reload/re-login retries use the same exact body/key and return one logical result. Also cover no commit, unreadable responses, and storage failure.
- [x] Cover success followed by failed account/holdings refresh and read-only recovery, including option purchase/exercise.
- [x] Cover collecting -> ready, ready -> stale, unavailable ownership, initial/refresh errors, sparse charts/model transitions, empty later pages, and racing search/filter responses.
- [x] Check first login, expandable explanations, desktop/mobile layouts, keyboard focus, and accessible feedback. If no player walkthrough is available, record comprehension as unverified.
- [x] Inspect the existing root SQL-backed browser suite for copy/confirmation selector drift. Run it unchanged when its disposable database is available. Record infrastructure blockers or selector drift honestly; updating root tests exceeds client-only scope and is a follow-up.
- [x] Review the diff for client-only scope plus this plan; preserve unrelated work. Record evidence and API limitations.

Completion requires frontend build/lint and focused browser checks to pass, with independently demonstrated baseline blockers separated from this work. Mocked frontend checks do not substitute for SQL-backed integration evidence.

## Handoff log

- 2026-09-13: Expanded the UX checklist into a phased implementation plan after source audit. Added explicit feature explanations, same-tab operation recovery, market readiness refresh, exercise confirmation, and client-local tests. No application implementation, build, or browser validation performed during planning.
- 2026-09-13 implementation: Completed phases 0–5 in `client/`. Added session-storage recovery for orders/exercise; receipts separated from refresh errors; typed API guidance and centralized session recovery; shared read states with obsolete-response cancellation; ownership, manual market refresh/freshness, on-demand observation history; exercise confirmation/estimates; worked feature explanations; mobile/keyboard polish.
- Baseline build/lint passed before implementation. Baseline screenshots are in `client/evidence/baseline/`.
- Final `npm run build --prefix client` and `npm run lint --prefix client` passed. `git diff --check -- client` passed.
- `npm run test:ui --prefix client`: 36 tests passed in 28.4 seconds. After the final exercise-panel/reply-validation fix, `npx playwright test --grep=exercise` from `client/`: 3 tests passed, including one newly added case. The suite now contains 37 tests. Coverage includes uncertain committed/uncommitted/unreadable responses, exact-key replay through reload/navigation/re-login, duplicate clicks, storage failure/corruption, quote rejection/TTL, account isolation, exercise expiry/zero payout, stale/collecting prices, racing search results, pagination, and failed read recovery.
- Windows sandbox runs completed assertions but hung during test-server teardown. Running with process-cleanup permission completed normally. An attempted npm argument-filter command selected no tests; the direct Playwright filtered command above was used successfully.
- Layout checks passed at 320px, 375px, and 1280px; the 320px screenshot was visually inspected. Final flow screenshots: `client/evidence/holdings-trade-320.png`, `holdings-trade-375.png`, and `holdings-trade-1280.png`. Screenshots and test traces are intentionally ignored.
- SQL-backed integration was not run: `TEST_SQL_CONNECTION` is absent. The root browser suite still asserts old currency/option copy and immediate exercise; updating those selectors/confirmation steps is an explicit follow-up outside this client-only scope. No SQL-backed success is claimed.
- Feature explanations were reviewed against server source and covered by UI checks. No real-player walkthrough was available; comprehension remains unverified.
- Limits retained: same-tab recovery only; manual market refresh rather than polling; exercise payout is estimated until execution; configurable pricing weight is labeled as an illustrative assumption; history displays up to 500 real observations in a labeled table. No new backend APIs or market-wide filters were introduced.
- Scope review: application changes are confined to `client/`, plus this plan. Unrelated staged `.env` and conflicted root `.gitignore` work were preserved.
- Next follow-up: configure the disposable SQL test environment and update/run the root integration browser selectors under a separately expanded scope; conduct a new-player comprehension walkthrough.
