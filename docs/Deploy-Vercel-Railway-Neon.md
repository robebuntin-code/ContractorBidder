---
title: Deploy DOJOBID — Path A (Vercel + Railway + Neon)
author: ContractorBidder Monorepo
date: June 7, 2026
---

# Deploy DOJOBID — Path A (Vercel + Railway + Neon)

<div class="cover-meta">

**Purpose:** Step-by-step production deployment (managed hosting)  
**Audience:** Developers and operators deploying DOJOBID  
**Stack:** Vercel (web) + Railway (API) + Neon (database) + GoDaddy DNS  
**Document date:** June 7, 2026

</div>

---

This guide deploys **DOJOBID** using managed hosting (no VPS):

| Component | Platform | URL example |
|-----------|----------|-------------|
| **Web** (`apps/web`) | [Vercel](https://vercel.com) | `https://yourdomain.com` |
| **API** (`apps/api`) | [Railway](https://railway.app) | `https://api.yourdomain.com` |
| **Database** | [Neon](https://neon.tech) | `ep-proud-art-aqlgk6ni` · `us-east-1` · database `neondb` |
| **Domain / DNS** | GoDaddy (or any registrar) | Points web → Vercel, API → Railway |

**Render alternative:** Railway and [Render](https://render.com) are both fine for the API. See [Appendix — Deploy API on Render instead of Railway](#appendix--deploy-api-on-render-instead-of-railway).

**Mobile apps** (Expo) are built separately. They only need the public API URL (`EXPO_PUBLIC_API_URL`).

> **Screenshots in this guide** are annotated reference UI mockups stored in `docs/deploy-screenshots/path-a/`. They show the exact fields, values, and buttons for DOJOBID. Regenerate them with `node render-deploy-screenshots.mjs` from the `docs/` folder. Your provider dashboards may look slightly different after UI updates.

| Figure | File | Step |
|--------|------|------|
| 1 | `neon-01-dashboard.png` | Neon project overview |
| 2 | `neon-02-connection-pooled.png` | Neon pooled connection string |
| 3 | `railway-01-github-deploy.png` | Railway deploy from GitHub |
| 4 | `railway-02-build-settings.png` | Railway build/start commands |
| 5 | `railway-03-variables.png` | Railway environment variables |
| 6 | `railway-04-networking-domain.png` | Railway custom domain |
| 7 | `railway-05-health-check.png` | Railway health endpoint |
| 8–11 | `vercel-01` … `vercel-04` | Vercel import, monorepo, env, domains |
| 12 | `godaddy-01-dns.png` | GoDaddy DNS records |
| 13–14 | `verify-01`, `verify-02` | Production smoke tests |

---

## Architecture

```text
Internet
   │
   ├── https://yourdomain.com          → Vercel (Next.js)
   │         │
   │         └── browser calls ──────────────┐
   │                                         ▼
   └── https://api.yourdomain.com      → Railway (NestJS)
                    │                           │
                    └───────────────────────────┘
                                    │
                                    ▼
              Neon · ep-proud-art-aqlgk6ni (us-east-1) · neondb
```

**Prerequisites on your PC**

- Node.js ≥ 20
- Git repo pushed to **GitHub** (Vercel and Railway connect via GitHub)
- GoDaddy domain (or any DNS provider)
- Neon account

**Estimated monthly cost (starter)**

- Neon: free tier often enough for early launch
- Vercel: free hobby tier for personal/small projects
- Railway: ~$5+ usage-based (check current pricing)
- GoDaddy: domain renewal only (no VPS required)

---

## Phase 1 — Neon database

You already have a Neon project configured for local development in `apps/api/.env`. Production (Railway) uses the **same Neon project** — no second database required for your first launch.

### Your Neon instance (current)

| Setting | Value |
|---------|--------|
| **Endpoint ID** | `ep-proud-art-aqlgk6ni` |
| **Region** | `us-east-1` (AWS) |
| **Database** | `neondb` |
| **Role** | `neondb_owner` |
| **Direct host** (local dev) | `ep-proud-art-aqlgk6ni.c-8.us-east-1.aws.neon.tech` |
| **Pooled host** (Railway — recommended) | `ep-proud-art-aqlgk6ni-pooler.c-8.us-east-1.aws.neon.tech` |
| **Local config** | `apps/api/.env` → `DATABASE_URL` |

> **Security:** The full connection string (including password) lives in `apps/api/.env` on your PC only. Do not commit that file or paste the password into Git, Vercel, or public docs.

### Step 1. Confirm access in the Neon console

1. Sign in at [https://console.neon.tech](https://console.neon.tech).
2. Open the project that contains endpoint **`ep-proud-art-aqlgk6ni`** (region **US East 1**).
3. Confirm the database **`neondb`** exists and migrations have been applied from local dev.

If you later want isolated prod data, create a **branch** in this same Neon project rather than a whole new account.

![Figure 1 — Neon console: confirm project endpoint ep-proud-art-aqlgk6ni, database neondb, region US East 1](./deploy-screenshots/path-a/neon-01-dashboard.png)

**What to look for (Figure 1):** Project overview shows endpoint **`ep-proud-art-aqlgk6ni`**, database **`neondb`**, and region **US East 1**. If you see a different endpoint, open the project that matches your `apps/api/.env` file.

### Step 2. Copy the connection string for Railway

In Neon → **Connection details** for `ep-proud-art-aqlgk6ni`:

1. Select **Pooled connection** (recommended for Railway — avoids connection limit errors).
2. Copy the URI. It should match this shape (password hidden):

   ```text
   postgresql://neondb_owner:YOUR_PASSWORD@ep-proud-art-aqlgk6ni-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```

3. Keep `sslmode=require`.

Alternatively, copy the value already in `apps/api/.env` and change the host from:

- `ep-proud-art-aqlgk6ni.c-8.us-east-1.aws.neon.tech` (direct — fine for local Prisma)

to:

- `ep-proud-art-aqlgk6ni-pooler.c-8.us-east-1.aws.neon.tech` (pooled — use on Railway)

Save the pooled string in a password manager for Railway **Variables**. **Do not commit it to Git.**

![Figure 2 — Neon Connection details: select Pooled connection and copy the URI](./deploy-screenshots/path-a/neon-02-connection-pooled.png)

**What to look for (Figure 2):** **Connection details** → **Pooled connection** selected (not Direct). Host must include **`-pooler`** before `.c-8.us-east-1.aws.neon.tech`. Click **Copy connection string** and paste into Railway (Step 6).

### Step 3. Apply the database schema (from your PC)

Your schema may already be applied from local development. Safe to run again before go-live:

```powershell
cd C:\Users\robbu\.cursor\projects\ContractorBidder

# Uses DATABASE_URL from apps/api/.env (your Neon instance)
npm run db:generate
npm run prisma:deploy --workspace apps/api
```

Or set the pooled URL explicitly for one shell session:

```powershell
cd C:\Users\robbu\.cursor\projects\ContractorBidder

$env:DATABASE_URL="postgresql://neondb_owner:YOUR_PASSWORD@ep-proud-art-aqlgk6ni-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require"

npm run db:generate
npm run prisma:deploy --workspace apps/api
```

Replace `YOUR_PASSWORD` with the password from Neon or `apps/api/.env`.

Optional — **staging only** (do not seed real production):

```powershell
npm run db:seed --workspace apps/api
```

Demo logins after seed: `homeowner@example.com` / `contractor@example.com` / password `Password123!`

---

## Phase 2 — Deploy the API on Railway

Railway runs the NestJS API from the **monorepo root** so workspace packages (`@contractor-bidder/types`) resolve correctly.

### Step 4. Create a Railway project

1. Sign in at [https://railway.app](https://railway.app).
2. **New Project** → **Deploy from GitHub repo**.
3. Authorize GitHub and select **`robebuntin-code/ContractorBidder`** ([github.com/robebuntin-code/ContractorBidder](https://github.com/robebuntin-code/ContractorBidder)).
4. Railway creates a service from the repo.

![Figure 3 — Railway New Project: Deploy from GitHub repo, select ContractorBidder](./deploy-screenshots/path-a/railway-01-github-deploy.png)

**What to look for (Figure 3):** Choose **Deploy from GitHub repo** (not Empty Project). Select your **ContractorBidder** repository and confirm Railway has read access to the repo.

### Step 5. Configure the API service

Open the service → **Settings**:

| Setting | Value |
|---------|--------|
| **Root Directory** | `/` (repo root — leave blank/default) |
| **Watch Paths** (optional) | `apps/api/**`, `packages/**` |

**Build command:**

```bash
npm ci && npm run db:generate --workspace apps/api && npm run build --workspace apps/api
```

**Start command:**

```bash
npm run prisma:deploy --workspace apps/api && npm run start:prod --workspace apps/api
```

Running `prisma migrate deploy` on each deploy keeps Neon in sync when you ship schema changes.

![Figure 4 — Railway Settings: build and start commands for the monorepo API](./deploy-screenshots/path-a/railway-02-build-settings.png)

**What to look for (Figure 4):** **Root Directory** stays at repo root (blank or `/`). Paste the **Build command** and **Start command** exactly as shown in the table above. Save settings before deploying.

### Step 6. Set Railway environment variables

In the service → **Variables**, add:

![Figure 5 — Railway Variables: DATABASE_URL, API_PORT, JWT secrets, CORS](./deploy-screenshots/path-a/railway-03-variables.png)

**What to look for (Figure 5):** Open **Variables** and add every key from the block below. **`DATABASE_URL`** uses the pooled Neon host. **`API_PORT`** must be `${{PORT}}` (Railway variable reference, not the number 4000).

```env
# Pooled URL for ep-proud-art-aqlgk6ni (same Neon project as apps/api/.env)
DATABASE_URL=postgresql://neondb_owner:YOUR_PASSWORD@ep-proud-art-aqlgk6ni-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require

# Railway injects PORT — bind the NestJS app to it
API_PORT=${{PORT}}

# Set after Vercel is live (Step 11); use Railway URL temporarily for first deploy
API_CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com

JWT_ACCESS_SECRET=PASTE_LONG_RANDOM_STRING_1
JWT_REFRESH_SECRET=PASTE_LONG_RANDOM_STRING_2
JWT_ACCESS_TTL=900s
JWT_REFRESH_TTL=30d

PAYMENTS_ENABLED=false
MESSAGING_GROUP_VISIBLE=false
JOBS_MAX_PHOTOS=4
AI_JOB_DESCRIPTION_ENABLED=true
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
MEDIA_S3_BUCKET=
MEDIA_S3_ENDPOINT=
MEDIA_LOCAL_ROOT=/data/media
PUBLIC_WEB_URL=https://dojobid.com
MEDIA_PUBLIC_BASE_URL=https://dojobid.com/api/v1/dev-media
```

Generate JWT secrets (PowerShell):

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

Run twice for the two JWT values.

**Important — job photos on Railway**

Railway’s default filesystem is **ephemeral**. Without persistent storage, uploads disappear on redeploy and job photos break.

**Do Step 6c below before launch** (Railway volume — ~5 minutes, no extra vendor account required).

For high traffic later, you can switch to **Cloudflare R2** (Step 6d).

### Step 6c. Persistent job photos (Railway volume — required)

This keeps photos on a mounted disk that survives API redeploys.

1. Open your **API service** on Railway → **Settings** → **Volumes**.
2. Click **Add Volume** (or **Mount volume**).
3. Set **Mount path** to:

   ```
   /data/media
   ```

4. In **Variables**, add or update:

   ```env
   MEDIA_LOCAL_ROOT=/data/media
   PUBLIC_WEB_URL=https://dojobid.com
   MEDIA_PUBLIC_BASE_URL=https://dojobid.com/api/v1/dev-media
   ```

   Use your real domain if different from `dojobid.com`.

5. **Redeploy** the API service.

6. Verify persistence:

   ```bash
   curl https://YOUR-RAILWAY-API.up.railway.app/api/v1/health
   ```

   Expect `"media":{"mode":"volume","persistent":true}`.

7. **Re-upload photos** on any jobs posted before this step (old files are gone from ephemeral storage).

New uploads are stored under `/data/media/uploads/…` and served through `https://dojobid.com/api/v1/dev-media/…` (proxied to the API).

### Step 6d. Optional — Cloudflare R2 (S3-compatible, scales better)

Use this instead of (or later in addition to) a Railway volume when you outgrow single-server disk.

1. Create an [Cloudflare R2](https://dash.cloudflare.com/) bucket, e.g. `dojobid-media`.
2. **R2 → Manage R2 API tokens** → create token with Object Read & Write on that bucket.
3. **CORS**: apply `docs/r2-cors.json` to the bucket (allows browser PUT from dojobid.com).
4. Railway **Variables**:

   ```env
   MEDIA_S3_BUCKET=dojobid-media
   MEDIA_S3_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
   AWS_ACCESS_KEY_ID=your_r2_access_key
   AWS_SECRET_ACCESS_KEY=your_r2_secret_key
   AWS_REGION=auto
   MEDIA_PUBLIC_BASE_URL=https://dojobid.com/api/v1/dev-media
   PUBLIC_WEB_URL=https://dojobid.com
   ```

   The API serves reads through `/api/v1/dev-media/…` (pulls from R2). Uploads use presigned PUT URLs directly to R2.

5. Redeploy API. Health should show `"media":{"mode":"s3","persistent":true}`.

### Step 6b. Enable Stripe bid acceptance fee ($1 homeowner)

When a homeowner accepts a bid, DOJOBID can charge a **$1 acceptance fee** before revealing the job address to the contractor.

1. Create a [Stripe](https://dashboard.stripe.com) account (start in **Test mode**).
2. **Developers → API keys:** copy **Secret key** → Railway `STRIPE_SECRET_KEY`.
3. **Developers → Webhooks → Add endpoint:**
   - URL: `https://YOUR-RAILWAY-API.up.railway.app/api/v1/payments/webhook/stripe`
   - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`
   - Copy **Signing secret** → Railway `STRIPE_WEBHOOK_SECRET`
4. Railway variables:

   ```env
   PAYMENTS_ENABLED=true
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

5. Vercel → **Environment Variables:**

   | Name | Value |
   |------|--------|
   | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` from Stripe |

6. Redeploy **API** and **web**. Test on a job: accept bid → pay $1 in the modal → contractor sees address after webhook.

Use card `4242 4242 4242 4242` in test mode. Leave `PAYMENTS_ENABLED=false` until Stripe keys are set on both Railway and Vercel.

### Step 7. Add a custom API domain on Railway

1. **Settings → Networking → Generate Domain** first if you have not already (gives a `*.up.railway.app` URL for testing).
2. **Settings → Networking → Custom Domain** → add `api.yourdomain.com`.
3. Railway shows a **CNAME target** (e.g. `something.up.railway.app`).
4. Leave this tab open — you will create the DNS record in Phase 4.

![Figure 6 — Railway Networking: public domain and custom domain api.yourdomain.com](./deploy-screenshots/path-a/railway-04-networking-domain.png)

**What to look for (Figure 6):** Copy the **CNAME target** Railway displays. You will paste it into GoDaddy as a `api` CNAME record (Step 14).

![Figure 7 — Railway health check: GET /api/v1/health returns status ok](./deploy-screenshots/path-a/railway-05-health-check.png)

**What to look for (Figure 7):** Before adding DNS, open `https://YOUR-SERVICE.up.railway.app/api/v1/health` in a browser. You should see JSON with `"status":"ok"`. If not, check Railway deploy logs and `DATABASE_URL`.

Test after DNS propagates:

```text
https://api.yourdomain.com/api/v1/health
```

---

## Phase 3 — Deploy the web app on Vercel

### Step 8. Import the repo on Vercel

1. Sign in at [https://vercel.com](https://vercel.com).
2. **Add New → Project** → import **`robebuntin-code/ContractorBidder`**.
3. Configure the project:

| Setting | Value |
|---------|--------|
| **Framework Preset** | Next.js |
| **Root Directory** | `apps/web` |
| **Include source files outside of the Root Directory** | **Enabled** (required for monorepo workspace packages) |

![Figure 8 — Vercel import: connect GitHub repository ContractorBidder](./deploy-screenshots/path-a/vercel-01-import-project.png)

**What to look for (Figure 8):** **Add New → Project** → import the same GitHub repo used on Railway. Grant Vercel access if prompted.

![Figure 9 — Vercel configure: Root Directory apps/web, include monorepo packages](./deploy-screenshots/path-a/vercel-02-monorepo-settings.png)

**What to look for (Figure 9):** Set **Root Directory** to `apps/web`. Enable **Include source files outside of the Root Directory** — required for `@contractor-bidder/types` and `@contractor-bidder/ui`.

### Step 9. Set Vercel environment variables

In **Project → Settings → Environment Variables**:

| Name | Value | Environments |
|------|--------|--------------|
| `NEXT_PUBLIC_API_URL` | `https://api.yourdomain.com/api/v1` | Production (and Preview if you want staging) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` (when `PAYMENTS_ENABLED=true`) | Production |

![Figure 10 — Vercel Environment Variables: NEXT_PUBLIC_API_URL for production](./deploy-screenshots/path-a/vercel-03-env-vars.png)

**What to look for (Figure 10):** Add **`NEXT_PUBLIC_API_URL`** before the first production deploy. Use your Railway `*.up.railway.app` URL temporarily if `api.yourdomain.com` is not ready yet.

**Changing `NEXT_PUBLIC_*` requires a new deploy** — Vercel bakes it in at build time.

### Step 10. Deploy

1. Click **Deploy**.
2. Vercel runs `npm install` from the monorepo root and builds `apps/web`.
3. Open the `*.vercel.app` URL — you should see the login page.
4. Open browser DevTools → Network. Confirm API calls go to `https://api.yourdomain.com/api/v1/...`, not `localhost:4000`.

If the web app still calls localhost, fix `NEXT_PUBLIC_API_URL` and **Redeploy**. See **Figure 14** in Step 16.

### Step 11. Add custom domains on Vercel

1. **Project → Settings → Domains**.
2. Add `yourdomain.com` and `www.yourdomain.com`.
3. Vercel shows required DNS records.

![Figure 11 — Vercel Domains: yourdomain.com and www with DNS instructions](./deploy-screenshots/path-a/vercel-04-domains.png)

**What to look for (Figure 11):** Both domains should show **Valid Configuration** after DNS propagates. Copy Vercel’s records into GoDaddy (Step 13).

### Step 12. Update API CORS on Railway

Once you know the final web URLs, update Railway:

```env
API_CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com,https://YOUR-PROJECT.vercel.app
```

Include the `*.vercel.app` URL if you use preview deployments. Redeploy the API service.

---

## Phase 4 — GoDaddy DNS

In GoDaddy → **My Products** → your domain → **DNS** (or **Manage DNS**).

### Step 13. Web → Vercel

Use the **exact records Vercel shows** in the Domains panel. Typical setup:

| Type | Name | Value | Notes |
|------|------|-------|--------|
| **A** | `@` | `76.76.21.21` | Vercel apex (confirm in Vercel UI — IP can change) |
| **CNAME** | `www` | `cname.vercel-dns.com` | Or the hostname Vercel assigns |

Some registrars use **ALIAS/ANAME** for apex instead of A — follow Vercel’s instructions for GoDaddy.

![Figure 12 — GoDaddy DNS: A record for web, CNAME for www and api](./deploy-screenshots/path-a/godaddy-01-dns.png)

**What to look for (Figure 12):** Three records — **`@` A** → Vercel IP, **`www` CNAME** → Vercel, **`api` CNAME** → Railway target from Figure 6. Do not point `api` at Vercel.

### Step 14. API → Railway

| Type | Name | Value |
|------|------|--------|
| **CNAME** | `api` | Railway CNAME target from Step 7 |

Example: `api` → `your-service.up.railway.app`

**Do not** point `api` at Vercel or the apex A record.

### Step 15. Wait for propagation

DNS can take a few minutes to a few hours. Check:

```powershell
nslookup yourdomain.com
nslookup api.yourdomain.com
```

Both should resolve. HTTPS is handled automatically by Vercel and Railway once DNS is correct.

---

## Phase 5 — Production verification

### Step 16. Smoke test

| Check | URL / action |
|-------|----------------|
| API health | `https://api.yourdomain.com/api/v1/health` → `{"status":"ok",...}` |
| API flags | `https://api.yourdomain.com/api/v1/flags` → JSON feature flags |
| Web loads | `https://yourdomain.com` → login page |
| Register / login | Create account or use seeded demo (staging only) |
| Post a job | Geocoding, description, photo upload |
| CORS | No browser console errors on API calls from web |
| Realtime | Open job detail in two tabs — bids/messages update (Socket.IO) |

![Figure 13 — Production API health on custom domain api.yourdomain.com](./deploy-screenshots/path-a/verify-01-browser-health.png)

**What to look for (Figure 13):** Browser shows JSON `{"status":"ok",...}` at `https://api.yourdomain.com/api/v1/health` — confirms Railway + DNS + SSL.

![Figure 14 — Browser DevTools Network: API calls go to api.yourdomain.com, not localhost](./deploy-screenshots/path-a/verify-02-devtools-network.png)

**What to look for (Figure 14):** On `https://yourdomain.com`, open DevTools → **Network**. Login and browse jobs — every API request should target **`api.yourdomain.com`**, never `localhost:4000`.

### Step 17. Mobile app (optional)

On your dev machine, `apps/mobile/.env`:

```env
EXPO_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
```

Restart Expo. Physical devices must reach the public HTTPS API (not a LAN IP).

For App Store builds, set the same variable in **EAS** secrets / build profile.

---

## Phase 6 — Deploying updates

### Web (Vercel)

Push to the connected Git branch → Vercel auto-builds.

If you change `NEXT_PUBLIC_API_URL`, trigger a **Redeploy** from the Vercel dashboard.

### API (Railway)

Push to GitHub → Railway auto-builds and runs migrations (via start command).

Manual migration from your PC (if needed):

```powershell
$env:DATABASE_URL="postgresql://neondb_owner:YOUR_PASSWORD@ep-proud-art-aqlgk6ni-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require"
npm run prisma:deploy --workspace apps/api
```

### Database (Neon)

Schema changes ship with API deploys (`prisma migrate deploy`). Backups and branching are managed in the Neon dashboard.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| API build fails on Railway | Monorepo / Prisma | Use repo **root** as Root Directory; run `db:generate` before `build` |
| API won’t start | Wrong `DATABASE_URL` | Use pooled host `ep-proud-art-aqlgk6ni-pooler.c-8.us-east-1.aws.neon.tech`, `sslmode=require`, check Railway logs |
| API listens on wrong port | `API_PORT` not set | Set `API_PORT=${{PORT}}` on Railway |
| `Unauthorized` / CORS in browser | Missing web origin | Add exact `https://` URLs to `API_CORS_ORIGIN`; redeploy API |
| Web calls `localhost:4000` | Stale `NEXT_PUBLIC_API_URL` | Fix env on Vercel → **Redeploy** |
| Photos upload then vanish | Ephemeral Railway disk | Configure S3 or R2 (`MEDIA_S3_BUCKET`, credentials via Railway) |
| SSL / certificate errors | DNS not propagated | Wait; confirm CNAME for `api`, Vercel records for `@`/`www` |
| Neon connection limits | Too many connections | Use **pooled** host (`…-pooler.c-8.us-east-1.aws.neon.tech`), not the direct endpoint |
| Health OK but login fails | Migrations not applied | Run `prisma:deploy` locally or fix Railway start command |

**Useful URLs**

- Railway: service → **Deployments → View logs**
- Vercel: project → **Deployments → Build logs**
- Neon: **Monitoring** for connections and query load

---

## Quick checklist

- [ ] Neon **`ep-proud-art-aqlgk6ni`** — pooled `DATABASE_URL` saved for Railway (from dashboard or `apps/api/.env` + `-pooler` host)
- [ ] `prisma migrate deploy` run against Neon
- [ ] Railway API deployed; `API_PORT=${{PORT}}`; JWT secrets set
- [ ] Railway health check: `/api/v1/health`
- [ ] Vercel web deployed; `NEXT_PUBLIC_API_URL` points at production API
- [ ] GoDaddy DNS: `@`/`www` → Vercel, `api` → Railway CNAME
- [ ] `API_CORS_ORIGIN` includes production web URL(s)
- [ ] S3/R2 configured for job photos (recommended before real users)
- [ ] Stripe webhook + `PAYMENTS_ENABLED=true` (optional — $1 bid acceptance fee)
- [ ] Login, post job, and photo flow tested end-to-end
- [ ] Demo seed passwords removed or not used in production

---

## Appendix — Deploy API on Render instead of Railway

Render steps mirror Railway with different labels:

1. [render.com](https://render.com) → **New → Web Service** → connect GitHub repo.
2. **Root Directory:** leave blank (repo root).
3. **Runtime:** Node.
4. **Build Command:**

   ```bash
   npm ci && npm run db:generate --workspace apps/api && npm run build --workspace apps/api
   ```

5. **Start Command** (Render injects `PORT` — map it to `API_PORT`):

   ```bash
   export API_PORT=$PORT && npm run prisma:deploy --workspace apps/api && npm run start:prod --workspace apps/api
   ```

6. **Environment variables:** same list as Step 6 (omit `API_PORT` in the dashboard).

7. **Custom domain:** add `api.yourdomain.com` in Render → point GoDaddy **CNAME** `api` to Render’s hostname.

Everything else in this guide (Neon, Vercel, DNS, CORS, media storage) stays the same.

---

## Optional — `railway.toml` at repo root

If you prefer config in Git, create `railway.toml`:

```toml
[build]
builder = "NIXPACKS"
buildCommand = "npm ci && npm run db:generate --workspace apps/api && npm run build --workspace apps/api"

[deploy]
startCommand = "npm run prisma:deploy --workspace apps/api && npm run start:prod --workspace apps/api"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

Commit and push; Railway picks it up on the next deploy.

---

## Related docs

- PDF: `docs/Deploy-Vercel-Railway-Neon.pdf` (regenerate with `node generate-pdf.mjs deploy-vercel-railway-neon` from `docs/`)
- Screenshots: `docs/deploy-screenshots/path-a/` (regenerate with `node render-deploy-screenshots.mjs` from `docs/`)
- VPS + Neon (all-in-one server): `docs/Deploy-GoDaddy-Windows-Neon.md`
- Environment variables: `.env.example`, `apps/api/.env.example`
- Operations: `docs/DOJOBID-Operators-Manual.md`
- Local development: root `README.md`
