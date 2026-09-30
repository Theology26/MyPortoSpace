'use strict';

/**
 * One-off: register an uploaded certificate image in the portfolio content.
 * Usage: node add_certificate.js <uploadedUrl> "<title>" "<issuer>" "<year>" [aspectRatio]
 */

const ContentRepository = require('./src/repositories/ContentRepository');
const ContentService = require('./src/services/ContentService');

(async () => {
  const [url, title, issuer, year, aspectRatio] = process.argv.slice(2);
  if (!url || !title) {
    console.error('Usage: node add_certificate.js <url> <title> [issuer] [year] [aspectRatio]');
    process.exit(1);
  }

  const repository = new ContentRepository();
  await repository.init();
  const service = new ContentService(repository);

  const content = await service.getAll();
  const list = Array.isArray(content.certificatesList) ? [...content.certificatesList] : [];

  if (list.some((c) => c.imageUrl === url)) {
    console.log('Already registered:', url);
    process.exit(0);
  }

  const entry = {
    id: `cert-${Date.now().toString(36)}`,
    title,
    issuer: issuer || 'NVIDIA',
    imageUrl: url,
    linkUrl: content.general?.githubUrl || 'https://github.com/Theology26',
    aspectRatio: aspectRatio || 'aspect-[4/5]',
    badge: 'OFFICIAL CERTIFICATE',
    date: year || '2026',
  };

  list.unshift(entry);
  await service.update({ certificatesList: list });

  const after = await service.getAll();
  console.log(`Added "${title}" — certificatesList now has ${after.certificatesList.length} entries:`);
  after.certificatesList.forEach((c, i) => console.log(`  ${i + 1}. ${c.title}  [${c.imageUrl}]`));

  process.exit(0);
})();
