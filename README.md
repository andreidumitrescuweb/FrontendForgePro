# FrontendForge Pro

AI-powered frontend builder SaaS for agencies and freelancers. Describe a site → an AI planner
designs it → Claude generates accessible Tailwind code → a reviewer model audits WCAG 2.1 AA /
Core Web Vitals / SEO → it regenerates until it passes → deploy to Vercel/Netlify/GitHub Pages
with one click. Real-time collaboration, immutable version history with branching, Stripe
billing, template marketplace, built-in analytics, full admin panel.

## Architecture

```
frontendforge-pro/
├── apps/
│   ├── api/          Express + TypeScript + Prisma (PostgreSQL) + BullMQ + socket.io + Yjs
│   │   └── src/worker.ts   ← generation worker (separate process, same package)
│   └── web/          Next.js 14 (App Router) + Tailwind + Monaco + Yjs client
├── packages/
│   └── shared/       Types, Zod schemas, plan definitions shared by api & web
├── docker-compose.yml   Postgres 16, Redis 7, MinIO, api, worker, web
└── .env.example
```

| Concern        | Choice |
| -------------- | ------ |
| Auth           | Email/parolă (bcrypt 12 rounds), JWT access (15 min) + rotating refresh tokens (httpOnly cookie, reuse detection), TOTP 2FA, OAuth2 Google/GitHub/LinkedIn |
| Multi-tenancy  | Single DB, logical isolation by `workspaceId`, role guard middleware (OWNER/ADMIN/EDITOR/VIEWER) |
| AI engine      | Anthropic (primary) cu fallback OpenAI; reviewer Haiku; DALL·E 3 imagini → sharp → MinIO/S3 |
| Generation     | BullMQ queue + worker proces separat; pipeline: plan → generate → validate → review → regenerate (max 3) → SEO pass |
| Realtime       | Yjs CRDT pe WebSocket (`/collab/:projectId`) + socket.io pentru chat & presence |
| Versioning     | Snapshot-uri imutabile gzip, branch / merge / restore |
| Billing        | Stripe Checkout (abonamente Pro/Agency + pachete credite one-time), webhooks, customer portal |
| Security       | helmet + CSP, CORS restrictiv, rate limiting Redis (global + per-endpoint), CSRF header pe refresh, AES-256-GCM pentru secrete în DB, audit log |
| Observability  | Winston JSON logs, Sentry (opțional), `/healthz` + `/readyz`, graceful shutdown |

## Quick start (Docker — recommended)

```bash
cp .env.example .env
# minimal pentru un demo funcțional:
#   ANTHROPIC_API_KEY  (sau OPENAI_API_KEY)
#   JWT_ACCESS_SECRET / JWT_REFRESH_SECRET  (orice string ≥16 chars)
#   SECRETS_ENCRYPTION_KEY:
#     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

docker-compose up --build
```

- Web: http://localhost:3000
- API: http://localhost:4000 (`/healthz`, `/readyz`)
- MinIO console: http://localhost:9001 (forge / forge-secret)

Migrațiile și seed-ul planurilor rulează automat la pornirea containerului `api`.

## Local development (fără Docker pentru aplicații)

```bash
# 1. Pornește doar infrastructura
docker-compose up -d postgres redis minio minio-init

# 2. Instalează și pregătește
npm install
npm run build -w packages/shared
npm run db:migrate          # prisma migrate dev (creează schema)
npm run db:seed             # seed planuri Free/Pro/Agency/Enterprise

# 3. Rulează tot (api + web + worker, concurrently)
npm run dev
```

## Environment variables

Toate sunt documentate în [.env.example](.env.example). Cele critice:

