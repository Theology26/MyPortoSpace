'use strict';

/** End-to-end test for the admin image upload pipeline. */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { resolvePasscode } = require('./test/helpers/passcode');
const BASE = process.env.BASE || 'http://localhost:3111';
const PASSCODE = resolvePasscode();

let pass = 0;
let fail = 0;
const chk = (n, c, x) => { if (c) { pass++; console.log(`PASS  ${n}`); } else { fail++; console.log(`FAIL  ${n}${x !== undefined ? `  (${x})` : ''}`); } };

// Minimal valid 1x1 PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

function multipart(fieldName, filename, contentType, buffer) {
  const boundary = `----test${crypto.randomBytes(8).toString('hex')}`;
  const head =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
    `Content-Type: ${contentType}\r\n\r\n`;
  const body = Buffer.concat([Buffer.from(head), buffer, Buffer.from(`\r\n--${boundary}--\r\n`)]);
  return { boundary, body };
}

(async () => {
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode: PASSCODE }),
  }).then((r) => r.json());

  if (!login.token) { console.log('FAIL  could not log in — restart the server if IP-locked'); process.exit(1); }
  const auth = { Authorization: `Bearer ${login.token}` };

  console.log('=== Upload auth ===');
  const anon = await fetch(`${BASE}/api/upload`, { method: 'POST', body: (() => {
    const m = multipart('image', 'x.png', 'image/png', PNG); return m.body;
  })() });
  chk('anonymous upload rejected', anon.status === 401, anon.status);

  console.log('\n=== Happy path ===');
  const m1 = multipart('image', 'cert.png', 'image/png', PNG);
  const up = await fetch(`${BASE}/api/upload`, {
    method: 'POST', headers: { ...auth, 'Content-Type': `multipart/form-data; boundary=${m1.boundary}` }, body: m1.body,
  });
  const upJson = await up.json().catch(() => ({}));
  chk('upload returns 200', up.status === 200, `${up.status} ${JSON.stringify(upJson)}`);
  chk('returns a /Assets/uploads/ URL', /^\/Assets\/uploads\/[\w-]+\.png$/.test(upJson.url || ''), upJson.url);

  const fetched = await fetch(`${BASE}${upJson.url}`);
  chk('uploaded file is publicly served', fetched.status === 200, fetched.status);
  chk('served with immutable cache', (fetched.headers.get('cache-control') || '').includes('immutable'), fetched.headers.get('cache-control'));
  chk('served as image/png', (fetched.headers.get('content-type') || '').includes('image/png'), fetched.headers.get('content-type'));

  console.log('\n=== Filename safety ===');
  const evil = multipart('image', '../../../evil.png', 'image/png', PNG);
  const up2 = await fetch(`${BASE}/api/upload`, {
    method: 'POST', headers: { ...auth, 'Content-Type': `multipart/form-data; boundary=${evil.boundary}` }, body: evil.body,
  });
  const up2Json = await up2.json().catch(() => ({}));
  chk('path traversal in filename neutralised', /^\/Assets\/uploads\/[\w-]+\.png$/.test(up2Json.url || ''), up2Json.url);
  chk('no traversal segments in stored URL', !(up2Json.url || '').includes('..'), up2Json.url);

  console.log('\n=== Type + size rejection ===');
  const bad = multipart('image', 'x.exe', 'application/x-msdownload', Buffer.from('MZ'));
  const up3 = await fetch(`${BASE}/api/upload`, {
    method: 'POST', headers: { ...auth, 'Content-Type': `multipart/form-data; boundary=${bad.boundary}` }, body: bad.body,
  });
  chk('non-image rejected (415)', up3.status === 415, up3.status);

  const huge = multipart('image', 'big.png', 'image/png', Buffer.alloc(6 * 1024 * 1024, 1));
  const up4 = await fetch(`${BASE}/api/upload`, {
    method: 'POST', headers: { ...auth, 'Content-Type': `multipart/form-data; boundary=${huge.boundary}` }, body: huge.body,
  });
  chk('oversized image rejected (413)', up4.status === 413, up4.status);

  console.log('\n=== Content JSON stays small (no base64 bloat) ===');
  const content = await fetch(`${BASE}/api/content`).then((r) => r.json());
  const json = JSON.stringify(content);
  chk('/api/content has no data: image', !json.includes('data:image'), 'base64 found');
  chk('/api/content is under 200KB', json.length < 200 * 1024, `${Math.round(json.length / 1024)}KB`);

  // Remove files this run created so repeated runs don't litter the upload dir.
  const fs = require('fs');
  const path = require('path');
  const uploadDir = path.join(__dirname, 'Assets', 'uploads');
  for (const url of [upJson.url, up2Json.url]) {
    if (!url) continue;
    try { fs.unlinkSync(path.join(uploadDir, path.basename(url))); } catch {}
  }

  console.log(`\n===== ${pass} passed, ${fail} failed =====`);
  process.exit(fail === 0 ? 0 : 1);
})();
