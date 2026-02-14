# Build Stage
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json .
COPY src ./src

RUN npm run build

# Production Stage
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

# Create the notes and cache directory
RUN mkdir -p agent_notes .cache && chown -R node:node agent_notes .cache

USER node

# Expose not strictly needed for stdio but good practice if http is added later
# EXPOSE 3000

CMD ["node", "dist/server.js"]
