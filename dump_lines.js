'use strict';

/** Dumps the exact bytes of lines matching a pattern, to diagnose filter rules. */

const { execSync } = require('child_process');
const sh = (c) => execSync(c, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 512 });

const pattern = process.argv[2] || 'theology26';
const commits = sh('git rev-list --all').split(/\r?\n/).filter(Boolean);

for (const c of commits) {
  let files;
  try { files = sh(`git ls-tree -r --name-only ${c}`).split(/\r?\n/).filter(Boolean); } catch { continue; }
  for (const f of files) {
    if (/\.(glb|sqlite|jpg|png)$/i.test(f) || f === 'package-lock.json') continue;
    let content;
    try { content = sh(`git show ${c}:${f}`); } catch { continue; }
    if (!content) continue;
    content.split(/\n/).forEach((line, i) => {
      if (!line.includes(pattern)) return;
      const codes = [...line].map((ch) => ch.charCodeAt(0));
      const odd = codes.filter((n) => n > 126 || n < 32);
      console.log(`${c.slice(0, 7)} ${f}:${i + 1}`);
      console.log(`   text : ${JSON.stringify(line)}`);
      if (odd.length) console.log(`   odd  : ${odd.join(',')}`);
    });
  }
}
