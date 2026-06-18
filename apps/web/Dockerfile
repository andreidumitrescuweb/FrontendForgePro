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
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=builder /repo/node_modules node_modules
COPY --from=builder /repo/package.json package.json
COPY --from=builder /repo/packages/shared/package.json packages/shared/package.json
COPY --from=builder /repo/packages/shared/dist packages/shared/dist
COPY --from=builder /repo/apps/web/package.json apps/web/package.json
COPY --from=builder /repo/apps/web/.next apps/web/.next
COPY --from=builder /repo/apps/web/public apps/web/public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "apps/web/.next/standalone/apps/web/server.js"]
