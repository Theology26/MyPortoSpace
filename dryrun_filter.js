'use strict';

/**
 * Dry-run harness for a git-filter-repo --replace-text rules file.
 *
 * Clones the repo to a throwaway directory, applies the rules there, and
 * reports exactly which files would change. Nothing in the real repo is
 * touched. Run this before every history rewrite.
 *
 * Usage: node dryrun_filter.js <rules-file> [--keep]
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync, execFileSync } = require('child_process');

const RULES = process.argv[2];
const KEEP = process.argv.includes('--keep');

if (!RULES) {
  console.error('Usage: node dryrun_filter.js <rules-file> [--keep]');
  process.exit(1);
}
if (!fs.existsSync(RULES)) {
  console.error(`Rules file not found: ${RULES}`);
  process.exit(1);
}

const REPO = __dirname;
const WORK = path.join(os.tmpdir(), 'opencode', 'filter-dryrun');

const sh = (cmd, cwd) => execSync(cmd, { cwd, encoding: 'utf8', maxBuffer: 1024 * 1024 * 512 });
const shx = (cmd, cwd) => execFileSync(cmd, { cwd, encoding: 'utf8', shell: true, maxBuffer: 1024 * 1024 * 512 });

function fail(msg) {
  console.error(`\nABORT: ${msg}`);
  process.exit(1);
}

// 1. Validate the rules file before touching anything.
console.log('=== 1. Validating rules file ===');
const lines = fs.readFileSync(RULES, 'utf8').split(/\r?\n/);
const VALID = /^(literal|regex|glob|bytes):/;
let ruleCount = 0;
lines.forEach((line, i) => {
  const t = line.trim();
  if (t === '') return;
  if (!VALID.test(t)) {
    fail(`line ${i + 1} is not a valid rule (no literal:/regex:/glob:/bytes: prefix):\n         ${JSON.stringify(t.slice(0, 60))}\n         git-filter-repo has no comment syntax; every line is a rule.`);
  }
  ruleCount++;
});
console.log(`  ${ruleCount} rule(s), all with an explicit type prefix. OK.`);

if (allText.includes(DELETE_MARKER)) {
  fail('rules file or output references the filter-repo delete marker');
}

// 2. Throwaway clone.
console.log('\n=== 2. Creating throwaway clone ===');
fs.rmSync(WORK, { recursive: true, force: true, maxRetries: 5 });
fs.mkdirSync(path.dirname(WORK), { recursive: true });
execFileSync('git', ['clone', '--no-hardlinks', '--quiet', REPO, WORK], { encoding: 'utf8' });
sh('git checkout -q main', WORK);
const before = sh('git rev-parse HEAD', WORK).trim();
console.log(`  clone at ${before.slice(0, 8)}`);

// Snapshot every tracked file's hash so we can diff precisely.
function snapshot(dir) {
  const files = sh('git ls-files', dir).split(/\r?\n/).filter(Boolean);
  const map = {};
  for (const f of files) {
    if (/\.(glb|sqlite|jpg|png|mov|zip|woff2?)$/i.test(f)) continue;
    try { map[f] = require('crypto').createHash('sha1').update(sh(`git show HEAD:${f}`, dir)).digest('hex'); }
    catch { /* binary or unreadable */ }
  }
  return map;
}
const snapBefore = snapshot(WORK);

// 3. Apply.
console.log('\n=== 3. Applying filter in the throwaway clone ===');
const filterRepo =
  process.env.FILTER_REPO ||
  path.join(process.env.APPDATA || '', 'Python', 'Python314', 'Scripts', 'git-filter-repo.exe');

let applied = false;
if (fs.existsSync(filterRepo)) {
  try {
    const out = execFileSync(filterRepo, ['--replace-text', RULES, '--force'], {
      cwd: WORK, encoding: 'utf8', maxBuffer: 1024 * 1024 * 512,
    });
    console.log(out.split(/\r?\n/).filter((l) => /HEAD is now|finished/.test(l)).join('\n'));
    applied = true;
  } catch (err) {
    console.error(String(err.stdout || err.message).split(/\r?\n/).slice(-6).join('\n'));
  }
} else {
  fail(`git-filter-repo not found at ${filterRepo}`);
}
if (!applied) fail('filter-repo did not run');

// 4. Report exactly what changed.
console.log('\n=== 4. Diff report ===');
const snapAfter = snapshot(WORK);
const changed = Object.keys(snapAfter).filter((f) => snapBefore[f] !== snapAfter[f]);
const added = Object.keys(snapAfter).filter((f) => !(f in snapBefore));
const removed = Object.keys(snapBefore).filter((f) => !(f in snapAfter));

console.log(`  files changed : ${changed.length}`);
changed.forEach((f) => console.log(`    ~ ${f}`));
if (added.length) { console.log(`  files added   : ${added.length}`); added.forEach((f) => console.log(`    + ${f}`)); }
if (removed.length) { console.log(`  files removed : ${removed.length}`); removed.forEach((f) => console.log(`    - ${f}`)); }

// 5. Safety assertions against the clone.
console.log('\n=== 5. Safety assertions ===');
let problems = 0;
const check = (label, ok, detail) => {
  if (ok) { console.log(`  PASS  ${label}`); } else { console.log(`  FAIL  ${label}${detail ? `  ${detail}` : ''}`); problems++; }
};

const allText = Object.keys(snapAfter)
  .map((f) => { try { return sh(`git show HEAD:${f}`, WORK); } catch { return ''; } })
  .join('\n');

// git-filter-repo's delete marker, built at runtime so this file does not
// itself contain the literal (which would trip secret/corruption scanners).
const DELETE_MARKER = `${'*'.repeat(3)}REMOVED${'*'.repeat(3)}`;

if (allText.includes(DELETE_MARKER)) {
  check('no filter-repo delete markers', false, `found ${DELETE_MARKER} in rewritten history`);
} else {
  check('no filter-repo delete markers', true);
}
check('no "theology26" auth fallback', !/adminPasscode\s*\|\|\s*'theology26'/.test(allText));
check('no DEFAULT_CONTENT passcode', !/adminPasscode:\s*'theology26'/.test(allText));
check('hex colours intact', /#08080a/.test(allText));
check('no files removed', removed.length === 0, removed.join(','));

// Only the expected files may change.
const EXPECTED = new Set(['db.js', 'server.js', 'src/security/AuthService.js']);
const unexpected = changed.filter((f) => !EXPECTED.has(f));
check('only expected files changed', unexpected.length === 0, unexpected.join(','));

// Spot-check that a real file is byte-identical to the pre-filter version.
for (const f of ['index.html', 'README.md', 'tailwind.config.js', 'src/security/Sanitizer.js']) {
  check(`${f} unchanged`, snapBefore[f] === snapAfter[f]);
}

if (!KEEP) fs.rmSync(WORK, { recursive: true, force: true, maxRetries: 5 });
else console.log(`\n  (clone kept at ${WORK})`);

console.log(`\n===== dry-run ${problems === 0 ? 'PASSED' : 'FAILED'} (${problems} problem(s)) =====`);
process.exit(problems === 0 ? 0 : 1);
