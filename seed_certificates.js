'use strict';

/**
 * Generates dummy certificate images by rendering HTML in headless Chrome and
 * capturing a PNG screenshot, then uploads each one through the real
 * /api/upload endpoint and registers it in certificatesList.
 *
 * Usage: node seed_certificates.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const { resolvePasscode } = require('./test/helpers/passcode');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE || 'http://localhost:3111';
const PASSCODE = resolvePasscode();
const DEBUG_PORT = 9225;

const W = 1200;
const H = 850;

const CERTS = [
  {
    id: 'aws-solutions-architect',
    title: 'AWS Certified Solutions Architect – Associate',
    issuer: 'Amazon Web Services',
    date: '2026',
    badge: 'OFFICIAL CERTIFICATE',
    aspectRatio: 'aspect-[4/3]',
    accent: '#ff9900',
    accent2: '#232f3e',
    eyebrow: 'AMAZON WEB SERVICES',
    subtitle: 'Certificate of Achievement',
    holder: 'Yosia Gracetheo Boimau',
    credential: 'AWS-SAA-118472',
    skills: ['Cloud Architecture', 'IAM & Governance', 'Networking', 'High Availability', 'Cost Optimization'],
  },
  {
    id: 'google-cloud-pde',
    title: 'Google Cloud Professional Data Engineer',
    issuer: 'Google Cloud',
    date: '2026',
    badge: 'PROFESSIONAL CERTIFICATE',
    aspectRatio: 'aspect-[4/3]',
    accent: '#4285f4',
    accent2: '#1a73e8',
    eyebrow: 'GOOGLE CLOUD',
    subtitle: 'Professional Certification',
    holder: 'Yosia Gracetheo Boimau',
    credential: 'GCP-PDE-904213',
    skills: ['Data Pipelines', 'BigQuery', 'Pub/Sub Streaming', 'Dataproc', 'ML Pipelines'],
  },
  {
    id: 'databricks-spark',
    title: 'Databricks Certified Data Engineer Associate',
    issuer: 'Databricks',
    date: '2025',
    badge: 'OFFICIAL CERTIFICATE',
    aspectRatio: 'aspect-[4/3]',
    accent: '#ff3621',
    accent2: '#1b3139',
    eyebrow: 'DATABRICKS',
    subtitle: 'Certified Data Engineer',
    holder: 'Yosia Gracetheo Boimau',
    credential: 'DBX-DCE-551207',
    skills: ['Apache Spark', 'Delta Lake', 'Data Modeling', 'ETL Design', 'Lakehouse'],
  },
  {
    id: 'docker-certified',
    title: 'Docker Certified Associate',
    issuer: 'Docker Inc.',
    date: '2025',
    badge: 'OFFICIAL CERTIFICATE',
    aspectRatio: 'aspect-[4/3]',
    accent: '#2496ed',
    accent2: '#0b1622',
    eyebrow: 'DOCKER',
    subtitle: 'Certified Associate',
    holder: 'Yosia Gracetheo Boimau',
    credential: 'DCA-773410',
    skills: ['Containers', 'Image Optimization', 'Compose', 'Networking', 'Registry'],
  },
  {
    id: 'azure-fundamentals',
    title: 'Microsoft Certified: Azure Fundamentals (AZ-900)',
    issuer: 'Microsoft',
    date: '2025',
    badge: 'OFFICIAL CERTIFICATE',
    aspectRatio: 'aspect-[4/3]',
    accent: '#0078d4',
    accent2: '#10243e',
    eyebrow: 'MICROSOFT',
    subtitle: 'Microsoft Certified',
    holder: 'Yosia Gracetheo Boimau',
    credential: 'MS-AZ900-402187',
    skills: ['Cloud Concepts', 'Azure Services', 'Identity & Governance', 'Cloud Security'],
  },
  {
    id: 'tensorflow-developer',
    title: 'TensorFlow Developer Certification',
    issuer: 'Google TensorFlow',
    date: '2025',
    badge: 'PROFESSIONAL CERTIFICATE',
    aspectRatio: 'aspect-[4/3]',
    accent: '#ff6f00',
    accent2: '#1a1a1a',
    eyebrow: 'TENSORFLOW',
    subtitle: 'Developer Certification',
    holder: 'Yosia Gracetheo Boimau',
    credential: 'TF-DEV-661904',
    skills: ['Neural Networks', 'CNN & Vision', 'NLP', 'Sequence Models', 'Production ML'],
  },
  {
    id: 'linux-essential',
    title: 'Linux System Administration Essentials',
    issuer: 'BINUS University',
    date: '2024',
    badge: 'ACADEMIC CERTIFICATE',
    aspectRatio: 'aspect-[4/3]',
    accent: '#0f9d58',
    accent2: '#16241d',
    eyebrow: 'BINUS UNIVERSITY',
    subtitle: 'Course Completion',
    holder: 'Yosia Gracetheo Boimau',
    credential: 'BINUS-LSA-2024-1177',
    skills: ['Bash', 'Process Management', 'Networking', 'Permissions', 'Systemd'],
  },
  {
    id: 'ui-ux-foundations',
    title: 'UI/UX Design Foundations',
    issuer: 'Meta Front-End Developer',
    date: '2024',
    badge: 'PROFESSIONAL CERTIFICATE',
    aspectRatio: 'aspect-[4/3]',
    accent: '#8b5cf6',
    accent2: '#1e1b31',
    eyebrow: 'DESIGN TRACK',
    subtitle: 'Design Foundations',
    holder: 'Yosia Gracetheo Boimau',
    credential: 'UXF-2024-8830',
    skills: ['Design Systems', 'Wireframing', 'Accessibility', 'Typography', 'Prototyping'],
  },
];

/** Certificate HTML. Self-contained, no external requests. */
function renderHtml(c) {
  const skills = c.skills
    .map((s) => `<span class="skill">${s}</span>`)
    .join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    width:${W}px; height:${H}px; display:flex; align-items:center; justify-content:center;
    font-family:'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    background:
      radial-gradient(circle at 12% 8%, ${c.accent}22, transparent 45%),
      radial-gradient(circle at 88% 92%, ${c.accent}18, transparent 45%),
      ${c.accent2};
  }
  .frame {
    position:relative; width:${W - 60}px; height:${H - 60}px;
    background:linear-gradient(160deg,#ffffff 0%,#f7f8fb 100%);
    border-radius:10px; padding:52px 64px;
    display:flex; flex-direction:column; align-items:center; text-align:center;
    box-shadow:0 30px 70px rgba(0,0,0,.45);
  }
  .frame::before {
    content:''; position:absolute; inset:14px;
    border:2px solid ${c.accent}55; border-radius:6px;
  }
  .frame::after {
    content:''; position:absolute; inset:0; border-radius:10px;
    border-top:7px solid ${c.accent}; pointer-events:none;
  }
  .eyebrow {
    font-size:13px; font-weight:700; letter-spacing:5px; color:${c.accent};
    text-transform:uppercase; margin-bottom:14px;
  }
  h1 { font-size:19px; font-weight:400; color:#5b6472; letter-spacing:1.5px; margin-bottom:26px; }
  .name {
    font-size:52px; font-weight:800; color:#101828; letter-spacing:1px;
    line-height:1.1; margin-bottom:8px;
  }
  .rule { width:110px; height:4px; background:${c.accent}; border-radius:2px; margin:16px 0 24px; }
  .title { font-size:27px; font-weight:700; color:${c.accent2}; margin-bottom:8px; }
  .issuer { font-size:16px; color:#5b6472; margin-bottom:26px; }
  .skills { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; max-width:820px; margin-bottom:28px; }
  .skill {
    font-size:13px; font-weight:600; color:#344054;
    background:${c.accent}14; border:1px solid ${c.accent}40;
    padding:6px 14px; border-radius:999px;
  }
  .footer { display:flex; justify-content:space-between; align-items:flex-end; width:100%; margin-top:auto; }
  .sig { text-align:left; }
  .sig .line { width:190px; height:2px; background:#d0d5dd; margin-bottom:7px; }
  .sig .who { font-size:13px; font-weight:700; color:#344054; }
  .sig .role { font-size:11px; color:#98a2b3; letter-spacing:.5px; }
  .seal {
    width:96px; height:96px; border-radius:50%;
    background:conic-gradient(from 0deg, ${c.accent}, ${c.accent2}, ${c.accent});
    display:flex; align-items:center; justify-content:center;
    box-shadow:0 8px 22px rgba(0,0,0,.28);
  }
  .seal span {
    width:78px; height:78px; border-radius:50%; background:#fff;
    display:flex; align-items:center; justify-content:center;
    font-size:11px; font-weight:800; color:${c.accent2};
    text-align:center; line-height:1.15; padding:6px;
  }
  .cred { text-align:right; }
  .cred .id { font-family:Consolas, monospace; font-size:13px; color:#667085; }
  .cred .date { font-size:12px; color:#98a2b3; margin-top:5px; }
</style></head>
<body>
  <div class="frame">
    <div class="eyebrow">${c.eyebrow}</div>
    <h1>${c.subtitle}</h1>
    <div class="name">${c.holder}</div>
    <div class="rule"></div>
    <div class="title">${c.title}</div>
    <div class="issuer">Awarded by ${c.issuer}</div>
    <div class="skills">${skills}</div>
    <div class="footer">
      <div class="sig">
        <div class="line"></div>
        <div class="who">${c.issuer}</div>
        <div class="role">AUTHORIZED SIGNATORY</div>
      </div>
      <div class="seal"><span>VERIFIED<br>${c.date}</span></div>
      <div class="cred">
        <div class="id">ID ${c.credential}</div>
        <div class="date">Issued ${c.date}</div>
      </div>
    </div>
  </div>
</body></html>`;
}

const getJson = (url) =>
  new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode: PASSCODE }),
  }).then((r) => r.json());

  if (!login.token) {
    console.error('Login failed. Is the server running on ' + BASE + '?');
    process.exit(1);
  }
  const auth = { Authorization: `Bearer ${login.token}` };

  // Idempotent: skip anything already registered so re-runs don't duplicate.
  const current = await fetch(`${BASE}/api/content`).then((r) => r.json());
  const existing = current.data.certificatesList || [];
  const knownIds = new Set(existing.map((c) => c.id));

  const todo = CERTS.filter((c) => !knownIds.has(`cert-${c.id}`));
  const already = CERTS.filter((c) => knownIds.has(`cert-${c.id}`));

  already.forEach((c) => console.log(`skip ${c.id} (already registered)`));

  if (todo.length === 0) {
    console.log('\nAll certificates already seeded. Nothing to do.');
    report(existing);
    process.exit(0);
  }

  const profile = path.join(os.tmpdir(), 'opencode', `chrome-seed-${Date.now().toString(36)}`);
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
    '--disable-gpu', `--window-size=${W},${H}`, 'about:blank',
  ], { stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    try { target = (await getJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).find((t) => t.type === 'page'); if (target) break; } catch {}
  }
  if (!target) { console.error('Could not attach to Chrome'); chrome.kill(); process.exit(1); }

  const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) =>
    new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });
  ws.on('message', (d) => {
    let m; try { m = JSON.parse(d.toString()); } catch { return; }
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  });
  await new Promise((r) => ws.on('open', r));
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });

  const outDir = path.join(os.tmpdir(), 'opencode', 'certs');
  fs.mkdirSync(outDir, { recursive: true });

  const uploaded = [];

  for (const cert of todo) {
    const htmlPath = path.join(outDir, `${cert.id}.html`);
    fs.writeFileSync(htmlPath, renderHtml(cert), 'utf8');

    await send('Page.navigate', { url: `file:///${htmlPath.replace(/\\/g, '/')}` });
    await sleep(1600);

    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const png = Buffer.from(shot.data, 'base64');
    const pngPath = path.join(outDir, `${cert.id}.png`);
    fs.writeFileSync(pngPath, png);
    console.log(`rendered ${cert.id}.png (${Math.round(png.length / 1024)} KB)`);

    const form = new FormData();
    form.append('image', new Blob([png], { type: 'image/png' }), `${cert.id}.png`);
    const res = await fetch(`${BASE}/api/upload`, { method: 'POST', headers: auth, body: form });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      console.error(`  upload FAILED: ${json.error || res.status}`);
      continue;
    }
    console.log(`  uploaded -> ${json.url}`);
    uploaded.push({ ...cert, imageUrl: json.url });
  }

  // Chrome must be gone before its profile can be removed on Windows.
  ws.close();
  chrome.kill();
  await sleep(1200);
  try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch {}

  if (uploaded.length === 0) {
    console.error('\nNothing uploaded.');
    process.exit(1);
  }

  // Register in certificatesList via the authenticated API.
  const known = new Set(existing.map((c) => c.imageUrl));
  const additions = uploaded
    .filter((c) => !known.has(c.imageUrl))
    .map((c) => ({
      id: `cert-${c.id}`,
      title: c.title,
      issuer: c.issuer,
      imageUrl: c.imageUrl,
      linkUrl: 'https://github.com/Theology26',
      aspectRatio: c.aspectRatio,
      badge: c.badge,
      date: c.date,
    }));

  if (additions.length > 0) {
    const merged = [...additions, ...existing];
    const put = await fetch(`${BASE}/api/content`, {
      method: 'PUT',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ certificatesList: merged }),
    });
    const putJson = await put.json().catch(() => ({}));
    if (!put.ok) {
      console.error(`\nRegistering failed: ${putJson.error || put.status}`);
      process.exit(1);
    }
  }

  const after = await fetch(`${BASE}/api/content`).then((r) => r.json());
  report(after.data.certificatesList);

  console.log('\nPNG source files kept at: ' + outDir);
  process.exit(0);
}

function report(list) {
  console.log(`\ncertificatesList now has ${list.length} entries:`);
  list.forEach((c, i) => {
    const local = /\/Assets\/uploads\//.test(c.imageUrl || '') ? 'LOCAL' : 'remote';
    console.log(`  ${i + 1}. [${local}] ${c.title}`);
  });
}

main().catch((err) => { console.error(err); process.exit(1); });
