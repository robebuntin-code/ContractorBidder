---
title: DOJOBID App Build Specification
author: ContractorBidder Monorepo
date: June 7, 2026
---

# DOJOBID — App Build Specification

<div class="cover-meta">

**Product:** DOJOBID — cross-platform marketplace connecting homeowners with local contractors  
**Repository:** ContractorBidder (npm monorepo)  
**Version:** 0.1.0  
**Document date:** June 7, 2026

</div>

---

## 1. Executive Summary

DOJOBID is a two-sided marketplace where **homeowners** post home-improvement jobs and **contractors** discover nearby work, submit bids, and communicate after a bid is accepted. The platform enforces a **privacy-first location model**: contractors see only coarse geography (ZIP code and ~1 km grid coordinates) until a bid is accepted, at which point the full address and precise coordinates are revealed.

The system is implemented as a **TypeScript monorepo** with three client surfaces and one backend:

| Surface | Technology | Purpose |
|---------|------------|---------|
| API | NestJS 10 + Prisma 6 + PostgreSQL (Neon) | REST API, auth, business logic, media, payments |
| Web | Next.js 14 (App Router) | Browser client for homeowners and contractors |
| Mobile | Expo SDK 54 + React Navigation 7 | iOS/Android native experience |
| Shared | `@contractor-bidder/types`, `config`, `ui` | Shared types and UI primitives |

Real-time updates use **Socket.IO** on the `/realtime` namespace. Authentication uses **JWT** (access + refresh tokens) with **Argon2id** password hashing.

---

## 2. System Architecture

### 2.1 High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT APPLICATIONS                          │
├──────────────────────┬──────────────────────┬───────────────────────┤
│   Expo Mobile App    │   Next.js Web App    │   Admin Web Console   │
│   (iOS / Android)    │   (port 3000)        │   (/admin)            │
└──────────┬───────────┴──────────┬───────────┴───────────┬─────────┘
           │  HTTPS / REST        │                         │
           │  JWT Bearer          │                         │
           ▼                      ▼                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│              NestJS API  —  http://host:4000/api/v1                 │
├─────────────────────────────────────────────────────────────────────┤
│  Auth │ Users │ Jobs │ Bids │ Messages │ Notifications │ Payments  │
│  Contractors │ Devices │ Media │ Admin │ Realtime (Socket.IO)      │
└──────────┬──────────────────────────────┬───────────────────────────┘
           │                              │
           ▼                              ▼
┌──────────────────────┐    ┌─────────────────────────────────────────┐
│  PostgreSQL (Neon)   │    │  External Services                       │
│  Prisma ORM          │    │  • S3 (prod media) / dev-media (local) │
│  Haversine geo       │    │  • Stripe (acceptance fees)              │
└──────────────────────┘    │  • Push notifications (device tokens)    │
                            └─────────────────────────────────────────┘
```

### 2.2 Monorepo Layout

```
ContractorBidder/
├── apps/
│   ├── api/          NestJS backend, Prisma schema, seed data
│   ├── web/          Next.js 14 web application
│   └── mobile/       Expo app (outside npm workspaces)
├── packages/
│   ├── types/        Shared TypeScript API contract types
│   ├── config/       Shared ESLint/TS config
│   └── ui/           Shared React UI components
├── docs/             Documentation (this file)
└── package.json      Root workspace scripts
```

**Note:** `apps/mobile` is managed with its own `package.json` and linked via `npm --prefix apps/mobile` because Expo tooling does not fully participate in the root npm workspaces.

### 2.3 Root Scripts

| Command | Description |
|---------|-------------|
| `npm run api` | Start NestJS API in dev mode (port 4000) |
| `npm run web` | Start Next.js dev server (port 3000) |
| `npm run mobile` | Start Expo Go with LAN (`expo start --go --lan`) |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed demo users and jobs |
| `npm run build` | Build all workspaces |
| `npm run typecheck` | Type-check all workspaces |

---

## 3. Technology Stack

### 3.1 Backend (apps/api)

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | NestJS 10 | Modular controllers, guards, pipes |
| ORM | Prisma 6 | Rust-free `prisma-client` generator + `@prisma/adapter-pg` |
| Database | PostgreSQL on Neon | Cloud-hosted; works on Windows ARM64 |
| Auth | JWT + Argon2id | Access token (short) + refresh token (rotating) |
| Validation | class-validator | Global `ValidationPipe` with whitelist |
| Realtime | Socket.IO | `/realtime` gateway for live events |
| Media | S3 presigned URLs | Dev fallback: local `.dev-media/` served by API |
| Payments | Stripe | Webhook at `POST /payments/webhook/stripe` |

**API base URL:** `http://localhost:4000/api/v1` (dev)  
**Global prefix:** `/api` with URI versioning default `v1`

