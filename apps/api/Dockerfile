FROM node:20-slim AS builder
WORKDIR /repo

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm install --workspaces --include-workspace-root

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api

RUN npm run build -w packages/shared \
 && npx prisma generate --schema apps/api/prisma/schema.prisma \
 && npm run build -w apps/api

FROM node:20-slim
WORKDIR /repo
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /repo/node_modules node_modules
COPY --from=builder /repo/package.json package.json
COPY --from=builder /repo/packages/shared/package.json packages/shared/package.json
COPY --from=builder /repo/packages/shared/dist packages/shared/dist
COPY --from=builder /repo/apps/api/package.json apps/api/package.json
COPY --from=builder /repo/apps/api/dist apps/api/dist
COPY --from=builder /repo/apps/api/prisma apps/api/prisma

EXPOSE 4000
CMD ["sh", "-c", "node_modules/.bin/prisma db push --skip-generate --schema apps/api/prisma/schema.prisma && node_modules/.bin/tsx apps/api/prisma/seed.ts && node apps/api/dist/src/index.js"]
