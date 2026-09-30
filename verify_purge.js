'use strict';

/**
 * Definitive check: the leaked passcode must not be usable as a credential
 * anywhere in git history. Deny-list and scanner references are expected and
 * are reported separately from actual credential usage.
 */

const { execSync } = require('child_process');
const sh = (c) => execSync(c, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 512 });

// Forms that would actually authenticate someone.
const CREDENTIAL_FORMS = [
  ['DEFAULT_CONTENT passcode', /adminPasscode:\s*['"]theology26['"]/],
  ['server.js auth fallback (currentContent)', /currentContent\.general\.adminPasscode\s*\|\|\s*['"]theology26['"]/],
  ['server.js auth fallback (content)', /content\.general\.adminPasscode\s*\|\|\s*['"]theology26['"]/],
  ['AuthService default passphrase', /DEFAULT_PASSPHRASE\s*=\s*['"]theology26['"]/],
  ['raw process.env compare', /passcode\s*===\s*['"]theology26['"]\s*\?\s*validPass/],
];

// Forms that are safe: they only ever reject the value.
const DENY_LIST_FORMS = [
  ['deny-list constant', /REJECTED\s*=\s*['"]theology26['"]/],
  ['deny-list comparison', /pass\s*===\s*(REJECTED|['"]theology26['"])/],
  ['negative assertion', /!==\s*['"]theology26['"]|!\/.*theology26/],
  ['scanner needle', /needles\s*=|process\.argv\[2\]\s*\|\|/],
];

const commits = sh('git rev-list --all').split(/\r?\n/).filter(Boolean);
const credentialHits = [];
const denyHits = [];

for (const c of commits) {
  let files;
  try { files = sh(`git ls-tree -r --name-only ${c}`).split(/\r?\n/).filter(Boolean); } catch { continue; }
  for (const f of files) {
    if (/\.(glb|sqlite|jpg|png|mov|zip)$/i.test(f)) continue;
    let content;
    try { content = sh(`git show ${c}:${f}`); } catch { continue; }
    if (!content) continue;

    for (const [name, re] of CREDENTIAL_FORMS) {
      if (re.test(content)) credentialHits.push(`${c.slice(0, 7)} ${f}  [${name}]`);
    }
    for (const [name, re] of DENY_LIST_FORMS) {
      if (re.test(content)) denyHits.push(`${c.slice(0, 7)} ${f}  [${name}]`);
    }
  }
}

console.log(`Commits scanned: ${commits.length}\n`);

console.log('=== Credential forms (must be zero) ===');
if (credentialHits.length === 0) {
  console.log('  NONE. The leaked passcode cannot authenticate from any commit.');
} else {
  credentialHits.forEach((h) => console.log(`  LEAK  ${h}`));
}

console.log('\n=== Deny-list / scanner references (expected) ===');
const uniqDeny = [...new Set(denyHits.map((h) => h.split('  [')[1]))];
uniqDeny.forEach((d) => console.log(`  ok    ${d}`));

console.log(`\n${credentialHits.length === 0 ? 'PASS' : 'FAIL'}: ${credentialHits.length} credential leak(s), ${new Set(denyHits).size} deny-list reference(s)`);
process.exit(credentialHits.length === 0 ? 0 : 1);