| Variable | How to get it |
| -------- | ------------- |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com → API Keys. Modelul primar e configurabil prin `AI_PRIMARY_MODEL`. |
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys — folosit ca fallback text + DALL·E 3 pentru imagini. |
| `STRIPE_SECRET_KEY` | https://dashboard.stripe.com/test/apikeys |
| `STRIPE_WEBHOOK_SECRET` | vezi secțiunea Stripe de mai jos |
| `STRIPE_PRICE_PRO_MONTHLY` / `STRIPE_PRICE_AGENCY_MONTHLY` | Stripe → Products → creează produse recurente lunare ($29 / $99) și copiază price id-urile (`price_…`) |
| `GOOGLE_CLIENT_ID/SECRET` | https://console.cloud.google.com → OAuth consent + credentials. Redirect URI: `http://localhost:4000/api/v1/oauth/google/callback` |
| `GITHUB_CLIENT_ID/SECRET` | https://github.com/settings/developers → New OAuth App. Callback: `http://localhost:4000/api/v1/oauth/github/callback` |
| `LINKEDIN_CLIENT_ID/SECRET` | https://developer.linkedin.com → app cu scope `openid profile email`. Callback analog. |
| `VERCEL_TOKEN` | https://vercel.com/account/tokens — deploy direct cu fișiere inline. |
| `NETLIFY_TOKEN` | https://app.netlify.com/user/applications → Personal access token. |
| `GITHUB_APP_TOKEN` | PAT cu scope `repo` — folosit pentru GitHub Pages deploy (creează repo privat + push). |
| `CLOUDFLARE_API_TOKEN` | https://dash.cloudflare.com/profile/api-tokens — integrarea Pages e schelet (vezi Limitations). |
| `SECRETS_ENCRYPTION_KEY` | 32 bytes hex — criptează TOTP seeds și API keys stocate. Generare: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

## Stripe webhooks (local)

```bash
stripe login
stripe listen --forward-to localhost:4000/api/v1/billing/webhook
# copiază "whsec_..." afișat în STRIPE_WEBHOOK_SECRET, apoi repornește api-ul
```

Evenimente gestionate: `checkout.session.completed` (credite + marketplace),
`customer.subscription.created/updated/deleted`, `invoice.paid`.

## Testing

```bash
npm test                      # Jest unit tests (crypto, validators) — fără servicii externe
npm run test:e2e -w apps/web  # Playwright smoke tests (pagini publice)
E2E_FULL=1 npm run test:e2e -w apps/web   # fluxul complet signup→generate (cere stack-ul pornit)
```

## Promovarea unui admin

```bash
docker-compose exec postgres psql -U forge -d frontendforge \
  -c "UPDATE \"User\" SET role='SUPERADMIN' WHERE email='you@example.com';"
```

## API surface (v1)

```
POST /api/v1/auth/register|login|refresh|logout      GET /auth/me
POST /api/v1/auth/2fa/setup|confirm
GET  /api/v1/oauth/:provider/start|callback           (google|github|linkedin)
GET|POST /api/v1/workspaces                           POST /:id/members
POST /api/v1/projects                                 GET /workspace/:id, GET|DELETE /:id
POST /api/v1/projects/:id/generate                    GET /:id/jobs/:jobId
POST /api/v1/projects/:id/ai-edit
GET|POST /api/v1/projects/:id/versions                POST /:vid/restore|branch|merge
GET  /api/v1/projects/:id/export                      (ZIP)
POST /api/v1/projects/:id/deploy                      GET /:id/deployments/:depId
GET  /api/v1/billing/plans                            POST /checkout/subscription|credits, /portal
POST /api/v1/billing/webhook                          (Stripe, raw body)
GET  /api/v1/marketplace/listings[...]                POST /listings, /:id/purchase|clone|reviews
GET  /api/v1/analytics/script.js                      POST /ingest, GET /projects/:id/stats
GET  /api/v1/chat/projects/:id/messages               (live: socket.io `join`, `chat:send`)
WS   /collab/:projectId?token=…                       (Yjs sync + awareness)
/api/v1/admin/*                                       metrics, users, subscriptions, audit-logs,
                                                      listings/pending + moderate, config
```

## Known limitations (honest list)

- **Cloudflare Pages deploy** este un schelet explicit (`deploy.service.ts`) — necesită
  `CLOUDFLARE_ACCOUNT_ID` + fluxul Direct Upload.
- **Custom DNS via Cloudflare**, heatmaps/session-recording (PostHog/Matomo) și SSO Enterprise
  nu sunt implementate în această versiune.
- **Lighthouse real** rulează doar euristic server-side (validator static + reviewer AI);
  un run Lighthouse headless per generare e un upgrade natural în worker.
- Persistența documentelor Yjs e in-memory per room (sursa de adevăr rămân versiunile);
  pentru scaling orizontal pe mai multe noduri API e nevoie de y-redis sau sticky sessions.
- Facturile PDF Stripe se trimit prin configurarea Stripe Dashboard (Invoicing), nu din cod.
```
