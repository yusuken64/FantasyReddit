# React client

This client uses relative `/api` requests and server-owned 30-second quotes. Run `npm ci` then `npm run dev`; Vite proxies `/api` to Express on port 8080. Set the server PUBLIC_ORIGIN to the Vite origin for development. `npm run build` produces assets served by Express in the production image. See ../docs/operations.md for setup and verification.
