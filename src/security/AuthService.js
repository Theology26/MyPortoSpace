'use strict';

const CryptoUtil = require('./CryptoUtil');

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

/**
 * AuthService — owns passcode verification and session token issuance.
 *
 * Secret resolution order (first match wins):
 *   1. process.env.ADMIN_PASSCODE   (authoritative; required on serverless)
 *   2. database `security` section  (scrypt hash, auto-migrated)
 *   3. database `general.adminPasscode` (legacy plaintext, auto-migrated on first use)
 *
 * If none of these exist, no passcode is valid and no token can be signed.
 * There is deliberately NO built-in default: a hardcoded fallback would be an
 * open backdoor, and a fallback signing key would let anyone forge a session.
 *
 * The raw passcode is never returned to clients. Successful logins yield a
 * short-lived HMAC-signed bearer token instead.
 */
class AuthService {
  constructor(repository) {
    this.repository = repository;
  }

  /** Environment passcode takes precedence over anything stored. */
  getEnvPasscode() {
    const raw = process.env.ADMIN_PASSCODE;
    return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null;
  }

  /** Stored scrypt record, if one has been provisioned. */
  async getStoredRecord() {
    const security = await this.repository.getSection('security');
    if (security && security.algo === 'scrypt' && security.salt && security.hash) {
      return security;
    }
    return null;
  }

  /** Legacy plaintext passcode still sitting in the `general` section. */
  async getLegacyPasscode() {
    const general = await this.repository.getSection('general');
    const legacy = general && general.adminPasscode;
    return typeof legacy === 'string' && legacy !== '' ? legacy : null;
  }

  /**
   * Verify a candidate passcode.
   * Also performs one-time migration of legacy plaintext into a scrypt hash.
   */
  async verifyPasscode(candidate) {
    if (typeof candidate !== 'string' || candidate === '') return false;

    const record = await this.getStoredRecord();
    if (record) {
      return CryptoUtil.verifySecret(candidate, record);
    }

    const envPass = this.getEnvPasscode();
    if (envPass) {
      return CryptoUtil.timingSafeEqual(candidate, envPass);
    }

    const legacy = await this.getLegacyPasscode();
    if (legacy && CryptoUtil.timingSafeEqual(candidate, legacy)) {
      // Migrate on first successful use so plaintext stops being the source of truth.
      await this.setPasscodeHash(legacy);
      return true;
    }
    return false;
  }

  /** Persist a scrypt hash for the given passcode. */
  async setPasscodeHash(passcode) {
    const { algo, salt, hash } = CryptoUtil.hashSecret(passcode);
    await this.repository.setSection('security', {
      algo,
      salt,
      hash,
      updatedAt: new Date().toISOString(),
    });
    // Scrub the legacy plaintext field; it is no longer needed.
    const general = await this.repository.getSection('general');
    if (general && typeof general.adminPasscode === 'string') {
      delete general.adminPasscode;
      await this.repository.setSection('general', general);
    }
  }

  /**
   * Stable HMAC key for signing session tokens. Derived from the passcode so
   * tokens stay valid across cold starts without storing a second secret.
   *
   * Returns null when no passcode is configured. That must invalidate every
   * token rather than fall back to a predictable key, otherwise anyone who
   * knows the derivation could forge an admin session.
   */
  async getSigningKey() {
    const record = await this.getStoredRecord();
    if (record) return Buffer.from(record.hash, 'hex');
    const envPass = this.getEnvPasscode();
    if (envPass) return deriveKey(envPass);
    const legacy = await this.getLegacyPasscode();
    if (legacy) return deriveKey(legacy);
    return null;
  }

  /** Issue a signed, expiring bearer token. */
  async issueToken() {
    const key = await this.getSigningKey();
    if (!key) {
      throw new Error('Cannot issue a token: no admin passcode is configured');
    }
    const payload = {
      role: 'admin',
      exp: Date.now() + TOKEN_TTL_MS,
      jti: require('crypto').randomBytes(8).toString('hex'),
    };
    const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    return `${body}.${CryptoUtil.sign(body, key)}`;
  }

  /** Validate a bearer token's signature and expiry. */
  async verifyToken(token) {
    if (typeof token !== 'string' || !token.includes('.')) return false;
    const [body, sig] = token.split('.');
    if (!body || !sig) return false;
    const key = await this.getSigningKey();
    // No configured passcode means no key, therefore no valid token.
    if (!key) return false;
    if (!CryptoUtil.timingSafeEqual(sig, CryptoUtil.sign(body, key))) return false;
    try {
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
      return payload.role === 'admin' && Number(payload.exp) > Date.now();
    } catch {
      return false;
    }
  }

  /** Extract a bearer token from an Authorization header value. */
  static extractBearer(headerValue) {
    if (typeof headerValue !== 'string') return null;
    const match = /^Bearer\s+(.+)$/i.exec(headerValue.trim());
    return match ? match[1].trim() : null;
  }
}

function deriveKey(passphrase) {
  return require('crypto').scryptSync(String(passphrase), 'portfolio-token-key', 32);
}

module.exports = AuthService;
