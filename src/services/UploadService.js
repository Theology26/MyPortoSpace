'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'Assets', 'uploads');
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB per file

const ALLOWED = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
  ['image/avif', '.avif'],
  ['image/svg+xml', '.svg'],
]);

/**
 * UploadService — stores admin-uploaded images as real files on disk.
 *
 * Images are deliberately NOT stored as base64 inside the content JSON:
 * base64 inflates payloads ~33% and would bloat /api/content, which is public
 * and cached. Files land in /Assets/uploads and are served by the existing
 * static handler with immutable cache headers.
 */
class UploadService {
  constructor({ uploadDir = UPLOAD_DIR, maxBytes = MAX_BYTES } = {}) {
    this.uploadDir = uploadDir;
    this.maxBytes = maxBytes;
    fs.mkdirSync(this.uploadDir, { recursive: true });

    this.storage = multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, this.uploadDir),
      // Never trust the client filename: random name, extension from the real mime type.
      filename: (_req, file, cb) => {
        const ext = ALLOWED.get(file.mimetype) || path.extname(file.originalname || '').toLowerCase();
        const safeExt = /^\.[a-z0-9]{2,5}$/.test(ext) ? ext : '.bin';
        cb(null, `${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}${safeExt}`);
      },
    });

    // Reject wrong mimetypes before anything touches the disk.
    this.fileFilter = (_req, file, cb) => {
      if (!ALLOWED.has(file.mimetype)) {
        return cb(Object.assign(new Error(`Unsupported file type: ${file.mimetype}`), { status: 415 }));
      }
      cb(null, true);
    };

    this.middleware = multer({
      storage: this.storage,
      fileFilter: this.fileFilter,
      limits: { fileSize: this.maxBytes, files: 1, fields: 4 },
    }).single('image');
  }

  /** Public path for a stored file, derived from its on-disk name. */
  static urlFor(filename) {
    return `/Assets/uploads/${path.basename(filename)}`;
  }

  /** Delete a previously uploaded file. Path is confined to the upload dir. */
  static remove(urlPath) {
    if (typeof urlPath !== 'string') return false;
    const name = path.basename(urlPath);
    const target = path.join(UPLOAD_DIR, name);
    if (path.dirname(target) !== path.resolve(UPLOAD_DIR)) return false;
    try {
      fs.unlinkSync(target);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = { UploadService, ALLOWED, MAX_BYTES, UPLOAD_DIR };
