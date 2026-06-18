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

# Copy entire standalone directory (includes bundled node_modules)
COPY --from=builder /repo/apps/web/.next/standalone ./
# Static assets must sit next to .next/ inside the monorepo-relative path
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /repo/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
