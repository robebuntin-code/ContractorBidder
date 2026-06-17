# Deploy DOJOBID to GoDaddy Windows VPS (Neon database)

This guide walks through hosting the **web app** and **API** on a **GoDaddy Windows VPS**, while keeping **PostgreSQL on Neon**. The iPhone/Android apps are separate (Expo); they only need your public API URL.

---

## Architecture

```text
Internet
   │
   ├── https://yourdomain.com        → IIS reverse proxy → localhost:3000 (Next.js)
   │
   └── https://api.yourdomain.com    → IIS reverse proxy → localhost:4000 (NestJS API)
                                              │
                                              ▼
              Neon · ep-proud-art-aqlgk6ni (us-east-1) · neondb
```

| Component | Where it runs |
|-----------|----------------|
| Web (`apps/web`) | GoDaddy Windows VPS |
| API (`apps/api`) | GoDaddy Windows VPS |
| Database | **Neon** `ep-proud-art-aqlgk6ni` · `us-east-1` · `neondb` (not on the VPS) |
| Job photos | API `dev-media` folder or S3 (optional) |

**Prerequisites on your PC:** Git repo access, GoDaddy domain, Neon account.

**Prerequisites on VPS:** Node.js ≥ 20, Git, PM2, IIS + URL Rewrite + ARR.

---

## Phase 1 — Neon database

Use your **existing** Neon project (same as local dev in `apps/api/.env`).

| Setting | Value |
|---------|--------|
| **Endpoint ID** | `ep-proud-art-aqlgk6ni` |
| **Region** | `us-east-1` (AWS) |
| **Database** | `neondb` |
| **Role** | `neondb_owner` |
| **Direct host** (local / VPS) | `ep-proud-art-aqlgk6ni.c-8.us-east-1.aws.neon.tech` |
| **Pooled host** (recommended on VPS under load) | `ep-proud-art-aqlgk6ni-pooler.c-8.us-east-1.aws.neon.tech` |
| **Local config** | `apps/api/.env` → `DATABASE_URL` |

> **Security:** Do not commit `apps/api/.env` or paste your Neon password into Git.

### Step 1. Confirm access in the Neon console