### 3.2 Web (apps/web)

| Layer | Choice |
|-------|--------|
| Framework | Next.js 14 App Router |
| Styling | Tailwind CSS |
| Auth | JWT stored client-side, attached to API requests |

**Routes:**

| Path | Purpose |
|------|---------|
| `/` | Landing / home |
| `/login` | Login and registration |
| `/jobs` | Job search (contractors) |
| `/jobs/new` | Post a job (homeowners) |
| `/jobs/[id]` | Job detail, bids, messaging |
| `/my-jobs` | Homeowner's posted jobs |
| `/admin` | Admin dashboard |

### 3.3 Mobile (apps/mobile)

| Layer | Choice |
|-------|--------|
| Framework | Expo SDK 54 |
| Navigation | React Navigation 7 (bottom tabs + stack) |
| Location | expo-location (GPS + geocoding) |
| Media | expo-image-picker + presigned upload |
| Dev client | Expo Go via `npm run start:go` |

**Screens:**

| Screen | Role | Description |
|--------|------|-------------|
| LoginScreen | All | Login / register |
| MyJobsScreen | Homeowner | Posted jobs list |
| PostJobScreen | Homeowner | Create job with address geocoding + photos |
| FindJobsScreen | Contractor | Radius search, trade filters, pull-to-refresh |
| JobDetailScreen | All | Job details, bid, accept, messaging |
| ActivityScreen | All | Notifications feed |
| ProfileScreen | All | User profile; contractor service area + trades |

**Navigation rules:** The **Find** tab is visible only to `CONTRACTOR` and `ADMIN` roles. Homeowners land on **My Jobs**.

### 3.4 Shared Packages

- **`@contractor-bidder/types`** — DTOs, enums, serialized view types shared by web and mobile
- **`@contractor-bidder/config`** — ESLint and TypeScript base configs
- **`@contractor-bidder/ui`** — Reusable React components

---

<div class="page-break"></div>

## 4. Data Model

### 4.1 Entity Relationship Diagram

![DOJOBID Entity Relationship Diagram](./do-jobid-er-diagram.svg)

### 4.2 Tables Overview

The PostgreSQL schema defines **10 models** and **11 enums**. All primary keys are UUIDs.

#### User (`users`)

Central identity record. Supports roles `HOMEOWNER`, `CONTRACTOR`, and `ADMIN`. Password auth uses Argon2id; OAuth providers (`GOOGLE`, `APPLE`) are modeled but not yet wired in the UI.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| email | String (unique) | Login identifier |
| password_hash | String? | Argon2id hash (password auth only) |
| role | Role enum | HOMEOWNER, CONTRACTOR, ADMIN |
| first_name, last_name | String | Display name |
| phone | String? | Optional contact |
| is_verified | Boolean | Email verification flag |
| is_banned | Boolean | Admin ban flag |

#### ContractorProfile (`contractor_profiles`)

One-to-one with User (contractor role). Stores service capabilities and search radius.

| Column | Type | Description |
|--------|------|-------------|
| user_id | UUID (unique FK) | Links to User |
| service_types | String[] | Trade filters (e.g. `electrical`, `plumbing`) |
| service_radius_km | Float | Default 25 km search radius |
| base_lat, base_lng | Float? | Service area center (GPS) |
| rating_agg, rating_count | Float, Int | Aggregated rating (future) |

