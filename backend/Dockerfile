# Multi-stage production image: dev deps + build, prune to production node_modules, minimal runtime.
# Target: ECS Fargate (linux/amd64). Entrypoint runs the Express app: full REST + health + /metrics on API_PORT (see API_ENDPOINTS.md).
FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM deps AS build
COPY tsconfig.json tsconfig.build.json prisma.config.ts ./
COPY src ./src
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"
RUN npx prisma generate --schema ./src/database/schema.prisma \
  && npm run build

# Drop devDependencies; rebuild bcrypt (native) because deps stage uses npm ci --ignore-scripts (skips install hooks).
FROM build AS prod-deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && npm prune --omit=dev \
  && npm rebuild bcrypt --build-from-source \
  && apt-get purge -y python3 make g++ \
  && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

FROM base AS runner
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs express
ENV NODE_ENV=production
COPY --from=prod-deps --chown=express:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=express:nodejs /app/dist ./dist
COPY --from=build --chown=express:nodejs /app/package.json ./
# @prisma/client loads node_modules/.prisma/client/default; point it at compiled generated client.
USER root
RUN mkdir -p node_modules/.prisma/client \
  && printf '%s\n' "module.exports = require('../../../dist/generated/prisma/client');" > node_modules/.prisma/client/default.js \
  && chown -R express:nodejs node_modules/.prisma
USER express
EXPOSE 4000
CMD ["node", "-r", "reflect-metadata", "dist/server.js"]
