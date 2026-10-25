FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.base.json ./
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared
RUN npm run build:web

FROM nginx:stable-alpine3.24-slim
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/web /usr/share/nginx/html
EXPOSE 8080
