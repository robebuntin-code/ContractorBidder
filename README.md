# DOJOBID

A cross-platform marketplace (iOS / Android / Web) connecting **homeowners** and
**contractors** for job requests, bidding, privacy-preserving location reveal, radius-based
notifications, and contractor discovery.

This repository is a **monorepo** containing the API, web app, mobile app, shared packages,
and infrastructure-as-code. It currently ships a **runnable vertical slice** (auth + jobs)
with the full data model designed in and scaffolds for everything else.

---

## Monorepo layout

```
/apps
  /api       NestJS + Prisma backend (REST, /api/v1)
  /web       Next.js web client
  /mobile    React Native (Expo) client
/packages
  /types     Shared TypeScript types (API DTOs / entities)
  /config    Shared TS / ESLint / Prettier config
  /ui        Shared cross-platform UI primitives (react-native-web)
/infra       Terraform skeleton (AWS)
docker-compose.yml   Postgres (PostGIS) + Redis for local dev
```

## What works today

- **Auth**: register / login / refresh / `/me` with JWT access + refresh tokens, Argon2id
  password hashing, RBAC roles (`HOMEOWNER`, `CONTRACTOR`, `ADMIN`).
- **Jobs**: create a job (geocoded lat/lng + coarse-rounded location) and search/list jobs
  by work type + radius. Non-owners receive **coarse location only** — precise address and
  coordinates are stripped by the serializer until a bid is accepted.
- **Bids** (M2): contractors place one bid per job (`POST /jobs/:id/bids`), owners list bids
  with a contractor profile preview (`GET /jobs/:id/bids`), withdraw (`PATCH /bids/:id`), and
  **accept** (`POST /bids/:id/accept`).
- **Accept & reveal** (M2): acceptance runs in a DB transaction — marks the bid `ACCEPTED`,
  awards the job, auto-declines other pending bids, writes an audit log, and notifies the
  winner. Precise location is then revealed to the accepted contractor (immediately when
  payments are off; gated on payment success when on).
- **Messaging** (M2): job-scoped direct threads (`POST`/`GET /jobs/:id/messages`) restricted
  to the owner and contractors who have bid; recipients get a `MESSAGE` notification.
- **Notifications** (M2): in-app records with `GET /notifications` + `POST /notifications/mark-read`.
- **JOB_MATCH fan-out** (M1): on job creation, contractors whose `service_types` include the
  work type and whose base location is within their `service_radius_km` of the job's **coarse**
  point are notified (`MatchingService`).
- **Contractor profiles** (M1): `POST`/`PATCH /contractors/profile` (upsert, contractor-only)
  and public `GET /contractors/:userId/profile` (trims license/insurance fields).
- **Media** (M1): `POST /media/sign-upload` issues short-lived signed S3 PUT URLs (image MIME
  allow-list, filename hygiene); falls back to a dev placeholder when `MEDIA_S3_BUCKET` is unset.
- **Payments** (feature-flagged, M3): acceptance-fee rows on accept; **real Stripe** PaymentIntent
  via `POST /payments/session` and a signature-verified `POST /payments/webhook/stripe` that marks
  fees `SUCCEEDED`/`FAILED` and reveals the location once both fees succeed.
- **Admin** (M3): `GET /admin/jobs`, `GET /admin/users`, `POST /admin/flags/{ban,unban}-user`
  (ADMIN-only, audit-logged); banned users are blocked at login.
- **Rate limiting** (M3): global 120 req/min/IP via `@nestjs/throttler` with tighter per-route
  limits on login (5), register (10), job create (20), bid create (30), and messages (60).
- **Push** (M3): device token registration (`POST /devices`, `DELETE /devices/:token`) and a
  `PushService` (FCM/APNs abstraction) fanned out from every notification; dev provider logs
  deliveries until real FCM/APNs creds are wired.
- **Realtime**: a Socket.IO gateway at `/realtime` (JWT-authenticated handshake) with per-user
  and per-job rooms. Notifications stream live to the user's room; new bids and messages stream
  to the job room. The web job-detail page subscribes and updates bids/messages instantly.
- **Web admin UI**: `/admin` page with Jobs and Users tabs and ban/unban actions.
- **Full Prisma data model** for all 8 entities with the spec's indexes/constraints.
- **Feature flags** (payments, group-visible messaging, verification, max photos).
- **Web**: login/register, jobs list, post-a-job, and a role-aware job detail page (contractors
  bid; owners review bids + accept).

