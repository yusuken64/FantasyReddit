# Fantasy Reddit

A React + Express game for trading Reddit-post shares and 100-share option contracts with integer game credits. SQL Server owns balances, quotes, sessions, history and durable settlement work.

The app and API ship together on one origin. Start with a newly provisioned database, run the dedicated migrations, then start the HTTP service. Runtime never creates schema. Production reset clears all positions and history and restores 10,000 credits.

See [setup, Azure deployment, tests and operations](docs/operations.md), [API contract](docs/api.md), and [hardening evidence and release blockers](audit/hardening-evidence.md). Production cutover requires the documented staging gate; it is not part of this repository change.

Quick checks: `npm ci`, `npm ci --prefix server`, `npm ci --prefix client`, `npm run lint`, `npm run build`, `npm test`. SQL and browser checks require the disposable database described in the operations guide.
