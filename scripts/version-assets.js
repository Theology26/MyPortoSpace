'use strict';

/**
 * version-assets.js — make the built bundles content-addressed.
 *
 * public/ is served with `max-age=7d`, but the URLs (/app.js, /admin.js,
 * /tailwind.css, /tailwind.admin.css) never changed between builds, so browsers
 * kept serving stale copies for up to a week after a deploy. Appending a hash of
 * each file's own bytes to the reference in index.html / admin.html fixes that:
 * a changed file gets a new URL, an unchanged file keeps its cached one.
 *
 * Runs last, after build.js and build:css.
 *
 * Usage: node scripts/version-assets.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

// outName -> which HTML documents reference it.
const ASSETS = [
  { file: 'app.js', html: ['index.html'] },
  { file: 'admin.js', html: ['admin.html'] },
  { file: 'tailwind.css', html: ['index.html'] },
  { file: 'tailwind.admin.css', html: ['admin.html'] },
];

function hashOf(absPath) {
  return crypto.createHash('sha256').update(fs.readFileSync(absPath)).digest('hex').slice(0, 10);
}

function patchHtml(htmlName, file, hash) {
  const htmlPath = path.join(ROOT, htmlName);
  if (!fs.existsSync(htmlPath)) return null;

  const before = fs.readFileSync(htmlPath, 'utf8');
  // Match an existing ?v=... so re-running replaces it instead of stacking.
  const re = new RegExp(`(src|href)="/${file.replace(/\./g, '\\.')}(\\?v=[a-f0-9]+)?"`, 'g');
  if (!re.test(before)) return null;

  const after = before.replace(re, (_m, attr) => `${attr}="/${file}?v=${hash}"`);
  if (after !== before) fs.writeFileSync(htmlPath, after, 'utf8');
  return after !== before;
}

let missing = 0;
const results = [];

for (const { file, html } of ASSETS) {
  const abs = path.join(PUBLIC_DIR, file);
  if (!fs.existsSync(abs)) {
    console.warn(`[version] skip ${file} (not built yet)`);
    missing++;
    continue;
  }
  const hash = hashOf(abs);
  let touched = 0;
  for (const htmlName of html) {
    if (patchHtml(htmlName, file, hash)) touched++;
  }
  results.push({ file, hash, bytes: fs.statSync(abs).size, htmlUpdated: touched });
  console.log(`[version] ${file} -> v=${hash} (${results[results.length - 1].bytes} bytes, ${touched} html updated)`);
}

if (missing === results.length) {
  console.log('[version] nothing to version');
} else {
  console.log('[version] done');
}