## Prerequisites

- Node.js >= 20 (tested on 22)
- A PostgreSQL database. Easiest options:
  - **Docker** (recommended): `docker compose up -d` brings up PostGIS + Redis.
  - **Hosted**: a free Neon/Supabase Postgres — paste its URL into `DATABASE_URL`.

> Note: the runnable slice models location as `lat/lng` + coarse-rounded columns and computes
> distance with Haversine, so it runs on **plain PostgreSQL** with no PostGIS required. The
> `docker-compose` uses the PostGIS image so you can adopt `geography(Point,4326)` + `ST_DWithin`
> for production geospatial queries later (see `apps/api/prisma/schema.prisma` notes).

## Quick start

```bash
# 1. Install all workspace dependencies
npm install

# 2. Configure environment
cp .env.example .env            # then edit DATABASE_URL if needed
cp .env.example apps/api/.env   # the API reads its own .env

# 3. (Optional) start Postgres + Redis via Docker
docker compose up -d

# 4. Create the schema + seed sample data
npm run db:generate
npm run db:migrate
npm run db:seed

# 5. Run the API (http://localhost:4000/api/v1)
npm run api

# 6. In another terminal, run the web app (http://localhost:3000)
npm run web
```

Seeded logins (password `Password123!`):

- Homeowner: `homeowner@example.com`
- Contractor: `contractor@example.com`
- Admin: `admin@example.com`

## Roadmap (from the spec)

- **M1 Foundations** — auth, contractor profiles, media signed upload, job CRUD + search,
  radius search, JOB_MATCH + in-app notifications. *(done; swap distance filters for PostGIS
  ST_DWithin at scale)*
- **M2 Marketplace loop** — bids CRUD + permissions, job-scoped messaging, accept bid + reveal
  precise location, in-app notifications. *(done; push FCM/APNs still pending)*
- **M3 Monetization & polish** — Stripe (feature-flagged) wiring, admin moderation + web UI, rate
  limits, push notifications, realtime websockets, expanded audit coverage. *(done; remaining:
  real FCM/APNs + Stripe + S3 credentials, PostGIS migration, mobile parity, deep links, store
  prep, integration/e2e/load tests)*

## Security & privacy notes

- **Location privacy** — discovery/matching only ever use the coarse (~1km-snapped) point.
  Precise address/coords are stripped by serializers and revealed to the accepted contractor
  only (gated on payment success when payments are enabled).
- **Media** — uploads use short-TTL signed URLs with an image MIME allow-list and filename
  hygiene. EXIF GPS stripping and image dimension/type validation should run out-of-band (a
  post-upload transform/Lambda or on-read processing) before a URL is persisted to a job.
- **Audit** — bid acceptance, payment success, and location reveal are written to `audit_logs`
  (append-only), with the audit row committed in the same transaction as the action where
  applicable.
- Passwords are hashed with **Argon2id**; access/refresh are JWTs; RBAC is enforced via a roles
  guard. **Rate limiting** is enforced globally + per-route via `@nestjs/throttler` (back it with
  Redis for multi-instance). Banned accounts are blocked at login.

## Troubleshooting

- **`argon2` install fails (node-gyp / Python)** — we use `@node-rs/argon2` (prebuilt
  binaries, Argon2id) specifically to avoid native compilation. If you re-add `argon2`, you'll
  need Python + a C++ toolchain.
- **Prisma: `query_engine-windows.dll.node is not a valid Win32 application`** — this appears on
  Windows-on-ARM, where Prisma ships no native Windows engine. Run the API under **WSL2** or
  **Docker** (Linux), where the engine is available. The application wiring itself is fine
  (all routes map on boot); this is purely the native query engine.

## Scripts (root)

| Command            | Description                                |
| ------------------ | ------------------------------------------ |
| `npm run api`      | Start the NestJS API in watch mode         |
| `npm run web`      | Start the Next.js web app                  |
| `npm run mobile`   | Start the Expo dev server                  |
| `npm run db:migrate` | Apply Prisma migrations                  |
| `npm run db:seed`  | Seed sample users + jobs                   |
| `npm run typecheck`| Typecheck all workspaces                   |
| `npm run lint`     | Lint all workspaces                        |