#### Job (`jobs`)

A homeowner-posted work request. Location fields implement the privacy model.

| Column | Type | Description |
|--------|------|-------------|
| created_by_user_id | UUID FK | Homeowner who posted |
| title, description | String | Job content |
| work_type | String | One of seven trade categories |
| address_text | String | **Private** — full street address |
| precise_lat, precise_lng | Float? | **Private** — exact coordinates |
| coarse_lat, coarse_lng | Float | **Public** — snapped to ~1 km grid |
| photos | String[] | Media URLs |
| budget_min, budget_max | Int? | Budget range in cents |
| status | JobStatus | OPEN, UNDER_REVIEW, CLOSED, CANCELLED, AWARDED |
| accepted_bid_id | UUID? FK | Winning bid reference |

#### Bid (`bids`)

Contractor offer on a job. Unique constraint prevents duplicate bids per contractor per job.

| Column | Type | Description |
|--------|------|-------------|
| job_id | UUID FK | Target job |
| contractor_user_id | UUID FK | Bidding contractor |
| amount | Int | Bid amount in cents |
| message | String? | Optional pitch |
| status | BidStatus | PENDING, WITHDRAWN, DECLINED, ACCEPTED, EXPIRED |

#### Message (`messages`)

Direct messages between users on a job thread.

| Column | Type | Description |
|--------|------|-------------|
| job_id | UUID FK | Conversation context |
| from_user_id, to_user_id | UUID FK | Participants |
| body | String | Message text |
| attachments | String[] | Optional media URLs |
| visibility | MessageVisibility | ALL_BIDDERS or DIRECT |

#### Notification (`notifications`)

In-app notification records with typed payloads stored as JSON.

| Type | Trigger |
|------|---------|
| JOB_MATCH | New job matches contractor filters |
| NEW_BID | Homeowner receives a bid |
| BID_ACCEPTED | Contractor's bid accepted |
| MESSAGE | New message received |
| PAYMENT_REQUIRED | Acceptance fee due |

#### Payment (`payments`)

Stripe-backed acceptance fees ($1 homeowner fee, $1 contractor fee model).

| Column | Type | Description |
|--------|------|-------------|
| direction | PaymentDirection | HOMEOWNER_ACCEPT_FEE or CONTRACTOR_ACCEPT_FEE |
| status | PaymentStatus | PENDING, SUCCEEDED, FAILED, CANCELLED |
| provider_payment_intent_id | String? | Stripe PaymentIntent ID |

#### Device (`devices`)

Push notification tokens per platform (IOS, ANDROID, WEB).

#### AuditLog (`audit_logs`)

Admin and system action trail with JSON metadata.

### 4.3 Enums Reference

| Enum | Values |
|------|--------|
| Role | HOMEOWNER, CONTRACTOR, ADMIN |
| AuthProvider | PASSWORD, GOOGLE, APPLE |
| LocationPrecision | PRECISE, COARSE |
| JobStatus | OPEN, UNDER_REVIEW, CLOSED, CANCELLED, AWARDED |
| BidStatus | PENDING, WITHDRAWN, DECLINED, ACCEPTED, EXPIRED |
| MessageVisibility | ALL_BIDDERS, DIRECT |
| NotificationType | JOB_MATCH, NEW_BID, BID_ACCEPTED, MESSAGE, PAYMENT_REQUIRED |
| PaymentDirection | HOMEOWNER_ACCEPT_FEE, CONTRACTOR_ACCEPT_FEE |
| PaymentStatus | PENDING, SUCCEEDED, FAILED, CANCELLED |
| PaymentProvider | STRIPE |
| DevicePlatform | IOS, ANDROID, WEB |

### 4.4 Work Types

Seven standardized trade categories used across API validation, search filters, and UI labels:

| Value | Label |
|-------|-------|
| electrical | Electrical |
| plumbing | Plumbing |
| landscaping | Landscaping |
| hauling | Hauling |
| carpentry | Carpentry |
| handyman | Handyman |
| other | Other |

