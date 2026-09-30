'use strict';

/**
 * Resolves the admin passcode for local test runs, in priority order:
 *
 *   1. ADMIN_PASSCODE environment variable
 *   2. ADMIN_PASSCODE= line in .env
 *   3. ADMIN_PASSCODE= line in ADMIN_CREDENTIALS.txt
 *
 * The legacy default ('theology26') is intentionally NOT a fallback: it leaked
 * in public git history and is refused by set-passcode.js.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

/** Read `KEY=value` from a dotenv-style file, ignoring comments. */
function readKeyValue(filePath, key) {
  if (!fs.existsSync(filePath)) return null;
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    if (trimmed.slice(0, idx).trim() !== key) continue;
    const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (value) return value;
  }
  return null;
}

function resolvePasscode() {
  if (process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim()) {
    return process.env.ADMIN_PASSCODE.trim();
  }

  const fromEnv = readKeyValue(path.join(ROOT, '.env'), 'ADMIN_PASSCODE');
  if (fromEnv) return fromEnv;

  const fromFile = readKeyValue(path.join(ROOT, 'ADMIN_CREDENTIALS.txt'), 'ADMIN_PASSCODE');
  if (fromFile) return fromFile;

  const err = new Error(
    'Could not resolve the admin passcode.\n' +
    '  Set the ADMIN_PASSCODE environment variable, add it to .env, or add an\n' +
    '  "ADMIN_PASSCODE=..." line to ADMIN_CREDENTIALS.txt.'
  );
  err.code = 'EPASSCODE';
  throw err;
}

module.exports = { resolvePasscode, readKeyValue };
