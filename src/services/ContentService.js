'use strict';

/**
 * ContentService — shapes portfolio content for public vs. authenticated use.
 *
 * The public projection is an ALLOWLIST, not a blocklist. Anything not named
 * here is withheld, so adding a new secret-bearing field or section later
 * cannot silently start leaking through /api/content.
 */

// Sections safe to expose anonymously (the exact set the frontend reads).
const PUBLIC_SECTIONS = [
  'general',
  'hero',
  'lanyard',
  'techTags',
  'projectsList',
  'certificatesList',
  'projectSpotlight',
  'spaceConfig',
  'cvData',
  'githubStats',
];

// Fields stripped from any section before it goes out.
const SECRET_FIELDS = ['adminPasscode', 'githubToken', 'adminPasscodeHash', 'password', 'secret', 'token', 'apiKey'];

class ContentService {
  constructor(repository) {
    this.repository = repository;
  }

  getAll() {
    return this.repository.getAll();
  }

  /**
   * Content safe for anonymous consumption. Returns a copy; the caller's
   * source object is never mutated.
   */
  toPublic(content) {
    const source = content || {};
    const out = {};

    for (const section of PUBLIC_SECTIONS) {
      if (!(section in source)) continue;
      out[section] = ContentService.stripSecrets(source[section]);
    }

    return out;
  }

  /** Deep-clone a section with secret-looking keys removed at every depth. */
  static stripSecrets(value, depth = 0) {
    if (depth > 20) return null;
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map((v) => ContentService.stripSecrets(v, depth + 1));

    const clean = {};
    for (const [key, val] of Object.entries(value)) {
      const lower = key.toLowerCase();
      if (lower === '__proto__' || lower === 'constructor' || lower === 'prototype') continue;
      if (SECRET_FIELDS.includes(lower)) continue;
      // Defence in depth: any key that looks like a credential is dropped.
      if (/(passcode|password|secret|apikey|api_key|privatekey|credential|accesstoken|bearertoken)/i.test(key)) continue;
      clean[key] = ContentService.stripSecrets(val, depth + 1);
    }
    return clean;
  }

  /** Full content, secrets included — authenticated callers only. */
  toPrivate(content) {
    return content;
  }

  /** Merge a validated payload into stored content. */
  async update(payload) {
    return this.repository.updateAll(payload);
  }

  /** Remove a stored section entirely. */
  async remove(section) {
    return this.repository.removeSection(section);
  }
}

module.exports = ContentService;
module.exports.PUBLIC_SECTIONS = PUBLIC_SECTIONS;
module.exports.SECRET_FIELDS = SECRET_FIELDS;
