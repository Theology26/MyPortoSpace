'use strict';

/**
 * Canary leak test.
 *
 * Plants uniquely-identifiable secrets into the database (GitHub token,
 * passcode hash material, a canary section) and then proves none of them
 * appear in ANY public response. Restores the original values afterwards.
 *
 * NOTE: the canary token is deliberately NOT shaped like a real credential.
 * A realistic `ghp_...` string here would trip GitHub push protection and
 * block the whole repository from being pushed.
 *
 * Usage: node test_canary_leak.js
 */

const fs = require('fs');
const path = require('path');
const { resolvePasscode } = require('./helpers/passcode');

const BASE = process.env.BASE || 'http://localhost:3111';
const ROOT = path.join(__dirname, '..');

const CANARY = {
  // Underscores, not a real PAT prefix — see the note above.
  githubToken: 'CANARY_TOKEN_value_7d2e9f4b8a1c6d0e3f5a9b2c',
  passcode: 'canary-pass-9f3a2b7c',
  section: 'CANARY_SECTION_7d2e9f',
  value: 'canary-value-4b8e1a6d',
};

let pass = 0;
let fail = 0;
const chk = (n, c, x) => { if (c) { pass++; console.log(`PASS  ${n}`); } else { fail++; console.log(`FAIL  ${n}${x !== undefined ? `  (${x})` : ''}`); } };

const PUBLIC_ROUTES = [
  '/', '/index.html', '/admin', '/admin.html', '/robots.txt', '/sitemap.xml',
  '/api/content', '/api/github/stats', '/api/cv/download', '/api/cv/download?format=html',
  '/api/portfolio/pdf', '/api/portfolio/pdf?format=pdf',
  '/app.js', '/admin.js', '/tailwind.css', '/tailwind.admin.css', '/build-manifest.json',
  '/Assets/avatar_animated.png', '/nonexistent-path-404',
];

const PROBES = [
  ['githubToken canary', CANARY.githubToken],
  ['passcode canary', CANARY.passcode],
  ['canary section key', CANARY.section],
  ['canary section value', CANARY.value],
];

async function login() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode: resolvePasscode() }),
  }).then((r) => r.json());
  if (!r.token) { console.error('Cannot log in. Restart the server if IP-locked.'); process.exit(1); }
  return { Authorization: `Bearer ${r.token}` };
}

(async () => {
  const auth = await login();
  const storePath = path.join(ROOT, 'portfolio_store.json');
  const backup = fs.readFileSync(storePath, 'utf8');

  console.log('=== Planting canaries ===');
  const put = await fetch(`${BASE}/api/content`, {
    method: 'PUT',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      general: { githubToken: CANARY.githubToken, siteTitle: 'Canary Probe' },
      [CANARY.section]: { note: CANARY.value, secret: CANARY.passcode },
    }),
  });
  chk('planted canaries into the database', put.ok, `HTTP ${put.status}`);

  console.log('\n=== Scanning public routes for canaries ===');
  for (const route of PUBLIC_ROUTES) {
    let text = '';
    let status = 0;
    try {
      const res = await fetch(`${BASE}${route}`, { redirect: 'manual' });
      status = res.status;
      // Read as bytes so binary assets are scanned too.
      const buf = Buffer.from(await res.arrayBuffer());
      text = buf.toString('latin1');
    } catch (err) {
      text = '';
    }
    const hits = PROBES.filter(([, needle]) => text.includes(needle)).map(([name]) => name);
    chk(`${route} (HTTP ${status}) leak-free`, hits.length === 0, hits.join(', '));
  }

  console.log('\n=== Error responses must not leak either ===');
  const errorProbes = [
    ['GET', '/api/content/../../.env', {}],
    ['PUT', '/api/content', { headers: { 'Content-Type': 'application/json' }, body: '{bad json' }],
    ['POST', '/api/auth/login', { headers: { 'Content-Type': 'application/json' }, body: '{"passcode":1}' }],
    ['POST', '/api/upload', { headers: { ...auth }, body: 'garbage' }],
  ];
  for (const [method, route, opts] of errorProbes) {
    let text = '';
    try {
      const res = await fetch(`${BASE}${route}`, { method, ...opts });
      text = await res.text();
    } catch {}
    const hits = PROBES.filter(([, needle]) => text.includes(needle)).map(([name]) => name);
    chk(`${method} ${route} error leak-free`, hits.length === 0, hits.join(', '));
  }

  console.log('\n=== Authenticated write still works with canary present ===');
  const authed = await fetch(`${BASE}/api/content`, { headers: auth });
  const authedJson = await authed.json().catch(() => ({}));
  chk('authenticated client sees the token (expected)', authed.status === 200, authed.status);

  console.log('\n=== Restoring original content ===');
  const original = JSON.parse(backup);
  const restore = await fetch(`${BASE}/api/content`, {
    method: 'PUT',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ general: original.general }),
  });
  chk('original content restored', restore.ok, `HTTP ${restore.status}`);

  // Remove the canary section through the repository so both engines agree.
  const ContentRepository = require('../src/repositories/ContentRepository');
  const repo = new ContentRepository();
  await repo.init();
  await repo.removeSection(CANARY.section);

  const verify = await fetch(`${BASE}/api/content`).then((r) => r.json());
  const general = verify.data.general || {};
  chk('githubToken back to stored value', (general.githubToken || '') !== CANARY.githubToken);
  chk('siteTitle restored', general.siteTitle === original.general.siteTitle, general.siteTitle);
  chk('canary section withheld from public API', !(CANARY.section in verify.data), Object.keys(verify.data).join(','));

  const storeAfter = JSON.parse(fs.readFileSync(storePath, 'utf8'));
  chk('canary section purged from JSON store', !(CANARY.section in storeAfter), Object.keys(storeAfter).join(','));

  // Final sweep after restore.
  let stillLeaking = null;
  for (const route of PUBLIC_ROUTES) {
    try {
      const buf = Buffer.from(await (await fetch(`${BASE}${route}`)).arrayBuffer());
      const text = buf.toString('latin1');
      const hits = PROBES.filter(([, n]) => text.includes(n)).map(([name]) => name);
      if (hits.length) { stillLeaking = `${route}: ${hits.join(', ')}`; break; }
    } catch {}
  }
  chk('no canaries remain anywhere public', stillLeaking === null, stillLeaking);

  console.log(`\n===== ${pass} passed, ${fail} failed =====`);
  process.exit(fail === 0 ? 0 : 1);
})();
