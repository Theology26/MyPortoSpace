'use strict';

/**
 * Interactively rotate the admin passcode.
 *
 * Hashes the new value with scrypt and stores it in the `security` section,
 * which AuthService reads in preference to any legacy plaintext.
 *
 * Usage: node reset-passcode.js
 */

const readline = require('readline');
const ContentRepository = require('./src/repositories/ContentRepository');
const AuthService = require('./src/security/AuthService');
const CryptoUtil = require('./src/security/CryptoUtil');

const MIN_LENGTH = 12;

function ask(question, { silent = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (silent) {
      // Suppress echo while typing.
      const onData = (char) => {
        if (['\n', '\r', ''].includes(String(char))) process.stdin.removeListener('data', onData);
        else readline.moveCursor(process.stdout, -1000, 0), readline.clearLine(process.stdout, 1);
      };
      process.stdin.on('data', onData);
    }
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

(async () => {
  if (process.env.ADMIN_PASSCODE) {
    console.error('ADMIN_PASSCODE is set in the environment and takes precedence over the database.');
    console.error('Update the environment variable too, or unset it, then re-run.');
    process.exit(1);
  }

  const repository = new ContentRepository();
  await repository.init();
  const auth = new AuthService(repository);

  const pass = await ask('New admin passcode (min 12 chars): ', { silent: true });
  const confirm = await ask('Confirm: ', { silent: true });

  if (pass.length < MIN_LENGTH) {
    console.error(`\nToo short. Minimum ${MIN_LENGTH} characters.`);
    process.exit(1);
  }
  if (pass !== confirm) {
    console.error('\nValues do not match.');
    process.exit(1);
  }
  if (pass === 'theology26') {
    console.error('\nRefusing: this passcode is public in the repository history.');
    process.exit(1);
  }

  await auth.setPasscodeHash(pass);

  // Prove the new value works and the stored record is a hash, not plaintext.
  const ok = await auth.verifyPasscode(pass);
  const record = await auth.getStoredRecord();
  const general = await repository.getSection('general');

  console.log('\nPasscode updated.');
  console.log(`  verify new passcode : ${ok ? 'OK' : 'FAILED'}`);
  console.log(`  algorithm          : ${record.algo}`);
  console.log(`  salt (${record.salt.length} hex chars, not secret)`);
  console.log(`  plaintext scrubbed : ${!('adminPasscode' in general) ? 'yes' : 'NO - still present!'}`);
  console.log('\nRemember to update ADMIN_CREDENTIALS.txt and the Vercel env var.');

  process.exit(ok ? 0 : 1);
})();
