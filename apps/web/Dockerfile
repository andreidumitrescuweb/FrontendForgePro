FROM node:20-slim AS builder
WORKDIR /repo

COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/

RUN npm install --workspaces --include-workspace-root

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web

RUN npm run build -w packages/shared \
 && npm run build -w apps/web

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copy the standalone output (self-contained server)
COPY --from=builder /repo/apps/web/.next/standalone/apps/web ./
# Copy static assets where standalone server expects them
COPY --from=builder /repo/apps/web/.next/static .next/static
COPY --from=builder /repo/apps/web/public public

EXPOSE 3000
CMD ["node", "server.js"]
