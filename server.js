'use strict';

const express = require('express');
const path = require('path');
const compression = require('compression');

const ContentRepository = require('./src/repositories/ContentRepository');
const ContentService = require('./src/services/ContentService');
const CvService = require('./src/services/CvService');
const { UploadService } = require('./src/services/UploadService');
const GitHubSyncService = require('./src/services/GitHubSyncService');
const AuthService = require('./src/security/AuthService');
const AuthMiddleware = require('./src/middleware/AuthMiddleware');
const RateLimiter = require('./src/security/RateLimiter');
const SecurityHeaders = require('./src/security/SecurityHeaders');
const Sanitizer = require('./src/security/Sanitizer');

const app = express();
const PORT = process.env.PORT || 3000;

// ═══════════════════════════════════════════════════════
// DEPENDENCY WIRING
// ═══════════════════════════════════════════════════════
const repository = new ContentRepository();
const contentService = new ContentService(repository);
const githubSyncService = new GitHubSyncService(repository);
const authService = new AuthService(repository);
const authMiddleware = new AuthMiddleware(authService);

const loginRateLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 15 * 60 * 1000,
  message: 'Security lockout: too many failed login attempts. Try again in 15 minutes.',
});
const contentUpdateRateLimiter = new RateLimiter({
  maxRequests: 30,
  windowMs: 10 * 60 * 1000,
  message: 'Rate limit exceeded: too many content update requests.',
});
const githubSyncRateLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 10 * 60 * 1000,
  message: 'GitHub sync rate limit reached: maximum 5 syncs per 10 minutes.',
});
const generalRateLimiter = new RateLimiter({
  maxRequests: 180,
  windowMs: 60 * 1000,
  message: 'Too many requests. Please slow down.',
});
const uploadRateLimiter = new RateLimiter({
  maxRequests: 20,
  windowMs: 10 * 60 * 1000,
  message: 'Upload rate limit reached: maximum 20 images per 10 minutes.',
});

const uploadService = new UploadService();

for (const limiter of [loginRateLimiter, contentUpdateRateLimiter, githubSyncRateLimiter, generalRateLimiter, uploadRateLimiter]) {
  limiter.startSweeper();
}

// ═══════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === '1');

app.use(SecurityHeaders.apply);
app.use(compression());

/**
 * Same-origin by default. CORS is opt-in via CORS_ORIGINS so a wildcard can
 * never expose the API to arbitrary sites.
 */
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// 10MB bodies were a memory-exhaustion vector; real payloads are a few KB.
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '256kb' }));

// Body/upload errors are user-facing conditions, not crashes — handled at the
// end of the stack (see errorHandler below) so it also catches route errors.

app.use('/api', generalRateLimiter.middleware());

// Precompiled client bundles. Content-addressed by build time, so cache hard.
app.use(
  express.static(path.join(__dirname, 'public'), {
    maxAge: '7d',
    index: false,
    setHeaders(res) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  })
);

const ASSETS_DIR = path.join(__dirname, 'Assets');
app.use(
  '/Assets',
  express.static(ASSETS_DIR, {
    maxAge: '30d',
    immutable: true,
    // Model/texture payloads compress extremely well.
    setHeaders(res, filePath) {
      if (/\.(glb|gltf|bin|ktx2)$/i.test(filePath)) {
        res.setHeader('Content-Type', 'model/gltf-binary');
      }
    },
    // Never serve editor backups from the public asset directory.
    dotfiles: 'ignore',
    index: false,
  })
);

// ═══════════════════════════════════════════════════════
// DATABASE BOOTSTRAP
// ═══════════════════════════════════════════════════════
let dbReady = false;
let dbInitPromise = null;

async function ensureDb() {
  if (dbReady) return;
  if (!dbInitPromise) {
    dbInitPromise = repository
      .init()
      .then(() => {
        dbReady = true;
        // Auto-sync runs on cold start. Opt out with GITHUB_AUTO_SYNC=0 when
        // you want to manage repository data entirely by hand.
        if (process.env.GITHUB_AUTO_SYNC !== '0') {
          githubSyncService
            .sync()
            .catch((err) => console.warn('[GitHub Auto-Sync Notice]', err.message));
        }
      })
      .catch((err) => {
        console.warn('Database initialization warning:', err.message);
        dbReady = true;
      });
  }
  return dbInitPromise;
}

