FROM node:20-alpine AS builder
WORKDIR /repo

COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN npm install --workspaces --include-workspace-root

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w packages/shared && npm run build -w apps/web

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /repo/apps/web/.next/standalone ./
COPY --from=builder /repo/apps/web/.next/static apps/web/.next/static
COPY --from=builder /repo/apps/web/public apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
