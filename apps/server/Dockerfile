FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.base.json ./
COPY apps/server ./apps/server
COPY packages/shared ./packages/shared
RUN npm run build:server

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist/server ./dist/server
COPY drizzle ./drizzle
USER node
EXPOSE 3000
CMD ["sh", "-c", "node dist/server/apps/server/src/db/migrate.js && node dist/server/apps/server/src/index.js"]
