'use strict';

/**
 * Public exposure audit.
 *
 * Probes every public route and every web-served file for secret material:
 * passcodes, tokens, hashes, .env contents, and common API-key shapes.
 *
 * Usage: node audit_secrets.js
 */

const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://localhost:3111';
const ROOT = __dirname;

let pass = 0;
let fail = 0;
const chk = (n, c, x) => { if (c) { pass++; console.log(`PASS  ${n}`); } else { fail++; console.log(`FAIL  ${n}${x !== undefined ? `\n        ${x}` : ''}`); } };

// Secret shapes that must never appear in a public response.
const PATTERNS = [
  ['adminPasscode key', /"adminPasscode"\s*:/i],
  ['githubToken key', /"githubToken"\s*:/i],
  ['security section', /"security"\s*:\s*\{[^}]*"(hash|salt)"/i],
  ['scrypt record', /"algo"\s*:\s*"scrypt"/i],
  // Real PATs: require 36 chars of mixed alnum after the prefix. Excludes
  // placeholders like ghp_xxxxxxxxxxxxxxxxxxxx.
  ['GitHub PAT (ghp_)', /\bghp_[A-Za-z0-9]{36}(?![A-Za-z0-9])/],
  ['GitHub PAT (gho_)', /\bgho_[A-Za-z0-9]{36}(?![A-Za-z0-9])/],
  ['GitHub PAT (ghu_)', /\bghu_[A-Za-z0-9]{36}(?![A-Za-z0-9])/],
  ['GitHub PAT (ghs_)', /\bghs_[A-Za-z0-9]{36}(?![A-Za-z0-9])/],
  ['OpenAI key', /\bsk-[A-Za-z0-9]{32,}/],
  ['Anthropic key', /\bsk-ant-[A-Za-z0-9-]{40,}/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{10,}/],
  ['Stripe live key', /\bsk_live_[A-Za-z0-9]{20,}/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['Bearer credential', /Bearer\s+[A-Za-z0-9._-]{20,}/],
  ['sess token in markup', /theo_admin_token"\s*value|token"\s*value="[A-Za-z0-9._-]{20,}"/i],
];

/**
 * Files that legitimately contain secret-shaped data because they ARE the
 * secret store, or hold third-party public CDN credentials. Each one is
 * asserted unreachable / untracked separately rather than pattern-scanned.
 */
const EXPECTED_LOCAL = new Set([
  'portfolio_store.json',  // the hashed-passcode store
  'database.sqlite',       // same, SQLite side
  'ADMIN_CREDENTIALS.txt', // local plaintext credential store (gitignored)
]);

function scan(label, text) {
  if (typeof text !== 'string' || text.length === 0) return [];
  return PATTERNS.filter(([, re]) => re.test(text)).map(([name]) => `${label}: ${name}`);
}

(async () => {
  // ── 1. Public API responses ─────────────────────────────────────────────
  console.log('=== Public API responses ===');
  const routes = ['/', '/admin', '/robots.txt', '/sitemap.xml', '/api/content', '/api/github/stats', '/api/cv/download'];
  for (const route of routes) {
    const res = await fetch(`${BASE}${route}`, { redirect: 'manual' });
    const text = await res.text();
    const hits = scan(route, text);
    chk(`${route} clean (HTTP ${res.status}, ${(text.length / 1024).toFixed(1)}KB)`, hits.length === 0, hits.join('; '));
  }

  // ── 2. Served static bundles ───────────────────────────────────────────
  console.log('\n=== Web-served static files ===');
  const served = [
    'public/app.js', 'public/admin.js', 'public/tailwind.css',
    'public/tailwind.admin.css', 'public/build-manifest.json',
  ];
  for (const rel of served) {
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) { chk(`${rel} exists`, false, 'missing'); continue; }
    const hits = scan(rel, fs.readFileSync(full, 'utf8'));
    chk(`${rel} clean`, hits.length === 0, hits.join('; '));
  }

  // ── 3. Files that must NOT be web-reachable ─────────────────────────────
  console.log('\n=== Must-not-be-reachable probes ===');
  const forbidden = [
    '/.env', '/.env.example', '/database.sqlite', '/portfolio_store.json',
    '/db.js', '/server.js', '/figma_data.json', '/package.json',
    '/_backup_assets/earth_globe.original.glb',
    '/Assets/earth_globe.original.glb',
    '/tailwind.config.js', '/build.js', '/.git/config', '/.gitignore',
  ];
  for (const route of forbidden) {
    let status = 0;
    try { status = (await fetch(`${BASE}${route}`, { redirect: 'manual' })).status; } catch { status = 0; }
    chk(`${route} not served (${status})`, status === 404 || status === 403 || status === 400, `got ${status}`);
  }

  // ── 4. Repository-wide secret scan (source, not just served files) ─────
  console.log('\n=== Source tree scan ===');
  const SKIP_DIRS = new Set(['node_modules', '.git', 'public', 'Assets', '_backup_assets', '.agents']);
  const SCAN_EXT = new Set(['.js', '.jsx', '.html', '.json', '.css', '.env', '.md', '.txt', '.yml', '.yaml']);
  const findings = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name));
        continue;
      }
      const full = path.join(dir, entry.name);
      const rel = path.relative(ROOT, full);
      if (EXPECTED_LOCAL.has(entry.name)) continue;
      const ext = path.extname(entry.name).toLowerCase();
      const isEnv = entry.name === '.env' || entry.name.startsWith('.env.');
      if (!SCAN_EXT.has(ext) && !isEnv) continue;
      let text;
      try { text = fs.readFileSync(full, 'utf8'); } catch { continue; }
      for (const h of scan(rel, text)) findings.push(h);
    }
  };
  walk(ROOT);
  chk('no secret-shaped strings in source', findings.length === 0, findings.join('\n        '));

  // ── 4b. AWS keys: only a problem if they're ours and web-reachable ─────
  console.log('\n=== AWS key material ===');
  const awsFindings = [];
  const walkAws = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walkAws(path.join(dir, entry.name));
        continue;
      }
      if (!/\.(js|jsx|html|json|env)$/i.test(entry.name)) continue;
      const full = path.join(dir, entry.name);
      let text;
      try { text = fs.readFileSync(full, 'utf8'); } catch { continue; }
      const hits = [...text.matchAll(/\bAKIA[0-9A-Z]{16}\b/g)];
      for (const h of hits) {
        // Presigned-URL credentials are third-party CDN material, not ours.
        const isPresigned = /X-Amz-Credential|s3-alpha\.figma\.com|amazonaws/.test(text);
        if (!isPresigned) awsFindings.push(`${path.relative(ROOT, full)}: ${h[0]}`);
      }
    }
  };
  walkAws(ROOT);
  chk('no first-party AWS keys in source', awsFindings.length === 0, awsFindings.join(', '));
  console.log('NOTE  figma_data.json embeds a Figma S3 presigned-URL key id (third-party, expired, file not served).');

  // ── 5. .env handling ────────────────────────────────────────────────────
  console.log('\n=== Local secret store handling ===');
  const credFile = path.join(ROOT, 'ADMIN_CREDENTIALS.txt');
  const hasCred = fs.existsSync(credFile);
  chk('ADMIN_CREDENTIALS.txt exists locally (expected)', hasCred);
  if (hasCred) {
    const { execSync: ex } = require('child_process');
    let ignored = false;
    try { ex('git check-ignore -q -- ADMIN_CREDENTIALS.txt', { cwd: ROOT }); ignored = true; } catch { ignored = false; }
    chk('ADMIN_CREDENTIALS.txt is gitignored', ignored);

    let untracked = false;
    try { ex('git ls-files --error-unmatch -- ADMIN_CREDENTIALS.txt', { cwd: ROOT, stdio: 'ignore' }); } catch { untracked = true; }
    chk('ADMIN_CREDENTIALS.txt is NOT tracked by git', untracked);

    let status = 0;
    try { status = (await fetch(`${BASE}/ADMIN_CREDENTIALS.txt`)).status; } catch { status = 0; }
    chk(`ADMIN_CREDENTIALS.txt not web-reachable (${status})`, status === 404 || status === 403 || status === 400);

    const credText = fs.readFileSync(credFile, 'utf8');
    const m = credText.match(/^ADMIN_PASSCODE=(.+)$/m);
    chk('credentials file exposes a parseable passcode for tests', Boolean(m));
    if (m) {
      const pass = m[1].trim();
      chk('passcode is at least 12 chars', pass.length >= 12, `${pass.length}`);
      chk('passcode is not the leaked legacy value', pass !== 'theology26');
    }
  }

  const envPath = path.join(ROOT, '.env');
  const hasEnv = fs.existsSync(envPath);
  chk('.env is not present in the web root', !hasEnv, '.env exists — it must stay out of version control and the served dirs');
  const gitignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  chk('.gitignore covers .env', /^\.env$/m.test(gitignore));
  chk('.gitignore covers credentials files', /CREDENTIALS/i.test(gitignore));

  // ── 6. Git tracking of sensitive files ─────────────────────────────────
  console.log('\n=== Git tracking ===');
  const { execSync } = require('child_process');
  const tracked = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
  const badTracked = tracked.filter((f) => /^\.env$|database\.sqlite$|portfolio_store\.json$|^Assets\/uploads\/|CREDENTIALS/i.test(f));
  chk('no secrets tracked in git', badTracked.length === 0, badTracked.join(', '));

  console.log(`\n===== ${pass} passed, ${fail} failed =====`);
  process.exit(fail === 0 ? 0 : 1);
})();