---

<div class="page-break"></div>

## 5. Privacy and Location Model

DOJOBID separates **discovery data** from **private location data**:

1. **On job creation:** The API geocodes the homeowner's address into `precise_lat/lng` and computes `coarse_lat/lng` by snapping coordinates to a ~1 km grid.
2. **For contractors browsing jobs:** The serialized job view exposes `postalCode` (extracted from `address_text`) and coarse coordinates — **not** the street address or precise coordinates.
3. **After bid acceptance:** The job owner and accepted contractor receive the full `addressText`, `preciseLat`, and `preciseLng` in the API response.
4. **Contractor search:** Uses Haversine distance from the contractor's `base_lat/lng` (service area) against job `coarse_lat/lng`, filtered by `service_radius_km` and matching `work_type`.

> **Future upgrade:** The Prisma schema includes notes for migrating to PostGIS `geography(Point,4326)` with `ST_DWithin` for native radius queries. Current implementation uses plain Float columns and Haversine SQL.

---

## 6. API Reference

All endpoints are prefixed with `/api/v1`. Authenticated routes require `Authorization: Bearer <accessToken>` unless noted.

### 6.1 Health and Feature Flags

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Health check |
| GET | `/flags` | No | Feature flag snapshot |

### 6.2 Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | No | Register homeowner or contractor |
| POST | `/auth/login` | No | Login, returns JWT pair |
| POST | `/auth/refresh` | No | Rotate refresh token |
| POST | `/auth/logout` | Yes | Invalidate refresh token |

### 6.3 Users

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users/me` | Yes | Current user profile |
| PATCH | `/users/me` | Yes | Update profile fields |

### 6.4 Contractors

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/contractors/profile` | Yes | Create contractor profile |
| PATCH | `/contractors/profile` | Yes | Update trades, radius, location |
| GET | `/contractors/:userId/profile` | Yes | Read contractor profile |

### 6.5 Jobs

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/jobs` | Yes | Create job (homeowner) |
| GET | `/jobs/search` | Yes | Radius + trade search (contractor) |
| GET | `/jobs/mine` | Yes | List jobs created by current user |
| GET | `/jobs/:id` | Yes | Job detail (privacy-aware serialization) |
| POST | `/jobs/:id/close` | Yes | Close job to new bids |
| POST | `/jobs/:id/cancel` | Yes | Cancel job |

### 6.6 Bids

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/jobs/:jobId/bids` | Yes | Submit bid (contractor) |
| GET | `/jobs/:jobId/bids` | Yes | List bids on job |
| PATCH | `/bids/:id` | Yes | Update or withdraw bid |
| POST | `/bids/:id/accept` | Yes | Accept bid (homeowner) |

### 6.7 Messages

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/messages` | Yes | Send message on a job |
| GET | `/messages?jobId=` | Yes | List messages for job |

### 6.8 Notifications

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/notifications` | Yes | List user notifications |
| POST | `/notifications/mark-read` | Yes | Mark notifications read |

### 6.9 Payments

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/payments/session` | Yes | Create Stripe checkout session |
| GET | `/payments/:id` | Yes | Payment status |
| POST | `/payments/webhook/stripe` | Stripe sig | Stripe webhook handler |

### 6.10 Media

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/media/sign-upload` | Yes | Get presigned PUT URL for photo |
| PUT | `/dev-media/*` | No | Dev-only: receive uploaded bytes |
| GET | `/dev-media/*` | No | Dev-only: serve stored media |

### 6.11 Devices

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/devices` | Yes | Register push token |
| DELETE | `/devices/:token` | Yes | Unregister push token |

### 6.12 Admin

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/jobs` | Admin | List all jobs |
| GET | `/admin/users` | Admin | List all users |
| POST | `/admin/flags/ban-user` | Admin | Ban user |
| POST | `/admin/flags/unban-user` | Admin | Unban user |

---

<div class="page-break"></div>

## 7. Core Business Flows

