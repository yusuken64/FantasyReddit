# React client

This client uses relative `/api` requests and server-owned 30-second quotes. Run `npm ci` then `npm run dev`; Vite proxies `/api` to Express on port 8080. Set the server PUBLIC_ORIGIN to the Vite origin for development. `npm run build` produces assets served by Express in the production image. See ../docs/operations.md for setup and verification.

## Frontend checks

From the repository root, run `npm run build --prefix client`, `npm run lint --prefix client`, and `npm run test:ui --prefix client`. The UI suite uses the root Playwright installation, so install the root dependencies as well as the client dependencies. If Chromium is unavailable, run `npx playwright install chromium` from the root.

The client Playwright config serves Vite on port 18189 and mocks the existing API contracts. It requires no SQL or Reddit credentials. Screenshots and traces go to ignored `client/test-results/` and `client/evidence/` directories. On Windows, the runner needs permission to clean up its test-server processes; restrictive sandboxes may hang at teardown after assertions finish. The root SQL-backed suite remains a separate integration check.

## Trade recovery

Orders and exercise operations save their exact request identity in session storage before submission. An uncertain result blocks replacement trading until the player explicitly retries that operation. Recovery survives same-tab reload and re-login for the same account/generation. It does not promise recovery across closed tabs or devices. Explicit logout clears local recovery, and an account reset or account change invalidates incompatible records. CSRF and session tokens are never stored with operations.

Price availability is refreshed manually and checked when returning to the tab. History shows persisted observations with pricing-model labels. Exercise estimates are indicative because the API does not offer a locked exercise quote.

Stocks without measured history can be bought and sold at a server-owned opening estimate based on score and age. Market cards and quote confirmations label it; options remain unavailable until measured momentum arrives. Price history is optional for purchasing.