app.use(async (req, res, next) => {
  try {
    await ensureDb();
  } catch (err) {
    console.error('[ensureDb]', err.message);
  }
  next();
});

// ═══════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════

// 1. Public portfolio content — secrets stripped.
app.get('/api/content', async (req, res) => {
  try {
    const content = await contentService.getAll();
    const publicContent = contentService.toPublic(content);
    const repos = await repository.getGithubRepos();
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json({ success: true, data: publicContent, content: publicContent, githubRepos: repos });
  } catch (err) {
    console.error('Error fetching content:', err);
    res.status(500).json({ success: false, error: 'Failed to load portfolio content' });
  }
});

// 2. Update content — admin only.
app.put(
  '/api/content',
  contentUpdateRateLimiter.middleware(),
  authMiddleware.requireAdmin(),
  async (req, res) => {
    try {
      const payload = Sanitizer.sanitizeDeep(req.body);
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return res.status(400).json({ success: false, error: 'Invalid payload shape' });
      }
      // Secrets are never client-writable through this endpoint.
      if (payload.general && typeof payload.general === 'object') {
        delete payload.general.githubToken;
      }
      await contentService.update(payload);
      const updated = await contentService.getAll();
      res.json({ success: true, message: 'Content updated successfully', data: contentService.toPublic(updated) });
    } catch (err) {
      console.error('Error updating content:', err);
      res.status(500).json({ success: false, error: 'Failed to update content' });
    }
  }
);

// 3. Admin login — returns a short-lived signed token, never the passcode.
app.post('/api/auth/login', loginRateLimiter.middleware(), async (req, res) => {
  try {
    const { passcode } = req.body || {};
    if (await authService.verifyPasscode(passcode)) {
      const ip = RateLimiter.resolveClientIp(req);
      loginRateLimiter.reset(ip);
      const token = await authService.issueToken();
      return res.json({
        success: true,
        token,
        message: 'Access pass verified // Developer Authorized',
      });
    }
    return res.status(401).json({ success: false, error: 'Access Denied: Invalid Security Passcode' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Login check failed' });
  }
});

// 3b. Image upload — admin only. Files are written to /Assets/uploads, which is
// served statically with immutable caching, so /api/content stays small.
app.post(
  '/api/upload',
  authMiddleware.requireAdmin(),
  uploadRateLimiter.middleware(),
  uploadService.middleware,
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image provided (field name must be "image")' });
    }
    res.json({
      success: true,
      url: UploadService.urlFor(req.file.filename),
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  }
);

// 4. GitHub stats (read-only, cached).
app.get('/api/github/stats', async (req, res) => {
  try {
    const content = await contentService.getAll();
    let stats = content.githubStats;
    // No cache yet and auto-sync disabled: try one sync, otherwise report.
    if (!stats && process.env.GITHUB_AUTO_SYNC === '0') {
      return res.status(503).json({
        success: false,
        error: 'GitHub stats not cached yet. Trigger a sync from /admin.',
      });
    }
    if (!stats || !Array.isArray(stats.languages) || stats.languages.length === 0) {
      const result = await githubSyncService.sync();
      stats = result.githubStats;
    }
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
    res.json({ success: true, stats });
  } catch (err) {
    console.error('GitHub stats error:', err);
    res.status(500).json({ success: false, error: 'Failed to load GitHub stats' });
  }
});

// 5. GitHub sync — admin only. Anonymous callers cannot write credentials.
app.post(
  '/api/github/sync',
  githubSyncRateLimiter.middleware(),
  authMiddleware.requireAdmin(),
  async (req, res) => {
    try {
      const { username, token } = req.body || {};
      if (username || token) {
        const content = await contentService.getAll();
        const gen = { ...(content.general || {}) };
        if (username) gen.githubUsername = String(username);
        if (token) gen.githubToken = String(token);
        delete gen.adminPasscode;
        await repository.setSection('general', gen);
      }

      const result = await githubSyncService.sync(username, token);
      const publicContent = contentService.toPublic(await contentService.getAll());
      res.json({
        success: true,
        count: result.totalCount,
        addedCount: result.addedCount,
        updatedCount: result.updatedCount,
        message: `Synchronized ${result.totalCount} GitHub repositories for @${result.username}. ${result.addedCount} new projects imported.`,
        projectsList: publicContent.projectsList,
        githubStats: result.githubStats,
        repos: result.repos,
      });
    } catch (err) {
      console.error('GitHub sync error:', err);
      res.status(500).json({ success: false, error: 'GitHub sync failed' });
    }
  }
);

// 6. ATS CV generator.
app.get('/api/cv/download', async (req, res) => {
  try {
    const content = await contentService.getAll();
    const { html, filename } = CvService.render(content);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    if (req.query.format === 'html') {
      res.setHeader('Cache-Control', 'public, max-age=600');
      return res.send(html);
    }
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'public, max-age=600');
    return res.send(html);
  } catch (err) {
    console.error('CV generation error:', err);
    res.status(500).send('Error generating CV');
  }
});

// 7. Static text files.
app.get('/robots.txt', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.type('text/plain');
  res.sendFile(path.join(__dirname, 'robots.txt'));
});

