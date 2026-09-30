'use strict';

/**
 * Applies a new admin passcode non-interactively (for scripted rotation).
 * Usage: node set-passcode.js <newPasscode>
 */

const ContentRepository = require('./src/repositories/ContentRepository');
const AuthService = require('./src/security/AuthService');

(async () => {
  const pass = process.argv[2];

  if (!pass) {
    console.error('Usage: node set-passcode.js <newPasscode>');
    process.exit(1);
  }
  if (pass.length < 12) {
    console.error('Refusing: minimum 12 characters.');
    process.exit(1);
  }
  if (pass === 'theology26') {
    console.error('Refusing: this passcode is public in the repository history.');
    process.exit(1);
  }
  if (process.env.ADMIN_PASSCODE) {
    console.error('ADMIN_PASSCODE is set in the environment and would override the database.');
    process.exit(1);
  }

  const repository = new ContentRepository();
  await repository.init();
  const auth = new AuthService(repository);

  await auth.setPasscodeHash(pass);

  const ok = await auth.verifyPasscode(pass);
  const oldOk = await auth.verifyPasscode('theology26');
  const record = await auth.getStoredRecord();
  const general = await repository.getSection('general');

  console.log('new passcode accepted  :', ok);
  console.log('old passcode rejected  :', !oldOk);
  console.log('algorithm              :', record.algo);
  console.log('plaintext scrubbed     :', !('adminPasscode' in general));

  process.exit(ok && !oldOk ? 0 : 1);
})();
