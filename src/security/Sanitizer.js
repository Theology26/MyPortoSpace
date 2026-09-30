'use strict';

const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// Built from escaped strings so no literal control characters end up in source.
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001f\\u007f]', 'g');
// Characters unsafe in a Content-Disposition filename (C0/DEL excluded, handled above).
const FILENAME_UNSAFE = new RegExp('[\\r\\n"\\\\/:*?<>|]', 'g');

/**
 * Sanitizer — output encoding and hostile-payload stripping.
 */
class Sanitizer {
  /**
   * Recursively drop prototype-pollution vectors and cap recursion depth.
   */
  static sanitizeDeep(value, depth = 0) {
    if (depth > 20) return null;
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map((item) => Sanitizer.sanitizeDeep(item, depth + 1));

    const clean = {};
    for (const [key, val] of Object.entries(value)) {
      if (BLOCKED_KEYS.has(key)) continue;
      clean[key] = Sanitizer.sanitizeDeep(val, depth + 1);
    }
    return clean;
  }

  /** HTML-escape a value for safe interpolation into markup. */
  static text(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Allow only http(s), mailto, and site-relative URLs.
   * Everything else (javascript:, data:, vbscript:) collapses to '#'.
   */
  static url(value) {
    if (typeof value !== 'string') return '#';
    const trimmed = value.trim().replace(/\s+/g, '').replace(CONTROL_CHARS, '');
    if (trimmed === '') return '#';

    // Site-relative paths, but never protocol-relative (//evil.com).
    if (/^\//.test(trimmed)) {
      if (trimmed.startsWith('//')) return '#';
      return trimmed.replace(/"/g, '%22').replace(/'/g, '%27');
    }

    if (/^https?:\/\//i.test(trimmed)) {
      try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '#';
        return parsed.toString().replace(/"/g, '%22').replace(/'/g, '%27');
      } catch {
        return '#';
      }
    }

    if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(trimmed)) return trimmed;
    return '#';
  }

  /**
   * Strip header/filename injection characters and collapse whitespace.
   * Used for Content-Disposition filenames.
   */
  static filename(value, fallback = 'document') {
    const base = String(value === null || value === undefined ? '' : value)
      .replace(CONTROL_CHARS, '')
      .replace(FILENAME_UNSAFE, '')
      .replace(/\s+/g, '_')
      .replace(/^[.\s]+/, '')
      .slice(0, 80);
    return base || fallback;
  }
}

module.exports = Sanitizer;
