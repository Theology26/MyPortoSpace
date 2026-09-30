'use strict';

/**
 * Sliding-window rate limiter keyed by client IP.
 *
 * IP resolution is opt-in: forwarded headers are attacker-controlled, so they
 * are only trusted when TRUST_PROXY is explicitly enabled (behind Vercel/ nginx).
 */
class RateLimiter {
  /**
   * @param {object} opts
   * @param {number} opts.maxRequests   Requests allowed per window.
   * @param {number} opts.windowMs      Window length in milliseconds.
   * @param {string} opts.message       Message returned when the limit trips.
   * @param {number} [opts.maxKeys]     Hard cap on tracked keys (memory guard).
   */
  constructor({ maxRequests, windowMs, message, maxKeys = 5000 }) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.message = message;
    this.maxKeys = maxKeys;
    this.store = new Map();
  }

  /** Trust X-Forwarded-For only when explicitly behind a known proxy. */
  static resolveClientIp(req) {
    if (process.env.TRUST_PROXY === '1') {
      const fwd = req.headers['x-forwarded-for'];
      if (typeof fwd === 'string' && fwd.length > 0) {
        const first = fwd.split(',')[0].trim();
        if (first) return first;
      }
    }
    return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : '127.0.0.1';
  }

  /** Record a hit and report whether it is allowed. */
  hit(key, now = Date.now()) {
    let entry = this.store.get(key);

    if (!entry) {
      if (this.store.size >= this.maxKeys) this.sweep(now);
      // Still full after sweep: refuse to track new keys rather than grow unbounded.
      if (this.store.size >= this.maxKeys) return { allowed: false, retryAfter: Math.ceil(this.windowMs / 1000) };
      entry = { count: 0, resetTime: now + this.windowMs };
      this.store.set(key, entry);
    }

    if (now > entry.resetTime) {
      entry.count = 1;
      entry.resetTime = now + this.windowMs;
    } else {
      entry.count += 1;
    }

    if (entry.count > this.maxRequests) {
      return { allowed: false, retryAfter: Math.max(1, Math.ceil((entry.resetTime - now) / 1000)) };
    }
    return { allowed: true, retryAfter: 0 };
  }

  /** Drop expired entries. */
  sweep(now = Date.now()) {
    for (const [key, entry] of this.store) {
      if (now > entry.resetTime) this.store.delete(key);
    }
  }

  /** Clear a key's counter (e.g. after a successful login). */
  reset(key) {
    this.store.delete(key);
  }

  /** Express middleware. */
  middleware() {
    return (req, res, next) => {
      const key = RateLimiter.resolveClientIp(req);
      const result = this.hit(key);
      if (!result.allowed) {
        res.setHeader('Retry-After', String(result.retryAfter));
        return res.status(429).json({
          success: false,
          error: this.message,
          retryAfter: result.retryAfter,
        });
      }
      next();
    };
  }

  /** Unref'd interval keeps sweeps from pinning the event loop. */
  startSweeper(intervalMs = 5 * 60 * 1000) {
    if (this._timer) return;
    this._timer = setInterval(() => this.sweep(), intervalMs);
    if (this._timer.unref) this._timer.unref();
  }
}

module.exports = RateLimiter;
