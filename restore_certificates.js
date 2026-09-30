'use strict';

/**
 * Ensures the built-in certificates from db.js DEFAULT_CONTENT are present in
 * the stored list. Restores entries that were dropped by an overwrite.
 *
 * Usage: node restore_certificates.js
 */

const ContentRepository = require('./src/repositories/ContentRepository');
const ContentService = require('./src/services/ContentService');
const { DEFAULT_CONTENT } = require('./db');

(async () => {
  const repository = new ContentRepository();
  await repository.init();
  const service = new ContentService(repository);

  const content = await service.getAll();
  const current = Array.isArray(content.certificatesList) ? [...content.certificatesList] : [];

  const present = new Set(current.map((c) => c.id));
  const missing = DEFAULT_CONTENT.certificatesList.filter((c) => !present.has(c.id));

  if (missing.length === 0) {
    console.log(`Nothing to restore. ${current.length} certificates present.`);
  } else {
    console.log(`Restoring ${missing.length} built-in certificate(s):`);
    missing.forEach((c) => console.log(`  + ${c.title}`));
    // Append, so the newest curated entries stay at the top.
    await service.update({ certificatesList: [...current, ...missing] });
  }

  const after = await service.getAll();
  console.log(`\ncertificatesList now has ${after.certificatesList.length} entries:`);
  after.certificatesList.forEach((c, i) => {
    const src = /\/Assets\/uploads\//.test(c.imageUrl || '') ? 'LOCAL' : 'web';
    console.log(`  ${String(i + 1).padStart(2)}. [${src}] ${c.title}`);
  });

  process.exit(0);
})();
