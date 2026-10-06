'use strict';

/**
 * Renders /api/portfolio/pdf in headless Chrome and screenshots each page,
 * so the layout can actually be looked at instead of assumed.
 */

const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE || 'http://127.0.0.1:3111';
const PORT = 9341;
const OUT = path.join(__dirname, 'shots');

const getJson = (url) => new Promise((res, rej) => {
  http.get(url, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej);
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const res = await fetch(`${BASE}/api/portfolio/pdf?cb=${Date.now()}`);
  const html = await res.text();
  console.log('HTTP', res.status, '|', res.headers.get('content-disposition'));
  console.log('bytes:', html.length);
  console.log('page sections:', (html.match(/class="page"/g) || []).length);
  console.log('github refs  :', (html.match(/github\.com\/Theology26/g) || []).length);

  fs.mkdirSync(OUT, { recursive: true });

  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${path.join(process.env.TEMP, 'opencode', 'chrome-pdf')}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    try { target = (await getJson(`http://127.0.0.1:${PORT}/json/list`)).find((t) => t.type === 'page'); if (target) break; } catch {}
  }
  if (!target) { console.log('could not attach'); chrome.kill(); process.exit(1); }

  const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 64 * 1024 * 1024 });
  let id = 0; const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });
  ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()); } catch { return; } if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } });

  await new Promise((r) => ws.on('open', r));
  await send('Page.enable'); await send('Runtime.enable');
  // A4 at ~96dpi.
  await send('Emulation.setDeviceMetricsOverride', { width: 794, height: 1123, deviceScaleFactor: 1.5, mobile: false });
  await send('Page.navigate', { url: `${BASE}/api/portfolio/pdf?cb=${Date.now()}` });
  await sleep(7000);

  const count = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      document.querySelector('.toolbar').style.display = 'none';
      const pages = [...document.querySelectorAll('.page')];
      pages.forEach(p => { p.style.boxShadow = 'none'; p.style.margin = '0'; });
      window.scrollTo(0, 0);
      return pages.length;
    })()`,
  });
  const n = count.result.value || 0;
  console.log('pages found in DOM:', n);

  for (let i = 0; i < n; i++) {
    const box = await send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const p = document.querySelectorAll('.page')[${i}];
        p.scrollIntoView();
        const r = p.getBoundingClientRect();
        return { x: 0, y: r.top + window.scrollY, width: r.width, height: r.height };
      })()`,
    });
    const b = box.result.value || {};
    const shot = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: { x: b.x, y: b.y, width: Math.ceil(b.width), height: Math.ceil(b.height), scale: 1.5 },
    });
    const file = path.join(OUT, `portfolio-page${i + 1}.png`);
    fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
    console.log('wrote', file, `(${Math.round(b.width)}x${Math.round(b.height)} css px)`);
  }

  // Also confirm Chrome can produce a real PDF from it.
  const pdfPath = path.join(OUT, 'portfolio.pdf');
  try {
    execFileSync(CHROME, [
      '--headless=new', '--disable-gpu', '--no-pdf-header-footer',
      '--virtual-time-budget=12000',
      `--print-to-pdf=${pdfPath}`,
      `${BASE}/api/portfolio/pdf?cb=${Date.now()}`,
    ], { stdio: 'ignore', timeout: 60000 });
    const st = fs.statSync(pdfPath);
    const head = fs.readFileSync(pdfPath).slice(0, 5).toString();
    console.log('\nprint-to-pdf:', head === '%PDF-', '| bytes:', st.size);
    const pageCount = (fs.readFileSync(pdfPath).toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    console.log('pdf pages:', pageCount);
  } catch (e) {
    console.log('\nprint-to-pdf failed:', e.message);
  }

  ws.close(); chrome.kill();
  process.exit(0);
})();