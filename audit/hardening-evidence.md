# Production hardening evidence

Implementation date: 2026-09-13. **Local implementation verification passes; public deployment remains blocked on the staging release gate.** This document supersedes the original code findings, not the historical audit. No production data, credentials, Azure deployment or public traffic was changed.

The backend has been replaced with an independently constructible Express app, SQL migration command, revocable sessions, one pricing service, server-owned quotes, account-locked transactions and durable workers. The React client uses the new contract exclusively. Legacy debug, JWT, client-price trading and timer settlement modules were removed. Existing data is deliberately unsupported: provision a fresh database.

## Finding-by-finding evidence

| Audit finding | Correction | Verification / remaining release evidence |
| --- | --- | --- |
| 1 Negative purchases | Strict positive integer quantities; BigInt totals; SQL nonnegative/safe-range constraints | Unit invalid-input cases; SQL invalid-order, overflow and rollback scenarios |
| 2 Client-defined option economics | Server quotes resolve strike, premium and 1/3/7/30-day expiry; execution accepts quote ID only | Extra-economics rejection; 100-share cost assertions; Chromium purchase flow |
| 3 Cross-user exercise | Ownership checked before market access and again under account lock | SQL cross-user order and exercise rejection |
| 4 Duplicate settlement | Account-first lock, conditional OPEN claim, unique settlement key, ledger and payout in one transaction | Concurrent exercises and expiry calls; pinned observation retry; rollback tests |
| 5 Overspend/oversell | Serialized account mutations, conditional debit/share updates, transactional 20-symbol check | Concurrent buys, sells, sell-and-remove and holding-limit scenarios |
| 6 Incomplete reset | Supported reset clears stocks/options/settlements/history/snapshots/quotes, restores 10,000 and advances generation | SQL full reset/replay/session tests; reset versus execution/expiry; Chromium reset |
| 7 OAuth state | Hashed state/browser binding; ten-minute expiry; atomic consume before code exchange | Missing/mismatched/expired/reused-state SQL/HTTP tests; controlled browser OAuth flow. Real Reddit callback remains a staging gate |
| 8 Logout | POST `/api/auth/logout`, revoke SQL session and clear matching cookie; UI changes only on success | Old cookie returns 401; browser logout and reload |
| 9 Renewal | Consistent first-party Lax cookie; production Secure/HttpOnly/__Host attributes; idle/absolute server limits | Local HTTP renewal/idle expiry tests. Actual HTTPS/Azure proxy/browser behavior remains a staging gate |
| 10 Secrets | No raw driver/upstream errors, tokens or connection strings in application logs; startup config checks; ignore files; explicit Docker copies | Source review; production image build. Historical log exposure and any necessary rotation remain operator checks |
| 11 Upstream data loss | Explicit removal only; stale fallback for reads; failed quotes/exercise abort; expiry waits for first valid persisted observation | Unit 401/429/timeout/ambiguous-data cases; SQL outage preservation, zero-price CALL/PUT payouts, expiry and pinned-observation tests |
| 12 Dependencies | Removed unused auth/network/UI packages and root archiver; patched retained dependencies and transitive packages | Root, server and client npm audit each report **0 advisories**, including build tooling; all lockfiles updated |
| 13 Long timers | Independent 15-second leased price/settlement/snapshot/maintenance loops; no per-option expiry timers | 30-day contracts, restart and multiple-worker SQL tests; price and snapshot work cannot block settlement polling |
| 14 SQL limits | At most 100 Reddit IDs; 500-user keyset scans; small per-user transactions; bounded retention batches; idempotent buckets | 5,001-account snapshots across two workers and restart; no oversized parameter list or duplicate bucket |
| 15 Token/age pricing | Shared app-only token renewal, timeout/backoff and persisted observations preserve created_utc | Token sharing/batch and price-age unit tests. Actual Reddit app-only permissions and network access remain staging gates |
| 16 Removal transaction | Sell-and-remove quote executes sale and removal in the same transaction; zero-value removal makes no upstream request | SQL concurrent-sale and network-free zero-value removal; browser sale/removal |
| 17 Public personal cache | All `/api` responses no-store | HTTP header test; proxy cache configuration still needs staging confirmation |
| 18 Option contract/history | Premium and payout ×100×contracts; BUY and settlement ledger records; literal history route; bounded deterministic sorting/paging | SQL premium/payout tests; browser BUY/EXERCISE history; options API exercised against SQL |
| 19 Deployment/verification | One non-root, pinned Node 24 multi-stage image; SPA/API separation; migrations/readiness/shutdown; CI; Azure private-SQL Bicep; operational runbook | Clean container build, lint/unit/integration/browser checks and Bicep compilation. Azure what-if, live configuration, alerts and restore verification remain release blockers |

## Local verification

- Clean installs and production build use Node **24.21.0**, pinned by image digest. The host's Node 22 was used for initial debugging; the verification container repeats install/lint/unit/build on the supported runtime.
- `npm run lint`: passes with no errors or hook warnings. No blanket rule suppression added.
- `npm test`: **8 passing unit/HTTP tests**.
- SQL Server integration suite: **17 passing tests on Node 24.21.0**, including disposable, randomly named databases; negative/fractional/malformed orders, concurrency, ownership, replay, reset/delete, pinned settlement and >5,000 users. The final container run completed in about 37 seconds. See `server/test/integration.test.js` for executable scenarios.
- `npm run test:browser`: **2 passing Chromium tests**, covering login, deep links, quote preview/expiry, stock purchase/sale, option purchase/exercise/history, reset, logout and deletion. The expiry test waits for the actual 30-second server TTL.
- `npm run audit:all`: **0 root, 0 server, 0 client vulnerabilities** at verification time.
- `docker build -t fantasy-reddit:hardening .`: passes; root Dockerfile builds and serves the compiled SPA with the API.
- Production image inspection: Node 24.21.0, UID 1000, compiled SPA present, no environment files or test harness. `docker build -f tests/Dockerfile -t fantasy-reddit:verification .` repeats all three clean installs, lint, eight unit/HTTP tests and build on Node 24.
- `az bicep build --file deploy/main.bicep`: passes locally; compilation is not an Azure deployment or what-if.
- `audit/probes.cjs` now runs corrected-behavior unit/HTTP probes; the original five vulnerable-behavior assertions no longer describe the active backend.

Tests use an isolated SQL Server container (pinned image) and controlled Reddit responses. The initial Microsoft registry pull failed; a cached SQL Server image was resolved to its immutable digest and used in the test Compose file. No existing application container/database was reused.

## Unresolved release blockers

The following require the intended deployment environment, credentials and operator evidence: remote CI run; Azure what-if and resource deployment; private SQL and runtime least-privilege verification; Reddit approval/application-only access and real OAuth on the final HTTPS origin; proxy trust/caching/TLS checks; worker recovery and lag under expected production traffic; delivered operational alerts; and a timed backup restore with database integrity and settlement replay checks. Historical credential exposure must be reviewed. See [operations and rollout procedure](../docs/operations.md).

These are release gates, not claims of completed production validation. No production cutover is authorized or performed by this change.