app.get('/sitemap.xml', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.type('application/xml');
  res.sendFile(path.join(__dirname, 'sitemap.xml'));
});

// 8. Pages.
app.get(['/admin', '/admin.html'], (req, res) => {
  SecurityHeaders.noIndex(res);
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get(['/', '/index.html'], (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ═══════════════════════════════════════════════════════
// ERROR HANDLER
// Must be registered after all routes so it also catches route-level errors
// (multer upload limits, etc.), not just body-parser failures.
// ═══════════════════════════════════════════════════════
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, error: 'Image too large (max 5MB)' });
  }
  if (err && err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ success: false, error: 'Unexpected file field (expected "image")' });
  }
  if (err && err.status === 415) {
    return res.status(415).json({ success: false, error: err.message });
  }
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).json({ success: false, error: 'Payload too large (max 256kb for JSON)' });
  }
  if (err && (err.type === 'entity.parse.failed' || err.status === 400)) {
    return res.status(400).json({ success: false, error: 'Malformed JSON body' });
  }

  console.error('[Unhandled]', err);
  return res.status(500).json({ success: false, error: 'Internal server error' });
});

// ═══════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════
async function startServer() {
  try {
    await ensureDb();
    console.log('Database initialized successfully.');

    const server = app.listen(PORT, async () => {
      console.log(`Portofolio server running at http://localhost:${PORT}`);
      console.log(`- Portfolio:  http://localhost:${PORT}/`);
      console.log(`- Admin:      http://localhost:${PORT}/admin`);
      console.log(`- ATS CV:     http://localhost:${PORT}/api/cv/download`);

      // Surface weak/absent credential configuration instead of failing silently.
      const hasEnvPass = Boolean(authService.getEnvPasscode());
      const hasHash = Boolean(await authService.getStoredRecord());
      const hasLegacy = Boolean(await authService.getLegacyPasscode());
      if (!hasEnvPass && !hasHash && !hasLegacy) {
        console.warn(
          '\n[SECURITY] No admin passcode configured. Set ADMIN_PASSCODE in the environment\n' +
          '          (required on serverless, where /tmp storage is not shared between instances).\n'
        );
      } else if (!hasEnvPass && hasLegacy) {
        console.warn('[SECURITY] Using legacy plaintext passcode; it will be hashed on first successful login.');
      }
      if (hasEnvPass && String(process.env.ADMIN_PASSCODE).length < 12) {
        console.warn('[SECURITY] ADMIN_PASSCODE is shorter than 12 characters. Use a longer secret.');
      }
    });

    server.on('error', (err) => {
      console.error('Server listen error:', err.message);
      process.exit(1);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

if (require.main === module && !process.env.VERCEL) {
  startServer();
}

module.exports = app;
