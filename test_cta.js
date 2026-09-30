'use strict';

/** Verifies CTA button labels don't render duplicate arrow glyphs. */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE || 'http://localhost:3111';
const PORT = 9223;

const getJson = (url) => new Promise((res, rej) => {
  http.get(url, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej);
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${path.join(process.env.TEMP, 'opencode', 'chrome-cta')}`,
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
  await sleep(8000);

  const p = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const arrowRe = /[\\u2190-\\u21FF\\u25B2-\\u25BF\\u27F2-\\u27FF\\u2B00-\\u2B1F]/u;
      const out = [];
      for (const a of document.querySelectorAll('a')) {
        const label = (a.innerText || '').trim();
        if (!/explore/i.test(label)) continue;
        const arrowsInText = (label.match(new RegExp(arrowRe.source, 'gu')) || []).length;
        const svgs = a.querySelectorAll('svg').length;
        out.push({ label, arrowsInText, svgs, totalArrows: arrowsInText + svgs });
      }
      return out;
    })()`,
  });

  const rows = p.result.value || [];
  let pass = 0, fail = 0;
  const chk = (n, c, x) => { if (c) { pass++; console.log(`PASS  ${n}`); } else { fail++; console.log(`FAIL  ${n}  ${x}`); } };

  console.log('=== Explore CTA arrow check ===');
  rows.forEach((r) => console.log(`      label="${r.label}" textArrows=${r.arrowsInText} svgArrows=${r.svgs}`));
  chk('found the Explore CTA', rows.length > 0, 'none found');
  chk('no arrow glyph left in the text', rows.every((r) => r.arrowsInText === 0), JSON.stringify(rows.map((r) => r.arrowsInText)));
  chk('exactly one arrow renders (the SVG)', rows.every((r) => r.totalArrows === 1), JSON.stringify(rows.map((r) => r.totalArrows)));
  chk('label text intact', rows.some((r) => /Explore Portfolio/i.test(r.label)), JSON.stringify(rows.map((r) => r.label)));

  console.log(`\n===== ${pass} passed, ${fail} failed =====`);
  ws.close(); chrome.kill();
  process.exit(fail === 0 ? 0 : 1);
})();
