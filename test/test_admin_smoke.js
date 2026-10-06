'use strict';

/** Post-login smoke test: unlock the admin and confirm the CV checkbox exists. */

const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE || 'http://127.0.0.1:3111';
const PORT = 9332;

const getJson = (url) => new Promise((res, rej) => {
  http.get(url, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej);
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function resolvePasscode() {
  const f = path.join(__dirname, '..', 'ADMIN_CREDENTIALS.txt');
  const text = fs.readFileSync(f, 'utf8');
  const m = text.match(/^ADMIN_PASSCODE=(.+)$/m);
  if (!m) throw new Error('no ADMIN_PASSCODE in credentials file');
  return m[1].trim();
}

(async () => {
  const passcode = process.env.TEST_PASSCODE || resolvePasscode();
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${path.join(process.env.TEMP, 'opencode', 'chrome-admin')}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    try { target = (await getJson(`http://127.0.0.1:${PORT}/json/list`)).find((t) => t.type === 'page'); if (target) break; } catch {}
  }
  if (!target) { console.log('FAIL could not attach to chrome'); chrome.kill(); process.exit(1); }

  const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 64 * 1024 * 1024 });
  let id = 0; const pending = new Map(); const errors = [];
  const send = (method, params = {}) => new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });

  ws.on('message', (d) => {
    let m; try { m = JSON.parse(d.toString()); } catch { return; }
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  });

  await new Promise((r) => ws.on('open', r));
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${BASE}/admin` });
  await sleep(7000);

  // Log in.
  await send('Runtime.evaluate', {
    expression: `(() => {
      const input = [...document.querySelectorAll('input')].find(i => /passcode|password/i.test(i.type + ' ' + (i.placeholder||'') + ' ' + (i.name||'')));
      if (!input) return 'no input';
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, ${JSON.stringify(passcode)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const btn = [...document.querySelectorAll('button')].find(b => /unlock/i.test(b.innerText));
      if (btn) btn.click();
      return 'submitted';
    })()`,
  });
  await sleep(8000);

  // Open the Projects tab, then expand the first card.
  await send('Runtime.evaluate', {
    expression: `(() => {
      const tab = [...document.querySelectorAll('button')].find(b => /projects/i.test(b.innerText));
      if (tab) tab.click();
      return 'tab clicked';
    })()`,
  });
  await sleep(4000);

  const r = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      // Expand every collapsed project card so the checkbox is in the DOM.
      const toggles = [...document.querySelectorAll('button, [role="button"]')]
        .filter(b => /⌄|▾|▼/.test(b.innerText || ''));
      toggles.slice(0, 3).forEach(t => t.click());
      return toggles.length;
    })()`,
  });
  await sleep(3000);

  const evalOnTab = async (tabPattern, expression) => {
    await send('Runtime.evaluate', {
      expression: `(() => {
        const tab = [...document.querySelectorAll('button')].find(b => new RegExp(${JSON.stringify(tabPattern)}, 'i').test(b.innerText));
        if (tab) tab.click();
        return 'clicked';
      })()`,
    });
    await sleep(3500);
    const out = await send('Runtime.evaluate', { returnByValue: true, expression });
    return out.result.value || {};
  };

  // 1) Projects tab: the CV checkboxes.
  await evalOnTab('projects', `(() => {
    const toggles = [...document.querySelectorAll('button, [role="button"]')].filter(b => /[⌄▾▼]/.test(b.innerText || ''));
    toggles.slice(0, 4).forEach(t => t.click());
    return toggles.length;
  })()`);
  await sleep(2500);

  const projects = await evalOnTab('projects', `(() => {
    const boxes = [...document.querySelectorAll('input[type="checkbox"]')];
    const cvBoxes = boxes.filter(b => {
      const wrap = b.closest('label') || b.parentElement;
      return wrap && /selected for cv/i.test(wrap.innerText || '');
    });
    return {
      cvCheckboxes: cvBoxes.length,
      checkedCount: cvBoxes.filter(b => b.checked).length,
      tabs: [...document.querySelectorAll('button')].filter(b => /^0\\d \\/\\//.test((b.innerText||'').trim())).map(b => b.innerText.trim()),
    };
  })()`);

  // 2) Tech Stacks tab: the Technical Arsenal editor.
  const arsenal = await evalOnTab('tech stacks', `(() => {
    const text = document.body.innerText;
    return {
      arsenalVisible: /section 04/i.test(text) && /architecture cards/i.test(text),
      cvSummaryVisible: /projects on this cv/i.test(text),
    };
  })()`);

  console.log('=== ADMIN SMOKE TEST ===');
  console.log('tabs visible            :', (projects.tabs || []).join(' | '));
  console.log('"Selected for CV" boxes :', projects.cvCheckboxes, '(want >= 1)');
  console.log('already ticked          :', projects.checkedCount, '(want 7)');
  console.log('Section 04 editor shown :', arsenal.arsenalVisible, '(want true)');
  console.log('runtime exceptions      :', errors.length ? errors.join('\n') : '(none)');

  ws.close(); chrome.kill();
  const pass = projects.cvCheckboxes >= 1 && projects.checkedCount === 7 && arsenal.arsenalVisible && errors.length === 0;
  console.log(`\n===== ${pass ? 'PASS' : 'FAIL'} =====`);
  process.exit(pass ? 0 : 1);
})();