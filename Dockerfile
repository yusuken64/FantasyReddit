ARG NODE_IMAGE=node:24.21.0-bookworm-slim@sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553
FROM ${NODE_IMAGE} AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/index.html client/tsconfig*.json client/vite.config.ts ./
COPY client/src ./src
COPY client/public ./public
RUN npm run build

FROM ${NODE_IMAGE} AS server-deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY --from=server-deps --chown=node:node /app/server /app/server
COPY --chown=node:node server/*.js /app/server/
COPY --chown=node:node server/migrations /app/server/migrations
COPY --from=client-build --chown=node:node /app/client/dist /app/client/dist
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:8080/api/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/server.js"]
