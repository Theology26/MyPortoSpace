'use strict';

/**
 * build.js — production asset pipeline.
 *
 * Extracts the inline `text/babel` blocks from index.html / admin.html,
 * compiles the JSX ahead of time, writes plain JS + a static stylesheet, and
 * rewrites the HTML to reference them. This removes the ~2.9 MB Babel
 * Standalone download and the browser-side transpile cost on every page load.
 *
 * Usage: node build.js
 */

const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

const ROOT = __dirname;
const CLIENT_DIR = path.join(ROOT, 'src', 'client');
const PUBLIC_DIR = path.join(ROOT, 'public');

const BABEL_TAG = /<script\s+type="text\/babel"([^>]*)>([\s\S]*?)<\/script>/g;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/** Pull every inline babel block out of an HTML file. */
function extractBabelBlocks(html) {
  const blocks = [];
  const stripped = html.replace(BABEL_TAG, (_match, attrs, code) => {
    blocks.push({ attrs: attrs || '', code });
    return `<!--__BABEL_BLOCK_${blocks.length - 1}__-->`;
  });
  return { stripped, blocks };
}

function compileJsx(code, filename) {
  const result = babel.transformSync(code, {
    filename,
    babelrc: false,
    configFile: false,
    sourceMaps: false,
    compact: false,
    comments: false,
    presets: [[require.resolve('@babel/preset-react'), { runtime: 'classic' }]],
  });
  return result.code;
}

/** Escape a string for safe embedding in a <script> block. */
function forInlineScript(str) {
  return str.replace(/<\/script>/gi, '<\\/script>');
}

function build() {
  ensureDir(CLIENT_DIR);
  ensureDir(PUBLIC_DIR);

  const targets = [
    { html: 'index.html', name: 'app' },
    { html: 'admin.html', name: 'admin' },
  ];

  const manifest = [];

  for (const { html, name } of targets) {
    const htmlPath = path.join(ROOT, html);
    if (!fs.existsSync(htmlPath)) {
      console.warn(`[build] skip ${html} (not found)`);
      continue;
    }

    const source = fs.readFileSync(htmlPath, 'utf8');
    const { stripped, blocks } = extractBabelBlocks(source);
    const outName = `${name}.js`;

    // First run: harvest the inline block into src/client/<name>.jsx.
    if (blocks.length > 0) {
      const combined = blocks.map((b) => b.code).join('\n;\n');
      fs.writeFileSync(path.join(CLIENT_DIR, `${name}.jsx`), combined, 'utf8');
      fs.writeFileSync(htmlPath, stripped.replace(/<!--__BABEL_BLOCK_\d+__-->/g, ''), 'utf8');
      console.log(`[build] ${html}: extracted inline babel block -> src/client/${name}.jsx`);
      continue;
    }

    // Subsequent runs: recompile the .jsx source of truth.
    const jsxPath = path.join(CLIENT_DIR, `${name}.jsx`);
    if (!fs.existsSync(jsxPath)) {
      console.log(`[build] ${html}: no ${name}.jsx source, left untouched`);
      continue;
    }

    const jsx = fs.readFileSync(jsxPath, 'utf8');
    const compiled = compileJsx(jsx, `${name}.jsx`);

    let out = source;
    const tagRe = new RegExp(`<script[^>]*src="/${outName}[^"]*"[^>]*></script>\\s*`, 'g');
    if (tagRe.test(out)) {
      out = out.replace(tagRe, `<script src="/${outName}" defer></script>\n  `);
      fs.writeFileSync(htmlPath, out, 'utf8');
    } else if (!out.includes(`/${outName}`)) {
      console.warn(`[build] ${html}: no <script src="/${outName}"> tag found; add it manually`);
    }

    fs.writeFileSync(path.join(PUBLIC_DIR, outName), compiled, 'utf8');
    manifest.push({ html, outName, bytes: Buffer.byteLength(compiled), sourceBytes: Buffer.byteLength(jsx) });

    console.log(
      `[build] ${html}: src/client/${name}.jsx -> public/${outName} ` +
      `(${(Buffer.byteLength(jsx) / 1024).toFixed(0)} KB JSX -> ${(Buffer.byteLength(compiled) / 1024).toFixed(0)} KB JS)`
    );
  }

  // Persist a small manifest so the server can set correct cache headers.
  // Script tags are left unversioned here; scripts/version-assets.js appends the
  // content hash once the CSS has been generated too (build:css runs after).
  fs.writeFileSync(
    path.join(PUBLIC_DIR, 'build-manifest.json'),
    JSON.stringify({ builtAt: new Date().toISOString(), assets: manifest }, null, 2),
    'utf8'
  );

  console.log('[build] done');
}

build();