### 7.1 Registration and Onboarding

```
Homeowner                          Contractor
    │                                   │
    ├─ POST /auth/register              ├─ POST /auth/register (role=CONTRACTOR)
    │  (role=HOMEOWNER)                 │
    │                                   ├─ POST /contractors/profile
    │                                   │  (trades, radius, GPS base location)
    └─ Ready to post jobs               └─ Ready to search jobs
```

### 7.2 Post a Job (Homeowner)

1. Homeowner enters title, description, work type, budget, desired dates.
2. Address is entered as text; client geocodes via `expo-location` (mobile) or equivalent (web).
3. Photos selected; client calls `POST /media/sign-upload`, PUTs bytes to signed URL.
4. `POST /jobs` creates record; API stores precise + coarse coordinates.
5. Matching contractors receive `JOB_MATCH` notifications.

### 7.3 Find and Bid (Contractor)

1. Contractor opens Find Jobs; app reads GPS for current location.
2. `GET /jobs/search?lat=&lng=&radiusKm=&workType=` returns nearby open jobs.
3. Job cards show title, trade, budget, **ZIP code** (not full address).
4. Contractor opens detail, submits `POST /jobs/:jobId/bids` with amount and message.
5. Homeowner receives `NEW_BID` notification.

### 7.4 Accept Bid and Reveal Location

1. Homeowner reviews bids on job detail screen.
2. `POST /bids/:id/accept` marks bid ACCEPTED, job status AWARDED.
3. Optional: acceptance triggers Stripe payment session for $1 fees.
4. API response now includes full address and precise coordinates for both parties.
5. Contractor receives `BID_ACCEPTED` notification; messaging unlocked.

### 7.5 Messaging

1. Either party sends `POST /messages` with `jobId`, `toUserId`, and body.
2. Recipient receives `MESSAGE` notification.
3. Real-time delivery via Socket.IO `/realtime` namespace (when connected).

### 7.6 Job Lifecycle States

```
OPEN ──► UNDER_REVIEW ──► AWARDED
  │                         │
  ├──► CLOSED               └──► (work complete — manual close)
  └──► CANCELLED
```

---

## 8. Authentication and Security

| Concern | Implementation |
|---------|----------------|
| Password storage | Argon2id hashing |
| Session tokens | JWT access (15 min) + refresh (7 days, rotating) |
| Authorization | NestJS guards: `@Roles()`, ownership checks on jobs/bids |
| Input validation | Global ValidationPipe with whitelist + forbidNonWhitelisted |
| CORS | Configurable via `API_CORS_ORIGIN` (comma-separated origins) |
| Stripe webhooks | Raw body preserved; signature verification |
| Admin actions | AuditLog entries for ban/unban and sensitive operations |
| Banned users | `is_banned` flag blocks authenticated requests |

---

## 9. Media Upload Pipeline

### Production (S3)

1. Client requests `POST /media/sign-upload` with filename and content type.
2. API returns presigned S3 PUT URL and final `fileUrl`.
3. Client PUTs image bytes directly to S3.
4. Job stores `fileUrl` in `photos[]`.

### Development (Local Dev-Media)

When S3 credentials are absent, the API uses a local `.dev-media/` directory:

1. `sign-upload` returns a PUT URL pointing to `/api/v1/dev-media/<key>`.
2. Raw body middleware accepts up to 12 MB on the dev-media route.
3. URLs use the request Host header so mobile devices on LAN can fetch images.
4. Mobile keeps a local `previewUri` for immediate thumbnail display.

---

## 10. Realtime Events

Socket.IO gateway mounted at `/realtime`. Clients authenticate with JWT on connection. Events include new bids, messages, and notification updates. Mobile and web clients subscribe per user session.

---

## 11. Environment Configuration

### 11.1 API (`apps/api/.env`)

