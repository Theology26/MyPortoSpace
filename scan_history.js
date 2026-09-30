'use strict';

/**
 * Reports every distinct line in git history that contains the leaked passcode
 * as a quoted literal, so the filter rules can cover all forms.
 */

const { execSync } = require('child_process');

const sh = (cmd) => execSync(cmd, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 512 });

const commits = sh('git rev-list --all').split(/\r?\n/).filter(Boolean);
const needles = ["'theology26'", '"theology26"'];
const found = new Map();

for (const c of commits) {
  let files;
  try { files = sh(`git ls-tree -r --name-only ${c}`).split(/\r?\n/).filter(Boolean); } catch { continue; }

  for (const f of files) {
    if (/\.(glb|sqlite|jpg|png|mov|zip)$/i.test(f) || f === 'package-lock.json') continue;
    let content;
    try { content = sh(`git show ${c}:${f}`); } catch { continue; }
    if (!content) continue;

    for (const line of content.split(/\r?\n/)) {
      if (needles.some((n) => line.includes(n))) {
        const key = `${f} :: ${line.trim()}`;
        if (!found.has(key)) found.set(key, c.slice(0, 7));
      }
    }
  }
}

if (found.size === 0) {
  console.log('No quoted theology26 literals found in history.');
} else {
  console.log(`Found ${found.size} distinct line(s):\n`);
  for (const [line, commit] of found) {
    console.log(`  [${commit}] ${line}`);
  }
}

process.exit(0);
