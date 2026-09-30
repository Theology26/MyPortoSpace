'use strict';

/**
 * SecurityHeaders — centralised response hardening.
 */
class SecurityHeaders {
  /**
   * Content-Security-Policy directives.
   * `unsafe-eval` is required by the in-browser JSX transpiler; once the app is
   * precompiled it can be dropped (see BABEL_RUNTIME flag below).
   */
  static csp() {
    const needsEval = process.env.BABEL_RUNTIME !== '0';
    const scriptSrc = [
      "'self'",
      "'unsafe-inline'",
      ...(needsEval ? ["'unsafe-eval'"] : []),
      'blob:',
      'https://www.gstatic.com',
      'https://cdn.tailwindcss.com',
      'https://unpkg.com',
      'https://cdnjs.cloudflare.com',
      'https://cdn.jsdelivr.net',
      'https://fonts.googleapis.com',
      'https://va.vercel-scripts.com',
    ].join(' ');

    return [
      "default-src 'self'",
      `script-src ${scriptSrc}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' blob: data: https: wss:",
      "worker-src 'self' blob:",
      "media-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; ');
  }

  /** Apply the full header set to a response. */
  static apply(_req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('Content-Security-Policy', SecurityHeaders.csp());

    // Only meaningful over TLS; harmless otherwise.
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    return next();
  }

  /** Keep admin surfaces out of search indexes. */
  static noIndex(res) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.setHeader('Cache-Control', 'no-store');
  }
}

module.exports = SecurityHeaders;
