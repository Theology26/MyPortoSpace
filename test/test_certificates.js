'use strict';

/** Verifies every locally-stored certificate image decodes and renders. */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE || 'http://localhost:3111';
const PORT = 9226;

const getJson = (u) => new Promise((res, rej) => {
  http.get(u, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej);
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const content = await fetch(`${BASE}/api/content`).then((r) => r.json());
  const certs = content.data.certificatesList || [];
  const local = certs.filter((c) => /\/Assets\/uploads\//.test(c.imageUrl || ''));

  // Every referenced upload must still exist on disk.
  const uploadDir = path.join(__dirname, '..', 'Assets', 'uploads');
  const onDisk = new Set(fs.readdirSync(uploadDir));
  const missing = local.filter((c) => !onDisk.has(path.basename(c.imageUrl)));

  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${path.join(require('os').tmpdir(), 'opencode', 'chrome-certs')}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu',
    '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    try { target = (await getJson(`http://127.0.0.1:${PORT}/json/list`)).find((t) => t.type === 'page'); if (target) break; } catch {}
  }
  if (!target) { console.log('FAIL  chrome attach'); chrome.kill(); process.exit(1); }

  const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
  let id = 0; const pending = new Map();
  const send = (m, p = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()); } catch { return; } if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } });
  await new Promise((r) => ws.on('open', r));
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${BASE}/` });
  await sleep(5000);

  // Scroll the whole page so lazy-loaded certificate images actually fetch,
  // then return to the top before measuring.
  await send('Runtime.evaluate', {
    awaitPromise: true,
    expression: `(async () => {
      const step = window.innerHeight * 0.8;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 220));
      }
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(r => setTimeout(r, 900));
      window.scrollTo(0, 0);
      await new Promise(r => setTimeout(r, 400));
    })()`,
  });
  await sleep(2500);

  const p = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const imgs = [...document.querySelectorAll('img')].filter(i => /\\/Assets\\/uploads\\//.test(i.src));
      return { total: imgs.length, broken: imgs.filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src) };
    })()`,
  });
  const r = p.result.value || {};

  let pass = 0, fail = 0;
  const chk = (n, c, x) => { if (c) { pass++; console.log(`PASS  ${n}`); } else { fail++; console.log(`FAIL  ${n}${x !== undefined ? `  (${x})` : ''}`); } };

  console.log(`=== Certificates (${certs.length} total, ${local.length} local) ===`);
  certs.forEach((c, i) => console.log(`  ${String(i + 1).padStart(2)}. ${/uploads/.test(c.imageUrl) ? '[LOCAL]' : '[web]  '} ${c.title}`));

  console.log('\n=== Integrity ===');
  chk('no missing files on disk', missing.length === 0, missing.map((c) => c.imageUrl).join(','));
  chk('all local certs rendered in DOM', r.total >= local.length, `${r.total} img vs ${local.length} certs`);
  chk('no broken images', r.broken.length === 0, r.broken.join(','));
  chk('Bachelor entry preserved', certs.some((c) => /Bachelor of Computer Science/i.test(c.title)));
  chk('NVIDIA entry present', certs.some((c) => /NVIDIA/i.test(c.title)));
  chk('no base64 in content JSON', !JSON.stringify(content).includes('data:image'));

  console.log(`\n===== ${pass} passed, ${fail} failed =====`);
  ws.close(); chrome.kill();
  process.exit(fail === 0 ? 0 : 1);
})();
