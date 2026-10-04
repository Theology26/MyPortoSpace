'use strict';

/** Confirms the certificate image actually renders on the public portfolio. */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE || 'http://localhost:3111';
const PORT = 9224;

const getJson = (u) => new Promise((res, rej) => {
  http.get(u, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej);
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${path.join(process.env.TEMP, 'opencode', 'chrome-cert')}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    try { target = (await getJson(`http://127.0.0.1:${PORT}/json/list`)).find((t) => t.type === 'page'); if (target) break; } catch {}
  }
  if (!target) { console.log('FAIL  chrome attach'); chrome.kill(); process.exit(1); }

  const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
  let id = 0; const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });
  ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()); } catch { return; } if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } });
  await new Promise((r) => ws.on('open', r));
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${BASE}/` });
  await sleep(9000);

  const p = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const imgs = [...document.querySelectorAll('img')].filter(i => /\\/Assets\\/uploads\\//.test(i.src));
      return {
        count: imgs.length,
        details: imgs.map(i => ({
          src: i.getAttribute('src'),
          complete: i.complete,
          w: i.naturalWidth, h: i.naturalHeight,
        })),
        onPage: imgs.map(i => i.getBoundingClientRect().width > 0),
      };
    })()`,
  });

  const r = p.result.value || {};
  let pass = 0, fail = 0;
  const chk = (n, c, x) => { if (c) { pass++; console.log(`PASS  ${n}`); } else { fail++; console.log(`FAIL  ${n}${x !== undefined ? `  (${x})` : ''}`); } };

  console.log('=== Certificate image render ===');
  r.details.forEach((d) => console.log(`      ${d.src}  ${d.w}x${d.h}  complete=${d.complete}`));
  chk('uploaded image present in DOM', r.count > 0, r.count);
  chk('image decoded (naturalWidth > 0)', r.details.every((d) => d.w > 0), JSON.stringify(r.details.map((d) => d.w)));
  chk('image has layout width', r.onPage.length > 0 && r.onPage.some(Boolean));

  console.log(`\n===== ${pass} passed, ${fail} failed =====`);
  ws.close(); chrome.kill();
  process.exit(fail === 0 ? 0 : 1);
})();
