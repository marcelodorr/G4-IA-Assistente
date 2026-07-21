FROM node:22-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
RUN npm ci -w apps/web --include-workspace-root

FROM deps AS build
COPY apps/web apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w apps/web

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
COPY --from=build /repo/apps/web/drizzle ./drizzle
COPY apps/web/scripts/start.mjs ./start.mjs
# Next's standalone tracer only copies node_modules files it can reach from
# Next's own entry points (route handlers, server.js). start.mjs imports
# drizzle-orm/postgres-js/migrator directly (outside Next's bundler) to run
# migrations before boot, so the traced drizzle-orm dir is missing that
# submodule. Both packages declare zero runtime deps, so overlaying the full
# packages from the build stage's node_modules is sufficient.
COPY --from=build /repo/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=build /repo/node_modules/postgres ./node_modules/postgres
EXPOSE 3000
CMD ["node", "start.mjs"]
