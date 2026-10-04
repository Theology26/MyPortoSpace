'use strict';

/**
 * Headless render smoke test.
 * Loads the page in Chrome, captures console errors and failed requests,
 * and verifies the React tree actually mounted.
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE || 'http://localhost:3111';
const PORT = 9222;

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const userDir = path.join(process.env.TEMP, 'opencode', 'chrome-smoke');
  const chrome = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--window-size=390,844',
    'about:blank',
  ], { stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    try {
      const list = await getJson(`http://127.0.0.1:${PORT}/json/list`);
      target = list.find((t) => t.type === 'page');
      if (target) break;
    } catch {}
  }
  if (!target) { console.log('FAIL  could not attach to Chrome'); chrome.kill(); process.exit(1); }

  const WebSocket = require('ws');
  const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
  let id = 0;
  const pending = new Map();
  const consoleErrors = [];
  const failedRequests = [];
  const pendingUrls = new Map();
  let glbStart = 0;

  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const msgId = ++id;
      pending.set(msgId, resolve);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); return; }
    if (msg.method === 'Runtime.consoleAPICalled' && (msg.params.type === 'error' || msg.params.type === 'warning')) {
      consoleErrors.push(`${msg.params.type}: ${msg.params.args.map((a) => a.value || a.description || '').join(' ')}`);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(`exception: ${msg.params.exceptionDetails.text} ${msg.params.exceptionDetails.exception?.description || ''}`);
    }
    if (msg.method === 'Network.requestWillBeSent') {
      pendingUrls.set(msg.params.requestId, msg.params.request.url);
      if (/\/Assets\/.*\.glb/i.test(msg.params.request.url)) {
        glbStart = Date.now();
      }
    }
    if (msg.method === 'Network.loadingFailed') {
      failedRequests.push(`${msg.params.type} ${msg.params.errorText} ${pendingUrls.get(msg.params.requestId) || ''}`);
    }
  });

  await new Promise((r) => ws.on('open', r));
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Page.enable');
  // Start from a clean slate so eco-mode defaulting is deterministic.
  await send('Page.navigate', { url: `${BASE}/robots.txt` });
  await sleep(500);
  await send('Runtime.evaluate', { expression: `try { localStorage.clear(); } catch (e) {}` });

  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

  await send('Page.navigate', { url: `${BASE}/` });
  await sleep(9000);

  const probe = async (label) => {
    const p = await send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const root = document.getElementById('root');
        return {
          hasRoot: !!root,
          childCount: root ? root.children.length : 0,
          textLen: root ? root.innerText.length : 0,
          hasCanvas: !!document.querySelector('canvas'),
          eco: localStorage.getItem('theo_eco_mode'),
          heading: (document.querySelector('h1')||{}).innerText || '',
          bodyBg: getComputedStyle(document.body).backgroundColor,
          reactMounted: !!(root && root.innerHTML.length > 500),
          font: getComputedStyle(document.querySelector('h1')||document.body).fontFamily,
        };
      })()`,
    });
    return p.result.value || {};
  };

  const r = await probe();
  let pass = 0, fail = 0;
  const chk = (n, c, x) => { if (c) { pass++; console.log(`PASS  ${n}`); } else { fail++; console.log(`FAIL  ${n}${x !== undefined ? `  (${x})` : ''}`); } };

  console.log('=== Mobile viewport 390x844 (Eco Mode expected) ===');
  chk('React root mounted', r.reactMounted, `childCount=${r.childCount}`);
  chk('content rendered', r.textLen > 200, `textLen=${r.textLen}`);
  chk('hero heading present', typeof r.heading === 'string' && r.heading.length > 0, r.heading);
  chk('Eco Mode on -> no WebGL canvas (2D fallback)', r.hasCanvas === false, `hasCanvas=${r.hasCanvas}`);
  chk('dark theme applied', r.bodyBg === 'rgb(8, 8, 10)', r.bodyBg);
  chk('Geist font active', /Geist/.test(r.font || ''), r.font);

  const mobileGlb = [...pendingUrls.values()].filter((u) => /\/Assets\/.*\.glb/i.test(u));
  chk('mobile fetches zero GLB models', mobileGlb.length === 0, mobileGlb.join(', '));

  // Desktop viewport: force 3D mode and confirm the canvas mounts.
  await send('Runtime.evaluate', { expression: `localStorage.setItem('theo_eco_mode','false')` });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${BASE}/` });
  const navAt = Date.now();
  glbStart = 0;
  await sleep(9000);
  const d = await probe();

  console.log('\n=== Desktop viewport 1440x900 (3D mode) ===');
  chk('React root mounted', d.reactMounted);
  chk('3D mode -> WebGL canvas mounts', d.hasCanvas === true, `hasCanvas=${d.hasCanvas}`);
  chk('content rendered', d.textLen > 200, `textLen=${d.textLen}`);

  // Heavy GLB models must be idle-deferred: they may not compete with first paint.
  const glbDelayMs = glbStart ? glbStart - navAt : Infinity;
  chk('GLB models deferred past first paint (>1.5s)', glbDelayMs > 1500, `started after ${glbDelayMs}ms`);

  const realErrors = consoleErrors.filter((e) => !/favicon|ERR_ABORTED|_vercel|Autofill|draco|gstatic/i.test(e));
  chk('no console errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));
  const realFailed = failedRequests.filter((e) => !/favicon|_vercel/i.test(e));
  chk('no failed asset loads', realFailed.length === 0, realFailed.slice(0, 3).join(' | '));

  console.log(`\n===== ${pass} passed, ${fail} failed =====`);
  if (realErrors.length) console.log('\nConsole output:\n' + realErrors.slice(0, 8).join('\n'));

  ws.close();
  chrome.kill();
  process.exit(fail === 0 ? 0 : 1);
})();
