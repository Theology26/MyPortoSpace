'use strict';

const crypto = require('crypto');

/**
 * Stateless cryptographic helpers.
 * Single Responsibility: hashing, constant-time comparison, HMAC tokens.
 */
class CryptoUtil {
  static HASH_ALGO = 'scrypt';
  static SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 };

  /** Derive a scrypt hash for a plaintext secret. */
  static hashSecret(plaintext, salt = crypto.randomBytes(16).toString('hex')) {
    const derived = crypto.scryptSync(
      String(plaintext),
      salt,
      CryptoUtil.SCRYPT_PARAMS.keylen,
      { N: CryptoUtil.SCRYPT_PARAMS.N, r: CryptoUtil.SCRYPT_PARAMS.r, p: CryptoUtil.SCRYPT_PARAMS.p }
    );
    return { algo: CryptoUtil.HASH_ALGO, salt, hash: derived.toString('hex') };
  }

  /**
   * Verify a plaintext secret against a stored scrypt record.
   * Returns false (never throws) for malformed records.
   */
  static verifySecret(plaintext, record) {
    if (!record || !record.salt || !record.hash) return false;
    try {
      const { hash } = CryptoUtil.hashSecret(plaintext, record.salt);
      return CryptoUtil.timingSafeEqualHex(hash, record.hash);
    } catch {
      return false;
    }
  }

  /** Constant-time string comparison, safe for unequal lengths. */
  static timingSafeEqual(a, b) {
    const bufA = Buffer.from(String(a), 'utf8');
    const bufB = Buffer.from(String(b), 'utf8');
    if (bufA.length !== bufB.length) {
      // Still burn a comparison so length isn't leaked by timing alone.
      crypto.timingSafeEqual(bufA, bufA);
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  }

  /** Constant-time comparison of two hex digests. */
  static timingSafeEqualHex(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    try {
      return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
    } catch {
      return false;
    }
  }

  /** Sign a payload with HMAC-SHA256, returning a base64url signature. */
  static sign(payloadB64, key) {
    return crypto.createHmac('sha256', key).update(payloadB64).digest('base64url');
  }
}

module.exports = CryptoUtil;
