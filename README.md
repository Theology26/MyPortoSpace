# 🌌 MyPortoSpace — Full-Stack 3D Interactive Portfolio & CMS

> **Live Portfolio of Yosia Gracetheo Boimau (@Theology26)**  
> *Full-Stack Systems Builder • Video Editor • Virtual Jockey (VJ)*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-3D%20WebGL-black.svg)](https://threejs.org/)
[![Vercel Ready](https://img.shields.io/badge/Vercel-Serverless%20Ready-black.svg)](https://vercel.com/)

---

## ✨ Features & Architecture

- **🪐 3D WebGL Space Universe**:
  - Photorealistic Earth 3D globe with atmospheric Rayleigh scattering shaders and day/night city lights.
  - Realistic orbital satellite telemetry powered by NASA & Space agency models (CALIPSO, CloudSat, Deep Space 1, IBEX, LLCD, Space Systems Loral SSL-1300).
- **🪪 Physics-Driven Interactive Lanyard Pass**:
  - Drag, fling, and spring physics simulation with real-time rubber tensor curves.
- **⚡ Automated GitHub Telemetry & Live Sync**:
  - Dynamic byte-level language percentage breakdown across all repositories.
  - Real-time cache in SQLite with single-click refresh button.
- **💼 Dynamic ATS CV / Resume Generator**:
  - Single-click A4 Portrait ATS-compliant CV generator (`/api/cv/download`) that automatically aggregates GitHub repositories, career experiences, and verified credentials.
- **🛠️ Secured SQLite Admin Dashboard (`/admin`)**:
  - Full CRUD control over hero headings, tech tags, lanyard pass telemetry, credentials, gallery, and space environment parameters.
- **🚀 Vercel Serverless Ready**:
  - Pre-configured `vercel.json` and serverless Express handler with `/tmp` database resiliency.

---

## 🛠️ Tech Stack

- **Frontend**: React 18 (precompiled JSX), Three.js WebGL, Tailwind CSS (static build), Canvas API
- **Backend**: Node.js, Express 5, SQLite3 / JSON-store resilient fallback
- **Architecture**: Layered — `repositories` → `services` → routes, with security concerns isolated in `src/security/`
- **Deployment**: Vercel Serverless Function & Standalone Node.js

---

## ⚡ Performance

First-load critical path is **~41 KB over the wire** (brotli), served from
`localhost` in this repo's test environment:

| Resource | Size (brotli) |
|----------|---------------|
| `index.html` | 2.9 KB |
| `tailwind.css` | 6.5 KB |
| `app.js` | 27 KB |
| `/api/content` | 4.2 KB |

What made this fast:

- **JSX is precompiled** at build time. Babel Standalone (~2.9 MB) is gone, and
  the browser no longer transpiles 159 KB of JSX on every load.
- **Tailwind is a static stylesheet** (43 KB → 6.5 KB brotli). The Play CDN's
  runtime CSS compiler no longer scans the DOM on load.
- **Brotli + gzip compression** on every response via `compression`.
- **Immutable caching** on `/Assets` (30d) and `public/` bundles (7d).
- **Editor backups removed** from the public asset directory: 75.8 MB → 9.5 MB.
  A 66 MB `earth_globe.original.glb` backup was being served publicly at
  `/Assets/earth_globe.original.glb`; it now lives in `_backup_assets/`.
- **3D models are idle-deferred.** The ~4.2 MB Earth GLB and ~4.5 MB of
  satellites only download once the browser is idle, and are skipped entirely
  on low-spec devices. A procedural Earth already renders underneath, so the
  page is visually complete without them.
- **Eco Mode is the mobile default** (auto-enabled under 768px), which skips
  WebGL entirely in favour of a CSS starfield.

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/Theology26/MyPortoSpace.git
cd MyPortoSpace
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment
```bash
cp .env.example .env
```
Set `ADMIN_PASSCODE` to a long random string. **Required on Vercel** — serverless
`/tmp` storage is not shared between instances, so without it each instance would
authenticate against different credentials.

Generate one:
```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

### 4. Build client assets
```bash
npm run build
```
Compiles the JSX in `src/client/*.jsx` to `public/*.js` and generates the static
Tailwind stylesheets. Re-run this after editing any component.

### 5. Run development server
```bash
node server.js
```
Open [http://localhost:3000](http://localhost:3000) to view the portfolio.

---

## 🔐 Security Model

| Concern | Implementation |
|---------|----------------|
| Admin auth | Passcode resolved from `ADMIN_PASSCODE`, else a scrypt hash in the `security` DB section. Legacy plaintext is hashed on first successful login, then scrubbed. |
| Sessions | Login returns a short-lived HMAC-signed token, never the passcode. All comparisons use `timingSafeEqual`. |
| Secret exposure | `adminPasscode` and `githubToken` are stripped from every public response by `ContentService.toPublic()`. |
| Write endpoints | `PUT /api/content` and `POST /api/github/sync` require a valid admin token. |
| Brute force | Per-IP sliding-window limits. `X-Forwarded-For` is ignored unless `TRUST_PROXY=1`. |
| Injection | Prototype-pollution keys stripped recursively; all HTML interpolated through an escaping sanitizer; URL allowlist rejects `javascript:`/`data:`. |
| Headers | CSP, `frame-ancestors 'none'`, `nosniff`, COOP, HSTS in production, `x-powered-by` disabled. |
| CORS | Same-origin only. Cross-origin reads require explicit `CORS_ORIGINS`. |
| Bodies | 256 KB cap (was 10 MB). |

### Tests
```bash
npm test                 # 41 unit + 28 live security assertions
npm run test:upload      # 12 image-upload assertions
npm run test:certs       #  6 certificate integrity assertions
npm run test:cta         #  4 CTA rendering assertions
npm run test:render      # 13 headless-Chrome render checks (mobile + desktop)
npm run audit:secrets    # 31 public-exposure probes
npm run test:leak        # 29 canary leak probes
```

> `npm test` deliberately does **not** trip the login lockout. To verify brute-force
> protection, run `TEST_LOCKOUT=1 node test_live.js` — it will lock your IP for 15 min.

---

## 🔐 Secret Exposure

`ContentService.toPublic()` uses an **allowlist**, not a blocklist: only sections
the frontend actually reads are exposed, and secret-looking keys are stripped at
every depth. Adding a new secret-bearing field later therefore cannot silently
start leaking through `/api/content`.

Verified two ways:

- `npm run audit:secrets` — probes every public route and served file for
  PATs, API keys, JWTs, private keys, and passcode/hash material, then
  asserts sensitive files (`.env`, `database.sqlite`, `db.js`, `.git/`) are
  unreachable.
- `npm run test:leak` — plants uniquely-identifiable canaries into the database,
  proves none appear in any public response (including error responses), then
  restores the original content and re-scans.

---

## 🖼️ Image Uploads

Admin images are **not** stored as base64 in the content JSON. The client POSTs
the file to `POST /api/upload` (multipart, field name `image`), the server writes
it to `Assets/uploads/` with a random filename, and only the resulting URL is
stored in the content.

Why this matters: base64 inflates payloads ~33%, and the content JSON is served
by the **public, cached** `/api/content` endpoint. A dozen certificate photos
would have added tens of megabytes to every visitor's page load.

| Guard | Value |
|-------|-------|
| Max file size | 5 MB |
| Accepted types | JPEG, PNG, WebP, GIF, AVIF, SVG |
| Filename | Random on disk; client filename never trusted |
| Auth | Admin bearer token required |
| Rate limit | 20 uploads / 10 min |
| Serving | `/Assets/uploads/...` with 30-day immutable cache |

---

## ☁️ Deploying to Vercel

1. Push this repository to GitHub (`Theology26/MyPortoSpace`).
2. Log in to [Vercel](https://vercel.com/) and click **"New Project"**.
3. Import the `MyPortoSpace` repository.
4. Click **Deploy**! No extra configuration required — `vercel.json` and `api/index.js` handle everything out of the box.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) © 2025 Yosia Gracetheo Boimau.
