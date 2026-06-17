/**
 * Renders annotated deployment guide screenshots (UI mockups) to PNG.
 * Run from docs/: node render-deploy-screenshots.mjs
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, 'deploy-screenshots', 'path-a');
const EDGE =
  process.env.PUPPETEER_EXECUTABLE_PATH ??
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

mkdirSync(OUT_DIR, { recursive: true });

function shell(title, url, accent, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Segoe UI", system-ui, sans-serif;
    background: #0b1220;
    padding: 24px;
    width: 1240px;
  }
  .browser {
    background: #111827;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid #334155;
    box-shadow: 0 20px 50px rgba(0,0,0,.45);
  }
  .chrome {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 14px; background: #1f2937; border-bottom: 1px solid #374151;
  }
  .dot { width: 11px; height: 11px; border-radius: 50%; }
  .dot.r { background: #ef4444; } .dot.y { background: #eab308; } .dot.g { background: #22c55e; }
  .url {
    flex: 1; margin-left: 10px; background: #111827; color: #94a3b8;
    border-radius: 6px; padding: 6px 12px; font-size: 13px;
  }
  .app { display: flex; min-height: 620px; background: #0f172a; color: #e2e8f0; }
  .sidebar {
    width: 220px; background: #111827; border-right: 1px solid #334155; padding: 16px 0;
  }
  .brand { padding: 0 16px 16px; font-weight: 700; color: ${accent}; font-size: 15px; }
  .nav { padding: 8px 16px; color: #94a3b8; font-size: 13px; }
  .nav.active { background: rgba(255,255,255,.06); color: #fff; border-left: 3px solid ${accent}; }
  .main { flex: 1; padding: 24px 28px; }
  h1 { font-size: 22px; margin-bottom: 6px; }
  .sub { color: #94a3b8; font-size: 13px; margin-bottom: 20px; }
  .card {
    background: #1e293b; border: 1px solid #334155; border-radius: 10px;
    padding: 16px 18px; margin-bottom: 14px;
  }
  .label { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #94a3b8; margin-bottom: 6px; }
  .value { font-family: Consolas, monospace; font-size: 13px; color: #f8fafc; word-break: break-all; }
  .row { display: flex; gap: 12px; flex-wrap: wrap; }
  .pill {
    display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 12px;
    background: rgba(34,197,94,.15); color: #86efac; border: 1px solid rgba(34,197,94,.35);
  }
  .btn {
    display: inline-block; padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600;
    background: ${accent}; color: #fff; margin-right: 8px;
  }
  .btn.ghost { background: transparent; border: 1px solid #475569; color: #cbd5e1; }
  .field { margin-bottom: 12px; }
  .field label { display: block; font-size: 12px; color: #94a3b8; margin-bottom: 4px; }
  .input {
    width: 100%; background: #0f172a; border: 1px solid #475569; border-radius: 8px;
    padding: 10px 12px; color: #e2e8f0; font-size: 13px; font-family: Consolas, monospace;
  }
  .input.hl { border-color: #f59e0b; box-shadow: 0 0 0 3px rgba(245,158,11,.25); }
  .tabs { display: flex; gap: 4px; margin-bottom: 18px; border-bottom: 1px solid #334155; }
  .tab { padding: 10px 14px; font-size: 13px; color: #94a3b8; }
  .tab.active { color: #fff; border-bottom: 2px solid ${accent}; margin-bottom: -1px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border: 1px solid #334155; padding: 10px 12px; text-align: left; }
  th { background: #111827; color: #94a3b8; font-weight: 600; }
  .callout {
    position: relative; border: 2px dashed #f59e0b; border-radius: 10px; padding: 14px;
  }
  .badge {
    position: absolute; top: -12px; left: 12px; background: #f59e0b; color: #111827;
    font-weight: 700; font-size: 11px; padding: 2px 8px; border-radius: 999px;
  }
  .note { margin-top: 14px; font-size: 12px; color: #64748b; }
  .json { color: #86efac; white-space: pre-wrap; font-family: Consolas, monospace; font-size: 14px; }
  .check { color: #22c55e; font-weight: 700; }
  .highlight-row td { background: rgba(245,158,11,.08); }
</style>
</head>
<body>
<div class="browser">
  <div class="chrome">
    <div class="dot r"></div><div class="dot y"></div><div class="dot g"></div>
    <div class="url">${url}</div>
  </div>
  <div class="app">${body}</div>
</div>
<p class="note">Annotated reference UI for DOJOBID deployment — your dashboard may differ slightly.</p>
</body></html>`;
}

const SHOTS = [
  {
    file: 'neon-01-dashboard.png',
    html: shell(
      'Neon',
      'https://console.neon.tech/app/projects',
      '#12d992',
      `
      <div class="sidebar">
        <div class="brand">Neon Console</div>
        <div class="nav active">Projects</div>
        <div class="nav">Branches</div>
        <div class="nav">Monitoring</div>
        <div class="nav">Connection details</div>
      </div>
      <div class="main">
        <h1>Project overview</h1>
        <div class="sub">US East 1 (AWS) · PostgreSQL 16</div>
        <div class="callout">
          <span class="badge">① Confirm</span>
          <div class="row" style="margin-bottom:12px">
            <span class="pill">Endpoint: ep-proud-art-aqlgk6ni</span>
            <span class="pill">Database: neondb</span>
            <span class="pill">Role: neondb_owner</span>
          </div>
          <div class="card">
            <div class="label">Primary compute</div>
            <div class="value">ep-proud-art-aqlgk6ni.c-8.us-east-1.aws.neon.tech</div>
          </div>
        </div>
      </div>`,
    ),
  },
  {
    file: 'neon-02-connection-pooled.png',
    html: shell(
      'Neon',
      'https://console.neon.tech/app/projects/.../connection-details',
      '#12d992',
      `
      <div class="sidebar">
        <div class="brand">Neon Console</div>
        <div class="nav">Projects</div>
        <div class="nav active">Connection details</div>
      </div>
      <div class="main">
        <h1>Connection details</h1>
        <div class="sub">Endpoint ep-proud-art-aqlgk6ni</div>
        <div class="callout">
          <span class="badge">② Select pooled</span>
          <div class="row" style="margin-bottom:14px">
            <span class="btn ghost">Direct connection</span>
            <span class="btn">Pooled connection</span>
          </div>
          <div class="field">
            <label>Connection string</label>
            <input class="input hl" readonly value="postgresql://neondb_owner:••••••••@ep-proud-art-aqlgk6ni-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require"/>
          </div>
          <div style="margin-top:10px"><span class="btn">Copy connection string</span></div>
        </div>
      </div>`,
    ),
  },
  {
    file: 'railway-01-github-deploy.png',
    html: shell(
      'Railway',
      'https://railway.app/new',
      '#a855f7',
      `
      <div class="main" style="padding:40px">
        <h1>New Project</h1>
        <div class="sub">Deploy DOJOBID API from GitHub</div>
        <div class="callout">
          <span class="badge">③ Deploy from GitHub</span>
          <div class="btn" style="margin-bottom:16px">Deploy from GitHub repo</div>
          <div class="card">
            <div class="label">Repository</div>
            <div class="value">YOUR_GITHUB_USER / ContractorBidder</div>
          </div>
          <div style="margin-top:12px"><span class="btn">Deploy Now</span></div>
        </div>
      </div>`,
    ),
  },
  {
    file: 'railway-02-build-settings.png',
    html: shell(
      'Railway',
      'https://railway.app/project/.../service/settings',
      '#a855f7',
      `
      <div class="sidebar">
        <div class="brand">ContractorBidder</div>
        <div class="nav">Deployments</div>
        <div class="nav active">Settings</div>
        <div class="nav">Variables</div>
        <div class="nav">Networking</div>
      </div>
      <div class="main">
        <div class="tabs"><div class="tab active">Build</div><div class="tab">Deploy</div></div>
        <div class="callout">
          <span class="badge">④ Build &amp; start</span>
          <div class="field"><label>Root Directory</label><input class="input" value="/ (repo root — leave blank)"/></div>
          <div class="field"><label>Build Command</label><input class="input hl" value="npm ci && npm run db:generate --workspace apps/api && npm run build --workspace apps/api"/></div>
          <div class="field"><label>Start Command</label><input class="input hl" value="npm run prisma:deploy --workspace apps/api && npm run start:prod --workspace apps/api"/></div>
        </div>
      </div>`,
    ),
  },
  {
    file: 'railway-03-variables.png',
    html: shell(
      'Railway',
      'https://railway.app/project/.../service/variables',
      '#a855f7',
      `
      <div class="sidebar">
        <div class="brand">ContractorBidder</div>
        <div class="nav">Settings</div>
        <div class="nav active">Variables</div>
        <div class="nav">Networking</div>
      </div>
      <div class="main">
        <h1>Service Variables</h1>
        <div class="callout">
          <span class="badge">⑤ Required vars</span>
          <table>
            <tr class="highlight-row"><th>DATABASE_URL</th><td>postgresql://neondb_owner:••••@ep-proud-art-aqlgk6ni-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require</td></tr>
            <tr class="highlight-row"><th>API_PORT</th><td>\${{PORT}}</td></tr>
            <tr><th>JWT_ACCESS_SECRET</th><td>••••••••••••••••</td></tr>
            <tr><th>JWT_REFRESH_SECRET</th><td>••••••••••••••••</td></tr>
            <tr><th>API_CORS_ORIGIN</th><td>https://yourdomain.com,https://www.yourdomain.com</td></tr>
          </table>
        </div>
      </div>`,
    ),
  },
  {
    file: 'railway-04-networking-domain.png',
    html: shell(
      'Railway',
      'https://railway.app/project/.../service/networking',
      '#a855f7',
      `
      <div class="sidebar">
        <div class="brand">ContractorBidder</div>
        <div class="nav">Variables</div>
        <div class="nav active">Networking</div>
      </div>
      <div class="main">
        <h1>Networking</h1>
        <div class="callout">
          <span class="badge">⑥ Custom domain</span>
          <div class="field"><label>Public domain</label><input class="input" value="dojobid-api-production.up.railway.app"/></div>
          <div class="field"><label>Custom Domain</label><input class="input hl" value="api.yourdomain.com"/></div>
          <div class="card"><div class="label">DNS CNAME target (copy for GoDaddy)</div><div class="value">dojobid-api-production.up.railway.app</div></div>
        </div>
      </div>`,
    ),
  },
  {
    file: 'railway-05-health-check.png',
    html: shell(
      'Health check',
      'https://dojobid-api-production.up.railway.app/api/v1/health',
      '#a855f7',
      `
      <div class="main" style="padding:48px">
        <div class="callout">
          <span class="badge">⑦ Verify API</span>
          <div class="json">{"status":"ok","time":"2026-06-07T21:00:00.000Z"}</div>
          <p style="margin-top:12px;color:#86efac"><span class="check">✓</span> NestJS API is live on Railway</p>
        </div>
      </div>`,
    ),
  },
  {
    file: 'vercel-01-import-project.png',
    html: shell(
      'Vercel',
      'https://vercel.com/new',
      '#ffffff',
      `
      <div class="main" style="padding:40px;background:#000;color:#fff">
        <h1>Import Git Repository</h1>
        <div class="sub">Connect ContractorBidder monorepo</div>
        <div class="callout" style="border-color:#fff">
          <span class="badge">⑧ Import repo</span>
          <div class="card" style="background:#111">
            <div class="value">GitHub · YOUR_GITHUB_USER/ContractorBidder</div>
          </div>
          <div style="margin-top:12px"><span class="btn" style="background:#fff;color:#000">Import</span></div>
        </div>
      </div>`,
    ),
  },
  {
    file: 'vercel-02-monorepo-settings.png',
    html: shell(
      'Vercel',
      'https://vercel.com/new/configure',
      '#ffffff',
      `
      <div class="main" style="padding:40px;background:#000;color:#fff">
        <h1>Configure Project</h1>
        <div class="callout" style="border-color:#fff">
          <span class="badge">⑨ Monorepo</span>
          <div class="field"><label>Framework Preset</label><input class="input" value="Next.js"/></div>
          <div class="field"><label>Root Directory</label><input class="input hl" value="apps/web"/></div>
          <div class="field"><label>Include files outside Root Directory</label><input class="input hl" value="Enabled ✓ (required for @contractor-bidder/* packages)"/></div>
        </div>
      </div>`,
    ),
  },
  {
    file: 'vercel-03-env-vars.png',
    html: shell(
      'Vercel',
      'https://vercel.com/.../settings/environment-variables',
      '#ffffff',
      `
      <div class="main" style="padding:40px;background:#000;color:#fff">
        <h1>Environment Variables</h1>
        <div class="callout" style="border-color:#fff">
          <span class="badge">⑩ Build-time API URL</span>
          <table>
            <tr><th>Name</th><th>Value</th><th>Env</th></tr>
            <tr class="highlight-row"><td>NEXT_PUBLIC_API_URL</td><td>https://api.yourdomain.com/api/v1</td><td>Production</td></tr>
          </table>
        </div>
      </div>`,
    ),
  },
  {
    file: 'vercel-04-domains.png',
    html: shell(
      'Vercel',
      'https://vercel.com/.../settings/domains',
      '#ffffff',
      `
      <div class="main" style="padding:40px;background:#000;color:#fff">
        <h1>Domains</h1>
        <div class="callout" style="border-color:#fff">
          <span class="badge">⑪ Web domains</span>
          <table>
            <tr><th>Domain</th><th>Status</th></tr>
            <tr class="highlight-row"><td>yourdomain.com</td><td>Valid Configuration</td></tr>
            <tr class="highlight-row"><td>www.yourdomain.com</td><td>Valid Configuration</td></tr>
          </table>
          <div class="card" style="margin-top:12px;background:#111">
            <div class="label">DNS records to add at GoDaddy</div>
            <div class="value">A @ → 76.76.21.21 · CNAME www → cname.vercel-dns.com</div>
          </div>
        </div>
      </div>`,
    ),
  },
  {
    file: 'godaddy-01-dns.png',
    html: shell(
      'GoDaddy DNS',
      'https://dcc.godaddy.com/manage/yourdomain.com/dns',
      '#00a4a6',
      `
      <div class="main" style="background:#fff;color:#111;padding:32px">
        <h1 style="color:#111">DNS Records</h1>
        <div class="sub" style="color:#666">yourdomain.com</div>
        <div class="callout" style="border-color:#00a4a6">
          <span class="badge">⑫ Point traffic</span>
          <table style="color:#111">
            <tr><th>Type</th><th>Name</th><th>Value</th></tr>
            <tr class="highlight-row"><td>A</td><td>@</td><td>76.76.21.21 (Vercel)</td></tr>
            <tr class="highlight-row"><td>CNAME</td><td>www</td><td>cname.vercel-dns.com</td></tr>
            <tr class="highlight-row"><td>CNAME</td><td>api</td><td>dojobid-api-production.up.railway.app</td></tr>
          </table>
        </div>
      </div>`,
    ),
  },
  {
    file: 'verify-01-browser-health.png',
    html: shell(
      'Production verify',
      'https://api.yourdomain.com/api/v1/health',
      '#2563eb',
      `
      <div class="main" style="padding:48px">
        <div class="callout">
          <span class="badge">⑬ Smoke test</span>
          <div class="json">{"status":"ok","time":"2026-06-07T21:00:00.000Z"}</div>
          <p style="margin-top:10px">Custom domain + SSL working</p>
        </div>
      </div>`,
    ),
  },
  {
    file: 'verify-02-devtools-network.png',
    html: shell(
      'Vercel web',
      'https://yourdomain.com',
      '#2563eb',
      `
      <div class="main">
        <div class="tabs"><div class="tab active">Network</div><div class="tab">Console</div></div>
        <div class="callout">
          <span class="badge">⑭ No localhost calls</span>
          <table>
            <tr><th>Name</th><th>Status</th><th>Domain</th></tr>
            <tr class="highlight-row"><td>health</td><td>200</td><td>api.yourdomain.com</td></tr>
            <tr class="highlight-row"><td>login</td><td>200</td><td>api.yourdomain.com</td></tr>
            <tr class="highlight-row"><td>jobs</td><td>200</td><td>api.yourdomain.com</td></tr>
          </table>
          <p style="margin-top:10px;color:#86efac"><span class="check">✓</span> NEXT_PUBLIC_API_URL is correct</p>
        </div>
      </div>`,
    ),
  },
];

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 2 });

  for (const shot of SHOTS) {
    await page.setContent(shot.html, { waitUntil: 'domcontentloaded' });
    const out = join(OUT_DIR, shot.file);
    await page.screenshot({ path: out, type: 'png', fullPage: true });
    console.log(`Wrote ${out}`);
  }
} finally {
  await browser.close();
}
