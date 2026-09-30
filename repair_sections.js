'use strict';

/**
 * One-off repair: restore sections damaged by a bad history-rewrite pass.
 *
 * `general` had been reduced to a single field and `githubStats` held
 * placeholder text. Both are rebuilt from db.js DEFAULT_CONTENT, preserving
 * any live GitHub credentials.
 *
 * Usage: node repair_sections.js
 */

const ContentRepository = require('./src/repositories/ContentRepository');
const ContentService = require('./src/services/ContentService');
const GitHubSyncService = require('./src/services/GitHubSyncService');
const { DEFAULT_CONTENT } = require('./db');

// Built at runtime so this file does not contain the literal marker.
const MARKER = `${'*'.repeat(3)}REMOVED${'*'.repeat(3)}`;
const isCorrupt = (v) => JSON.stringify(v || {}).includes(MARKER);

(async () => {
  const repository = new ContentRepository();
  await repository.init();
  const service = new ContentService(repository);
  const content = await service.getAll();

  const corrupted = Object.entries(content).filter(([, v]) => isCorrupt(v)).map(([k]) => k);
  console.log('corrupted sections:', corrupted.length ? corrupted.join(', ') : '(none)');

  // 1. general -- rebuild from defaults, keep live credentials.
  const liveGeneral = content.general || {};
  const general = { ...DEFAULT_CONTENT.general };
  if (liveGeneral.githubUsername) general.githubUsername = liveGeneral.githubUsername;
  if (liveGeneral.githubToken) general.githubToken = liveGeneral.githubToken;
  await service.update({ general });
  console.log('general rebuilt:', Object.keys(general).length, 'fields');

  // 2. githubStats -- back to defaults; the auto-sync refreshes it at boot.
  await service.update({ githubStats: DEFAULT_CONTENT.githubStats });
  console.log('githubStats reset to defaults (auto-sync will refresh)');

  // 3. Verify nothing remains corrupted.
  const after = await service.getAll();
  const stillBad = Object.entries(after).filter(([, v]) => isCorrupt(v)).map(([k]) => k);
  console.log('still corrupted:', stillBad.length ? stillBad.join(', ') : '(none)');
  console.log('siteTitle:', after.general.siteTitle);
  console.log('certificates:', (after.certificatesList || []).length);

  process.exit(stillBad.length === 0 ? 0 : 1);
})();