1. Sign in at [https://console.neon.tech](https://console.neon.tech).
2. Open the project with endpoint **`ep-proud-art-aqlgk6ni`** (US East 1).
3. Confirm database **`neondb`** exists.

### Step 2. Copy the connection string

In Neon → **Connection details** for `ep-proud-art-aqlgk6ni`:

1. Choose **Pooled connection** (recommended for the API under load).
2. Copy the URI. Shape (password hidden):

   ```text
   postgresql://neondb_owner:YOUR_PASSWORD@ep-proud-art-aqlgk6ni-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```

   Or copy from `apps/api/.env` and swap the direct host for the `-pooler` host above.

3. Keep `sslmode=require` — Neon requires SSL.

Save this for Step 12. Do not commit it to Git.

### Step 3. Allow the VPS to reach Neon

Neon is reached over the public internet. Your VPS only needs **outbound HTTPS/5432** access (default on most VPS plans). No IP allowlist is required on typical Neon plans.

---

## Phase 2 — GoDaddy VPS and DNS

### Step 4. Open the Windows VPS

1. GoDaddy → **My Products** → **VPS** → **Manage**.
2. Note the **public IP address**.
3. Connect with **Remote Desktop** (RDP):
   - Host: VPS IP
   - User/password from the GoDaddy panel

### Step 5. Patch Windows

1. Run **Windows Update** until current.
2. Set a strong Administrator password.

### Step 6. Configure DNS (GoDaddy)

In **DNS** for your domain, add:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | VPS public IP | 600 |
| A | `www` | VPS public IP | 600 |
| A | `api` | VPS public IP | 600 |

Examples:

- Web: `https://yourdomain.com`
- API: `https://api.yourdomain.com`

Wait for DNS to propagate (minutes to a few hours). Test with:

```powershell
nslookup api.yourdomain.com
```

---

## Phase 3 — Install software on the VPS

Run these in **PowerShell as Administrator** on the VPS.

### Step 7. Install Node.js 20 LTS

1. Download the **Windows LTS installer** from [https://nodejs.org](https://nodejs.org).
2. Install with defaults.
3. Verify:

   ```powershell
   node -v
   npm -v
   ```

   Node must be **v20 or newer**.

### Step 8. Install Git

1. Download from [https://git-scm.com/download/win](https://git-scm.com/download/win).
2. Install with defaults.
3. Verify:

   ```powershell
   git --version
   ```

### Step 9. Install PM2 (keeps app running after reboot)

```powershell
npm install -g pm2
npm install -g pm2-windows-startup
pm2-startup install
```

### Step 10. Install IIS reverse proxy

1. **Server Manager** → **Add Roles and Features** → enable **Web Server (IIS)**.
2. Install IIS extensions:
   - [URL Rewrite](https://www.iis.net/downloads/microsoft/url-rewrite)
   - [Application Request Routing (ARR)](https://www.iis.net/downloads/microsoft/application-request-routing)
3. **IIS Manager** → select the server → **Application Request Routing Cache** → **Server Proxy Settings** → **Enable proxy**.

You do **not** install PostgreSQL on the VPS when using Neon.

---

## Phase 4 — Deploy the application

### Step 11. Clone the repository

```powershell
mkdir C:\apps
cd C:\apps
git clone https://github.com/YOUR_ORG/ContractorBidder.git
cd ContractorBidder
```

Or zip the project on your PC, copy via RDP, and extract to `C:\apps\ContractorBidder`.

### Step 12. Install dependencies

```powershell
cd C:\apps\ContractorBidder
npm install
```

### Step 13. Configure environment files

#### API — `C:\apps\ContractorBidder\apps\api\.env`

```env
# Neon ep-proud-art-aqlgk6ni — pooled (from Step 2 or apps/api/.env + -pooler host)
DATABASE_URL="postgresql://neondb_owner:YOUR_PASSWORD@ep-proud-art-aqlgk6ni-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Redis is optional for initial launch; throttling works in-memory without it
REDIS_URL="redis://localhost:6379"

# Generate two unique random strings — do not use dev defaults
JWT_ACCESS_SECRET="REPLACE_WITH_LONG_RANDOM_STRING_1"
JWT_REFRESH_SECRET="REPLACE_WITH_LONG_RANDOM_STRING_2"
JWT_ACCESS_TTL="900s"
JWT_REFRESH_TTL="30d"

API_PORT=4000
API_CORS_ORIGIN="https://yourdomain.com,https://www.yourdomain.com"

PAYMENTS_ENABLED=false
MESSAGING_GROUP_VISIBLE=false
PROFILE_REQUIRE_VERIFICATION=false
JOBS_MAX_PHOTOS=4
AI_JOB_DESCRIPTION_ENABLED=true
GEMINI_API_KEY=""
GEMINI_MODEL="gemini-2.0-flash"

STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""

# Photos: leave S3 empty to store on the API server (dev-media)
AWS_REGION="us-east-1"
MEDIA_S3_BUCKET=""
MEDIA_S3_ENDPOINT=""
MEDIA_PUBLIC_BASE_URL="https://api.yourdomain.com/api/v1/dev-media"
```

Generate secrets in PowerShell:

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

Run twice for the two JWT secrets.

#### Web — `C:\apps\ContractorBidder\apps\web\.env.local`

```env
NEXT_PUBLIC_API_URL="https://api.yourdomain.com/api/v1"
```

Replace `yourdomain.com` with your real domain.  
**Important:** `NEXT_PUBLIC_*` values are baked in at **build time**. Rebuild the web app after changing this file.

### Step 14. Apply database schema to Neon

From the repo root:

```powershell
cd C:\apps\ContractorBidder
npm run db:generate
npm run prisma:deploy --workspace apps/api
```

Optional — seed demo users (only for staging, not recommended for real production):

```powershell
npm run db:seed --workspace apps/api
```

Demo logins after seed: `homeowner@example.com` / `contractor@example.com` / password `Password123!`

### Step 15. Build API and web

```powershell
cd C:\apps\ContractorBidder
npm run build --workspace apps/api
npm run build --workspace apps/web
```

Fix any build errors before continuing.

---

## Phase 5 — Run the services

### Step 16. Start with PM2

```powershell
cd C:\apps\ContractorBidder\apps\api
pm2 start dist/main.js --name dojobid-api

cd C:\apps\ContractorBidder\apps\web
pm2 start npm --name dojobid-web -- start

pm2 save
pm2 status
```

### Step 17. Verify locally on the VPS

```powershell
curl http://localhost:4000/api/v1/health
curl http://localhost:3000
```

Expected: health JSON from the API; HTML from the web app.

If the API fails, check Neon connectivity:

```powershell
pm2 logs dojobid-api
```

Common fixes: wrong `DATABASE_URL`, missing `sslmode=require`, typo in password.

---

## Phase 6 — IIS reverse proxy and HTTPS

### Step 18. Create IIS sites

Create two empty folders:

```powershell
mkdir C:\inetpub\dojobid-web
mkdir C:\inetpub\dojobid-api
```

**Site 1 — Web**

- IIS Manager → **Add Website**
- Name: `dojobid-web`
- Physical path: `C:\inetpub\dojobid-web`
- Binding: HTTP, port **80**, host `yourdomain.com` (add `www.yourdomain.com`)

`C:\inetpub\dojobid-web\web.config`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="ReverseProxyToNext" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://127.0.0.1:3000/{R:1}" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

**Site 2 — API**

- Name: `dojobid-api`
- Physical path: `C:\inetpub\dojobid-api`
- Binding: HTTP, port **80**, host `api.yourdomain.com`

`C:\inetpub\dojobid-api\web.config`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="ReverseProxyToApi" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://127.0.0.1:4000/{R:1}" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

### Step 19. Open firewall ports

**Windows Defender Firewall** → Inbound rules:

- Allow **TCP 80** (HTTP)
- Allow **TCP 443** (HTTPS, after certificates)

Do **not** expose ports **3000** or **4000** to the public internet.

### Step 20. Add HTTPS (Let's Encrypt)

Use **win-acme** ([https://www.win-acme.com](https://www.win-acme.com)):

1. Download and run `wacs.exe` on the VPS.
2. Create certificates for `yourdomain.com`, `www.yourdomain.com`, and `api.yourdomain.com`.
3. Bind certificates to both IIS sites.
4. Enable auto-renewal.

After HTTPS works, confirm env files use `https://` URLs, then **rebuild the web app** (Step 15 web build only) and restart:

```powershell
cd C:\apps\ContractorBidder\apps\web
npm run build
pm2 restart dojobid-web
pm2 restart dojobid-api
```

---

## Phase 7 — Production verification

### Step 21. Smoke test

| Check | URL / action |
|-------|----------------|
| API health | `https://api.yourdomain.com/api/v1/health` → `{"status":"ok",...}` |
| Web loads | `https://yourdomain.com` → login page |
| Login | Sign in with a real or seeded account |
| Jobs | Post a job, upload a photo, search |
| CORS | No browser errors calling API from web domain |

### Step 22. Mobile app (optional)

In `apps/mobile/.env` on your dev machine:

```env
EXPO_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
```

Rebuild or restart Expo; physical devices must reach the public API over HTTPS.

---

## Phase 8 — Deploying updates

When you change code:

```powershell
cd C:\apps\ContractorBidder
git pull
npm install
npm run build --workspace apps/api
npm run build --workspace apps/web
npm run prisma:deploy --workspace apps/api
pm2 restart dojobid-api
pm2 restart dojobid-web
```

If you changed `NEXT_PUBLIC_API_URL`, rebuild the web app before restarting.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| API won't start | Bad `DATABASE_URL` | Verify Neon string, `sslmode=require`, run `pm2 logs dojobid-api` |
| `Unauthorized` / CORS | Wrong origins | Set `API_CORS_ORIGIN` to exact `https://yourdomain.com` URLs |
| Web calls `localhost:4000` | Stale build | Set `.env.local`, run `npm run build` in `apps/web`, restart PM2 |
| Photos broken on phone | Wrong media URL | Set `MEDIA_PUBLIC_BASE_URL` to `https://api.yourdomain.com/api/v1/dev-media` |
| Site down after reboot | PM2 not persisted | `pm2 save` and `pm2-startup install` |
| Neon connection limits | Too many connections | Use pooled host `ep-proud-art-aqlgk6ni-pooler.c-8.us-east-1.aws.neon.tech` |
| SSL errors | HTTP URLs in env | Use `https://` everywhere after win-acme |

Useful commands:

```powershell
pm2 status
pm2 logs dojobid-api
pm2 logs dojobid-web
pm2 restart all
```

---

## Quick checklist

- [ ] Neon **`ep-proud-art-aqlgk6ni`** — pooled `DATABASE_URL` saved (from dashboard or `apps/api/.env`)
- [ ] DNS A records for `@`, `www`, `api` → VPS IP
- [ ] Node 20+, Git, PM2, IIS + URL Rewrite + ARR installed on VPS
- [ ] Repo cloned; `npm install`
- [ ] `apps/api/.env` with Neon URL and production secrets
- [ ] `apps/web/.env.local` with `NEXT_PUBLIC_API_URL`
- [ ] `prisma:deploy` against Neon
- [ ] API and web built
- [ ] PM2 running both services
- [ ] IIS reverse proxy for web (:3000) and API (:4000)
- [ ] Firewall: 80/443 open; 3000/4000 not public
- [ ] HTTPS via win-acme
- [ ] Web rebuilt after final HTTPS URLs
- [ ] Health check and login tested

---

## Related docs

- Managed hosting (Vercel + Railway + Neon): `docs/Deploy-Vercel-Railway-Neon.md`
- Local development: root `README.md`
- Environment variables: `.env.example`, `apps/api/.env.example`
- Operations: `docs/DOJOBID-Operators-Manual.md`
