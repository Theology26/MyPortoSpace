'use strict';

const AuthService = require('../security/AuthService');

/**
 * AuthMiddleware — Express guards for authenticated routes.
 */
class AuthMiddleware {
  constructor(authService) {
    this.authService = authService;
  }

  /**
   * Require a valid admin bearer token.
   * Accepts either a session token (from /api/auth/login) or the raw
   * ADMIN_PASSCODE, so existing clients keep working.
   */
  requireAdmin() {
    return async (req, res, next) => {
      try {
        const token = AuthService.extractBearer(req.headers.authorization);
        if (!token) {
          return res.status(401).json({ success: false, error: 'Unauthorized: Missing credentials' });
        }

        if (await this.authService.verifyToken(token)) return next();

        if (await this.authService.verifyPasscode(token)) return next();

        return res.status(401).json({ success: false, error: 'Unauthorized: Invalid credentials' });
      } catch (err) {
        return res.status(500).json({ success: false, error: 'Authentication check failed' });
      }
    };
  }
}

module.exports = AuthMiddleware;
