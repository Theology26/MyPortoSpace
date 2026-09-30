'use strict';

/**
 * Fail-closed auth checks: with no passcode configured, nothing must work.
 * Guards against a predictable fallback key allowing forged sessions.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

let pass = 0;
let fail = 0;
const chk = (n, c, x) => { if (c) { pass++; console.log(`PASS  ${n}`); } else { fail++; console.log(`FAIL  ${n}${x !== undefined ? `  (${x})` : ''}`); } };

/** Build an AuthService over a repository that has no passcode at all. */
function makeBareAuthService() {
  const ContentRepository = require('./src/repositories/ContentRepository');
  const AuthService = require('./src/security/AuthService');
  const repository = new ContentRepository();
  // Empty content: no `security` section, no legacy adminPasscode.
  const bare = {
    getAll: async () => ({ general: { siteTitle: 'x' } }),
    getSection: async (s) => (s === 'general' ? { siteTitle: 'x' } : undefined),
    setSection: async () => {},
    updateAll: async () => {},
  };
  return new AuthService(bare);
}

(async () => {
  delete process.env.ADMIN_PASSCODE;

  const auth = makeBareAuthService();

  console.log('=== Fail-closed with no passcode configured ===');
  chk('no env passcode', auth.getEnvPasscode() === null);
  chk('no stored record', (await auth.getStoredRecord()) === null);
  chk('no legacy passcode', (await auth.getLegacyPasscode()) === null);

  const key = await auth.getSigningKey();
  chk('signing key is null (not a derived default)', key === null, typeof key);

  chk('no passcode can verify', (await auth.verifyPasscode('')) === false);
  chk('random passcode rejected', (await auth.verifyPasscode('anything-at-all')) === false);
  chk('null passcode rejected', (await auth.verifyPasscode(null)) === false);
  chk('object passcode rejected', (await auth.verifyPasscode({ toString: () => 'x' })) === false);

  chk('arbitrary token rejected', (await auth.verifyToken('a.b')) === false);
  chk('empty token rejected', (await auth.verifyToken('')) === false);
  chk('forged admin payload rejected', (await auth.verifyToken('eyJyb2xlIjoiYWRtaW4iLCJleHAiOjk5OTk5OTk5OTk5OTl9fQ.aaaa')) === false);

  let threw = false;
  try { await auth.issueToken(); } catch { threw = true; }
  chk('issueToken throws instead of signing with a default', threw);

  console.log('\n=== No literal default passcode remains in source ===');
  const src = fs.readFileSync(path.join(__dirname, 'src', 'security', 'AuthService.js'), 'utf8');
  chk('no DEFAULT_PASSPHRASE constant', !/DEFAULT_PASSPHRASE/.test(src));
  chk('no crypto_scryptKey(null) style fallback', !/scryptSync\(String\(\s*(null|undefined)\s*\)/.test(src));
  chk('fail-closed documented', /no passcode is valid/i.test(src));

  console.log(`\n===== ${pass} passed, ${fail} failed =====`);
  process.exit(fail === 0 ? 0 : 1);
})();
