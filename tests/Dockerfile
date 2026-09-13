FROM node:24.21.0-bookworm-slim@sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY server/package.json server/package-lock.json ./server/
RUN npm ci --prefix server
COPY client/package.json client/package-lock.json ./client/
RUN npm ci --prefix client
COPY server ./server
COPY client ./client
COPY tests ./tests
COPY eslint.config.cjs playwright.config.cjs ./
RUN npm run lint && npm test && npm run build
CMD ["npm", "run", "test:integration"]
