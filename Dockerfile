FROM node:24-bookworm-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:24-bookworm-slim AS app
ENV NODE_ENV=production
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node backend/src/ ./src/
COPY --chown=node:node backend/scripts/ ./scripts/
COPY --from=frontend-build --chown=node:node /app/frontend/dist/ ./public/
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]