| Variable | Purpose |
|----------|---------|
| DATABASE_URL | Neon PostgreSQL connection string |
| JWT_ACCESS_SECRET | Access token signing key |
| JWT_REFRESH_SECRET | Refresh token signing key |
| JWT_ACCESS_EXPIRES | Access token TTL (e.g. `15m`) |
| JWT_REFRESH_EXPIRES | Refresh token TTL (e.g. `7d`) |
| API_PORT | HTTP port (default `4000`) |
| API_CORS_ORIGIN | Allowed CORS origins |
| AWS_S3_BUCKET | S3 bucket for media (optional in dev) |
| AWS_REGION | AWS region |
| STRIPE_SECRET_KEY | Stripe API key |
| STRIPE_WEBHOOK_SECRET | Webhook signature secret |

### 11.2 Mobile (`apps/mobile/.env`)

| Variable | Purpose |
|----------|---------|
| EXPO_PUBLIC_API_URL | API base URL (use LAN IP for physical device testing) |

Example: `EXPO_PUBLIC_API_URL=http://192.168.4.42:4000/api/v1`

### 11.3 Web (`apps/web/.env.local`)

| Variable | Purpose |
|----------|---------|
| NEXT_PUBLIC_API_URL | API base URL for browser requests |

---

## 12. Database Setup and Seed Data

```bash
# From repository root
npm run db:generate    # Generate Prisma client
npm run db:migrate     # Apply migrations (or prisma db push for dev)
npm run db:seed        # Insert demo data
```

### Demo Accounts (password: `Password123!`)

| Email | Role |
|-------|------|
| homeowner@example.com | HOMEOWNER |
| contractor@example.com | CONTRACTOR |
| admin@example.com | ADMIN |

Seed data includes sample jobs in NYC metro area (ZIP codes 10013, 10002, 11238) with realistic addresses, budgets, and a contractor profile with multiple service types.

---

## 13. Local Development Guide

### 13.1 Prerequisites

- Node.js ≥ 20
- PostgreSQL (Neon cloud or local)
- iOS: Expo Go app on device (same Wi-Fi as dev machine)

### 13.2 Start All Services

```bash
# Terminal 1 — API
npm run api

# Terminal 2 — Web
npm run web

# Terminal 3 — Mobile (Expo Go)
npm run mobile
# Or: cd apps/mobile && npm run start:go
```

### 13.3 Mobile Device Testing

Physical devices cannot reach `localhost`. Set `EXPO_PUBLIC_API_URL` to your machine's LAN IP:

```
EXPO_PUBLIC_API_URL=http://<YOUR_LAN_IP>:4000/api/v1
```

Find your IP with `ipconfig` (Windows) or `ifconfig` (macOS/Linux). Reload the app in Expo Go after changing `.env`.

### 13.4 EAS Builds (Production Mobile)

The mobile app includes `eas.json` for Expo Application Services builds. Custom app icons and native modules require an EAS dev build rather than Expo Go. Configuration targets iOS and Android with `expo-dev-client`.

---

## 14. Deployment Considerations

| Component | Recommended Target |
|-----------|-------------------|
| API | Railway, Render, Fly.io, or AWS ECS |
| Web | Vercel or similar Next.js host |
| Database | Neon PostgreSQL (already configured) |
| Media | AWS S3 with CloudFront CDN |
| Mobile | EAS Build → App Store / Google Play |

**CI recommendations:** Run `npm run typecheck`, `npm run lint`, and `npm run test` on pull requests. Apply Prisma migrations in the deployment pipeline before starting the API.

---

## 15. Known Limitations and Roadmap

| Area | Current State | Planned |
|------|---------------|---------|
| Geospatial | Haversine on Float columns | PostGIS ST_DWithin |
| OAuth | Schema supports Google/Apple | UI not implemented |
| Redis | Not yet integrated | Session cache, rate limiting |
| Ratings | Schema fields exist | Review submission flow |
| Push notifications | Device token storage | FCM/APNs delivery service |

---

## 16. Document Revision History

| Date | Change |
|------|--------|
| 2026-06-07 | Initial build specification with ER diagram |

---

*Generated from the ContractorBidder monorepo source tree. For the latest schema, see `apps/api/prisma/schema.prisma`.*
