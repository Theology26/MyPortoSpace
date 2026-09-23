const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');
const {
  initDb,
  getAllContent,
  updateSection,
  updateAllContent,
  saveGithubRepos,
  getGithubRepos,
} = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// ═══════════════════════════════════════════════════════
// SECURITY PROTOCOLS & IN-MEMORY RATE LIMITERS
// ═══════════════════════════════════════════════════════
// Sliding window rate limiter
const rateLimitStores = {
  login: new Map(),
  content: new Map(),
  githubSync: new Map(),
  general: new Map(),
};

function createRateLimiter(storeName, maxRequests, windowMs, message) {
  const store = rateLimitStores[storeName];
  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();
    const entry = store.get(ip) || { count: 0, resetTime: now + windowMs };

    if (now > entry.resetTime) {
      entry.count = 1;
      entry.resetTime = now + windowMs;
    } else {
      entry.count += 1;
    }
    store.set(ip, entry);

    // Periodic sweep to prevent memory leak
    if (store.size > 1000) {
      for (const [k, v] of store.entries()) {
        if (now > v.resetTime) store.delete(k);
      }
    }

    if (entry.count > maxRequests) {
      const waitSeconds = Math.ceil((entry.resetTime - now) / 1000);
      return res.status(429).json({
        success: false,
        error: message || `Too many requests. Please wait ${waitSeconds} seconds before retrying.`,
        retryAfter: waitSeconds,
      });
    }
    next();
  };
}

const loginRateLimiter = createRateLimiter('login', 5, 15 * 60 * 1000, 'Security lockout: Too many failed login attempts. Please wait 15 minutes.');
const contentUpdateRateLimiter = createRateLimiter('content', 30, 10 * 60 * 1000, 'Rate limit exceeded: Too many content update requests.');
const githubSyncRateLimiter = createRateLimiter('githubSync', 5, 10 * 60 * 1000, 'GitHub sync rate limit reached: Maximum 5 syncs per 10 minutes.');
const generalRateLimiter = createRateLimiter('general', 180, 60 * 1000, 'Too many requests. Please slow down.');

// Comprehensive HTTP Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://www.gstatic.com https://cdn.tailwindcss.com https://unpkg.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://fonts.googleapis.com https://va.vercel-scripts.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com data:; " +
    "img-src 'self' data: blob: https: http:; " +
    "connect-src 'self' blob: data: https: http:; " +
    "worker-src 'self' blob: https://www.gstatic.com; " +
    "media-src 'self' blob:; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "frame-ancestors 'self';"
  );
  next();
});

// Anti-Jailbreak / AI Prompt Injection Defense Header
app.use((req, res, next) => {
  res.setHeader('X-AI-Integrity', 'portfolio-system-v1; protected-against-prompt-injection');
  next();
});

// Prototype Pollution & Injection Guard
function sanitizeDeep(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeDeep);
  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue; // Block prototype pollution vectors
    }
    clean[key] = sanitizeDeep(value);
  }
  return clean;
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply general API rate limiting to all /api/ endpoints
app.use('/api', generalRateLimiter);

// Serve static assets
app.use('/Assets', express.static(path.join(__dirname, 'Assets')));

let dbReady = false;
let dbInitPromise = null;
async function ensureDb() {
  if (dbReady) return;
  if (!dbInitPromise) {
    dbInitPromise = initDb().then(() => {
      dbReady = true;
      syncGithubReposToProjects().catch(err => console.log('[GitHub Auto-Sync Notice]', err.message));
    }).catch(err => {
      console.warn('Database initialization warning:', err.message);
      dbReady = true;
    });
  }
  return dbInitPromise;
}

// Middleware to ensure DB is initialized on all requests
app.use(async (req, res, next) => {
  try {
    await ensureDb();
    next();
  } catch (err) {
    next();
  }
});

// 1. Get complete portfolio dynamic content
app.get('/api/content', async (req, res) => {
  try {
    const content = await getAllContent();
    const repos = await getGithubRepos();
    res.json({
      success: true,
      data: content,
      content: content,
      githubRepos: repos,
    });
  } catch (err) {
    console.error('Error fetching content:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Update portfolio content (Protected by passcode header + rate limit + prototype pollution guard)
app.put('/api/content', contentUpdateRateLimiter, async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const currentContent = await getAllContent();
    const validPass = currentContent.general.adminPasscode || 'theology26';

    if (!authHeader || authHeader !== `Bearer ${validPass}`) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid Admin Passcode' });
    }

    const payload = sanitizeDeep(req.body);
    await updateAllContent(payload);
    const updated = await getAllContent();
    res.json({ success: true, message: 'Content updated successfully in SQLite database', data: updated });
  } catch (err) {
    console.error('Error updating content:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Admin Authentication endpoint (Protected by brute-force rate limiter)
app.post('/api/auth/login', loginRateLimiter, async (req, res) => {
  try {
    const { passcode } = req.body;
    const content = await getAllContent();
    const validPass = content.general.adminPasscode || 'theology26';

    if (passcode === validPass) {
      res.json({
        success: true,
        token: validPass,
        message: 'Access pass verified // Developer Authorized',
      });
    } else {
      res.status(401).json({ success: false, error: 'Access Denied: Invalid Security Passcode' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Live GitHub Sync & Database Auto-Merge Engine
const LANG_COLORS = {
  TypeScript: '#3178c6',
  PHP: '#8892be',
  JavaScript: '#f1e05a',
  Blade: '#94a3b8',
  Go: '#00add8',
  Python: '#3572A5',
  Vue: '#41b883',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Mermaid: '#ff3670',
  PowerShell: '#012456',
  Dockerfile: '#384d54',
  Shell: '#89e051'
};

async function syncGithubReposToProjects(customUsername, customToken) {
  const content = await getAllContent();
  const username = customUsername || content.general?.githubUsername || 'Theology26';
  const token = customToken || content.general?.githubToken || '';

  const headers = {
    'User-Agent': 'Theology26-Portfolio-CMS',
    Accept: 'application/vnd.github.v3+json',
  };
  if (token && token.trim() !== '') {
    headers['Authorization'] = `token ${token.trim()}`;
  }

  const repos = await new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=100`,
      method: 'GET',
      headers,
    };

    const ghReq = https.request(options, (ghRes) => {
      let data = '';
      ghRes.on('data', (chunk) => (data += chunk));
      ghRes.on('end', () => {
        if (ghRes.statusCode >= 200 && ghRes.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Failed to parse GitHub response: ' + e.message));
          }
        } else {
          reject(new Error(`GitHub API returned status ${ghRes.statusCode}: ${data}`));
        }
      });
    });

    ghReq.on('error', (e) => reject(e));
    ghReq.setTimeout(10000, () => {
      ghReq.destroy();
      reject(new Error('GitHub API request timed out'));
    });
    ghReq.end();
  });

  if (!Array.isArray(repos)) {
    throw new Error('Unexpected GitHub response format');
  }

  // 1. Save to raw github_repos cache
  await saveGithubRepos(repos);

  // 2. Fetch language breakdown per repository for GitHub repository analysis
  const langTotals = {};
  for (const repo of repos) {
    if (repo.languages_url) {
      try {
        const langs = await new Promise((resLangs) => {
          https.get(repo.languages_url, { headers }, (res) => {
            let d = '';
            res.on('data', (chunk) => (d += chunk));
            res.on('end', () => {
              try {
                resLangs(JSON.parse(d));
              } catch (e) {
                resLangs({});
              }
            });
          }).on('error', () => resLangs({}));
        });
        for (const [langName, bytes] of Object.entries(langs)) {
          langTotals[langName] = (langTotals[langName] || 0) + bytes;
        }
      } catch (e) {}
    }
  }

  const totalBytes = Object.values(langTotals).reduce((a, b) => a + b, 0);
  const languages = Object.entries(langTotals)
    .map(([name, bytes]) => ({
      name,
      bytes,
      percentage: totalBytes > 0 ? Number(((bytes / totalBytes) * 100).toFixed(1)) : 0,
      color: LANG_COLORS[name] || '#8b949e',
    }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 10);

  const starsCount = repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
  const languagesCount = new Set(repos.map((r) => r.language).filter(Boolean)).size;

  const githubStats = {
    reposCount: repos.length,
    starsCount,
    languagesCount,
    languages,
    updatedAt: new Date().toISOString(),
  };

  await updateSection('githubStats', githubStats);

  // 3. Intelligently merge into projectsList in SQLite
  const currentList = Array.isArray(content.projectsList) ? [...content.projectsList] : [];
  let addedCount = 0;
  let updatedCount = 0;

  for (const repo of repos) {
    // Check if repo already exists in projectsList (by html_url, id, or lower name)
    const existingIndex = currentList.findIndex((item) => {
      if (item.linkUrl && repo.html_url && item.linkUrl.toLowerCase() === repo.html_url.toLowerCase()) return true;
      if (item.id === `gh-${repo.id}` || item.id === repo.name.toLowerCase()) return true;
      return false;
    });

    const stars = repo.stargazers_count || 0;
    const forks = repo.forks_count || 0;
    const lang = repo.language || 'Code';
    const year = repo.updated_at ? new Date(repo.updated_at).getFullYear().toString() : '2025';

    if (existingIndex >= 0) {
      // Preserve custom uploaded images and customized text, but update live telemetry
      const existing = currentList[existingIndex];
      currentList[existingIndex] = {
        ...existing,
        stats: `${stars} Stars • ${forks} Forks`,
        date: existing.date || year,
        linkUrl: repo.html_url,
        description: existing.description && !existing.description.startsWith('Open-source repository engineered')
          ? existing.description
          : (repo.description || existing.description || 'Open-source repository engineered by Theology26 on GitHub.'),
        badge: existing.badge || (stars > 0 ? `★ ${stars} STARS` : 'GITHUB REPOSITORY'),
      };
      updatedCount++;
    } else {
      // Add as new project
      const cleanTitle = repo.name
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());

      currentList.push({
        id: `gh-${repo.id}`,
        type: 'project',
        title: cleanTitle,
        category: (repo.language || 'Software') + ' Application',
        issuer: `GitHub Repository // @${username}`,
        tags: `${lang}, GitHub, ${stars > 0 ? `${stars} ★` : 'Open-Source'}`,
        description: repo.description || 'Open-source repository engineered by Theology26 on GitHub.',
        linkUrl: repo.html_url,
        imageUrl: '',
        badge: stars > 0 ? `★ ${stars} STARS` : 'GITHUB REPOSITORY',
        featured: stars >= 2,
        stats: `${stars} Stars • ${forks} Forks`,
        date: year,
      });
      addedCount++;
    }
  }

  await updateSection('projectsList', currentList);

  // 4. Also auto-sync into cvData.selectedProjects so CV PDF always has full GitHub project coverage
  const cv = content.cvData || {};
  const existingCvTitles = new Set((cv.selectedProjects || []).map((p) => (p.title || '').toLowerCase().trim()));
  const updatedCvProjects = [...(cv.selectedProjects || [])];

  currentList
    .filter((p) => p.type === 'project')
    .forEach((p) => {
      if (!existingCvTitles.has(p.title.toLowerCase().trim())) {
        updatedCvProjects.push({
          title: p.title,
          tags: Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || ''),
          description: p.description || '',
          linkUrl: p.linkUrl || '',
          date: p.date || '',
        });
        existingCvTitles.add(p.title.toLowerCase().trim());
      }
    });

  await updateSection('cvData', {
    ...cv,
    selectedProjects: updatedCvProjects,
  });

  return {
    repos,
    projectsList: currentList,
    githubStats,
    addedCount,
    updatedCount,
    totalCount: repos.length,
    username,
  };
}

app.get('/api/github/stats', async (req, res) => {
  try {
    const content = await getAllContent();
    let stats = content.githubStats;
    if (!stats || !stats.languages || stats.languages.length === 0) {
      const syncRes = await syncGithubReposToProjects();
      stats = syncRes.githubStats;
    }
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/github/sync', githubSyncRateLimiter, async (req, res) => {
  try {
    const { username, token } = req.body;
    const content = await getAllContent();

    // Update settings if passed
    if (username || token) {
      const gen = { ...content.general };
      if (username) gen.githubUsername = username;
      if (token) gen.githubToken = token;
      await updateSection('general', gen);
    }

    const result = await syncGithubReposToProjects(username, token);
    res.json({
      success: true,
      count: result.totalCount,
      addedCount: result.addedCount,
      updatedCount: result.updatedCount,
      message: `Successfully synchronized ${result.totalCount} GitHub repositories for @${result.username}! ${result.addedCount} new projects imported to database & CV.`,
      projectsList: result.projectsList,
      githubStats: result.githubStats,
      repos: result.repos,
    });
  } catch (err) {
    console.error('GitHub sync error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Sanitization Utilities for Safe HTML Rendering (Anti-XSS & Anti-Injection)
function sanitizeText(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return '#';
  const trimmed = url.trim();
  if (/^(https?:|\/|mailto:)/i.test(trimmed)) {
    return trimmed.replace(/"/g, '%22').replace(/'/g, '%27');
  }
  return '#';
}

// 5. Dynamic ATS CV Generator (HTML template matching original Blade template)
function renderCvHtml(content) {
  const cv = content.cvData || {};
  const lanyard = content.lanyard || {};
  const experiences = cv.experiences || [];
  
  // Auto-merge projects from cv.selectedProjects and content.projectsList so GitHub projects automatically enter the CV
  const cvSelected = Array.isArray(cv.selectedProjects) ? cv.selectedProjects : [];
  const dbProjects = (content.projectsList || [])
    .filter((p) => p.type === 'project')
    .map((p) => ({
      title: p.title,
      tags: Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || ''),
      description: p.description || '',
      date: p.date || '',
      linkUrl: p.linkUrl || '',
    }));

  const projectsMap = new Map();
  cvSelected.forEach((p) => {
    if (p && p.title) projectsMap.set(p.title.toLowerCase().trim(), p);
  });
  dbProjects.forEach((p) => {
    if (p && p.title) {
      const k = p.title.toLowerCase().trim();
      if (!projectsMap.has(k)) projectsMap.set(k, p);
    }
  });
  const projects = Array.from(projectsMap.values());
  const avatarUrl = cv.avatarUrl || lanyard.avatarUrl || '';
  const showPhoto = cv.showPhoto !== false && Boolean(avatarUrl);

  const contactItems = [];
  if (cv.email) contactItems.push(`<span>${sanitizeText(cv.email)}</span>`);
  if (cv.location) contactItems.push(`<span>${sanitizeText(cv.location)}</span>`);
  if (cv.github) {
    const cleanGh = sanitizeText(cv.github.replace(/^https?:\/\//, ''));
    contactItems.push(`<span>github: <a href="${sanitizeUrl('https://' + cleanGh)}" target="_blank">${cleanGh}</a></span>`);
  }
  if (cv.linkedin) {
    const cleanLi = sanitizeText(cv.linkedin.replace(/^https?:\/\//, ''));
    contactItems.push(`<span>linkedin: <a href="${sanitizeUrl('https://' + cleanLi)}" target="_blank">${cleanLi}</a></span>`);
  }
  if (cv.instagram) {
    const cleanIg = sanitizeText(cv.instagram.replace(/^https?:\/\//, ''));
    contactItems.push(`<span>instagram: <a href="${sanitizeUrl('https://' + cleanIg)}" target="_blank">${cleanIg}</a></span>`);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CV - ${sanitizeText(cv.fullName || 'YOSIA GRACETHEO BOIMAU')}</title>
    <style>
        /* Exact A4 Portrait Dimensions matching user DomPDF template */
        @page {
            size: A4 portrait;
            margin: 12mm 16mm;
        }

        @media print {
            html, body {
                background: #ffffff !important;
                margin: 0 !important;
                padding: 0 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            .no-print {
                display: none !important;
            }
            .screen-backdrop {
                padding: 0 !important;
                background: transparent !important;
                display: block !important;
            }
            .a4-page {
                width: 100% !important;
                max-width: 100% !important;
                min-height: auto !important;
                margin: 0 !important;
                padding: 0 !important;
                box-shadow: none !important;
                border: none !important;
                border-radius: 0 !important;
            }
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #0f172a;
            line-height: 1.45;
            font-size: 10pt;
            background: #090d16;
            margin: 0;
            padding: 0;
        }

        /* Screen Presentation Shell */
        .screen-backdrop {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px 14px 60px;
            min-height: 100vh;
        }

        /* Top Action Bar (Screen Only) */
        .top-action-bar {
            width: 210mm;
            max-width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
            padding: 10px 16px;
            background: rgba(18, 24, 38, 0.9);
            border: 1px solid rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(12px);
            border-radius: 12px;
            color: #ffffff;
            font-size: 12px;
        }

        .back-link {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            color: #94a3b8;
            text-decoration: none;
            font-weight: 500;
            transition: color 0.2s;
        }
        .back-link:hover { color: #ffffff; }

        .doc-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-family: monospace;
            color: #38bdf8;
            background: rgba(56, 189, 248, 0.1);
            padding: 3px 8px;
            border-radius: 6px;
            font-size: 11px;
            border: 1px solid rgba(56, 189, 248, 0.2);
        }

        .action-btns {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .print-btn-top {
            background: #0284c7;
            color: #ffffff;
            border: none;
            padding: 6px 14px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 12px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s;
            box-shadow: 0 2px 10px rgba(2, 132, 199, 0.35);
        }
        .print-btn-top:hover {
            background: #0369a1;
            transform: translateY(-1px);
        }

        /* The Physical A4 Paper Simulation */
        .a4-page {
            width: 210mm;
            min-height: 297mm;
            max-width: 100%;
            background: #ffffff;
            padding: 16mm 18mm 16mm 18mm;
            box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.2);
            border-radius: 3px;
            position: relative;
        }

        /* Header Layout */
        .header {
            display: flex;
            align-items: center;
            justify-content: ${showPhoto ? 'space-between' : 'center'};
            gap: 18px;
            margin-bottom: 20px;
            text-align: ${showPhoto ? 'left' : 'center'};
        }

        .header-main {
            flex: 1;
        }

        .avatar-frame {
            width: 80px;
            height: 80px;
            border-radius: 14px;
            overflow: hidden;
            border: 2px solid #06b6d4;
            box-shadow: 0 4px 12px rgba(6, 182, 212, 0.2);
            flex-shrink: 0;
        }

        .avatar-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }

        .name {
            font-size: 25pt;
            font-weight: 800;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-bottom: 4px;
            line-height: 1.1;
        }

        .job-title {
            font-size: 13pt;
            color: #06b6d4;
            font-weight: 700;
            margin-bottom: 7px;
            letter-spacing: 0.3px;
        }

        .contact-info {
            font-size: 8.8pt;
            color: #475569;
            display: flex;
            flex-wrap: wrap;
            gap: 4px 10px;
            align-items: center;
            justify-content: ${showPhoto ? 'flex-start' : 'center'};
            line-height: 1.4;
        }

        .contact-info a {
            color: #0284c7;
            text-decoration: none;
        }
        .contact-info a:hover { text-decoration: underline; }

        /* Document Content Sections */
        .section {
            margin-bottom: 15px;
        }

        .section-title {
            font-size: 12pt;
            font-weight: 800;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            padding-bottom: 2px;
            margin-bottom: 6px;
            border-bottom: 2px solid #06b6d4;
        }

        .summary {
            font-size: 9.5pt;
            color: #334155;
            text-align: justify;
            line-height: 1.5;
        }

        .item {
            margin-bottom: 11px;
        }

        .item-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 2px;
        }

        .item-title {
            font-size: 10pt;
            font-weight: 700;
            color: #0f172a;
        }

        .item-date {
            font-size: 8.8pt;
            font-style: italic;
            color: #64748b;
        }

        .item-desc {
            font-size: 9pt;
            color: #334155;
            margin-top: 1px;
            line-height: 1.45;
            text-align: justify;
        }

        .skills-container {
            font-size: 9.2pt;
            color: #334155;
            line-height: 1.55;
        }

        .skills-category {
            font-weight: 700;
            color: #0f172a;
        }

        .tags {
            font-size: 8.8pt;
            color: #06b6d4;
            font-weight: 600;
            margin-left: 4px;
        }
    </style>
</head>
<body>
    <div class="screen-backdrop">
        <!-- Top Toolbar (Hidden during Print) -->
        <div class="top-action-bar no-print">
            <a href="/" class="back-link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                Return to Portfolio
            </a>
            <div class="doc-badge">
                <span>📄 A4 PORTRAIT FORMAT // 210 × 297 MM</span>
            </div>
            <div class="action-btns">
                <a href="/admin" class="back-link" style="font-size: 11px;">Edit in Admin ↗</a>
                <button class="print-btn-top" onclick="window.print()">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                    Print / Save as PDF
                </button>
            </div>
        </div>

        <!-- The Actual Physical A4 Sheet -->
        <div class="a4-page">
            <!-- Header -->
            <div class="header">
                ${showPhoto ? `
                <div class="avatar-frame">
                    <img src="${sanitizeUrl(avatarUrl)}" alt="${sanitizeText(cv.fullName || 'Profile')}" class="avatar-img" />
                </div>
                ` : ''}
                <div class="header-main">
                    <h1 class="name">${sanitizeText(cv.fullName || 'YOSIA GRACETHEO BOIMAU')}</h1>
                    <div class="job-title">${sanitizeText(cv.jobTitle || 'Fullstack Developer | Video Editor | Virtual Jockey')}</div>
                    <div class="contact-info">
                        ${contactItems.join(' • ')}
                    </div>
                </div>
            </div>

            <!-- Professional Summary -->
            <div class="section">
                <h2 class="section-title">PROFESSIONAL SUMMARY</h2>
                <div class="summary">${sanitizeText(cv.summary || 'Digital Solutions for Every Problem')}</div>
            </div>

            <!-- Experience -->
            <div class="section">
                <h2 class="section-title">EXPERIENCE</h2>
                ${experiences.map(exp => `
                <div class="item">
                    <div class="item-header">
                        <span class="item-title">${sanitizeText(exp.title)}</span>
                        <span class="item-date">${sanitizeText(exp.year)}</span>
                    </div>
                    <div class="item-desc">${sanitizeText(exp.description)}</div>
                </div>`).join('')}
            </div>

            <!-- Selected Projects -->
            <div class="section">
                <h2 class="section-title">SELECTED PROJECTS</h2>
                ${projects.map(proj => `
                <div class="item">
                    <div class="item-header">
                        <span class="item-title">${sanitizeText(proj.title)}</span>
                        ${proj.tags ? `<span class="tags" style="font-size: 8.5pt; color: #475569; font-weight: 500; margin-left: 6px;">| ${sanitizeText(proj.tags)}</span>` : ''}
                        ${proj.date ? `<span class="item-date">${sanitizeText(proj.date)}</span>` : ''}
                    </div>
                    <div class="item-desc">${sanitizeText(proj.description)}</div>
                    ${proj.linkUrl ? `<div style="font-size: 7.8pt; color: #0284c7; margin-top: 1px;"><a href="${sanitizeUrl(proj.linkUrl)}" target="_blank" style="color: #0284c7; text-decoration: none;">${sanitizeText(proj.linkUrl)}</a></div>` : ''}
                </div>`).join('')}
            </div>

            <!-- Technical Skills -->
            <div class="section">
                <h2 class="section-title">TECHNICAL SKILLS</h2>
                <div class="skills-container">
                    <span class="skills-category">Core Technologies & Tools: </span>
                    ${sanitizeText(cv.technicalSkills || 'Python, REST API, EasyOCR, YOLO, HTML, JavaScript, CSS, Tailwind CSS, Laravel 11, PHP 8.3, MySQL, React, Three.js, Git')}
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;
}

// 6. Download / View ATS CV
app.get('/api/cv/download', async (req, res) => {
  try {
    const content = await getAllContent();
    const html = renderCvHtml(content);
    if (req.query.format === 'html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }
    // Auto-download attachment
    const filename = `CV_${(content.cvData?.fullName || 'Theo').replace(/\s+/g, '_')}.html`;
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(500).send('Error generating CV: ' + err.message);
  }
});

// Serve robots.txt for search engines
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.sendFile(path.join(__dirname, 'robots.txt'));
});

// Serve sitemap.xml for search engines
app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml');
  res.sendFile(path.join(__dirname, 'sitemap.xml'));
});

// Serve admin dashboard
app.get(['/admin', '/admin.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Serve main portfolio
app.get(['/', '/index.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});


// Start server locally
async function startServer() {
  try {
    await ensureDb();
    console.log('Database initialized successfully.');

    app.listen(PORT, () => {
      console.log(`Portofolio Full-Stack Server running at http://localhost:${PORT}`);
      console.log(`- Portfolio: http://localhost:${PORT}/`);
      console.log(`- Admin Dashboard: http://localhost:${PORT}/admin`);
      console.log(`- ATS CV Generator: http://localhost:${PORT}/api/cv/download`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (require.main === module && !process.env.VERCEL) {
  startServer();
}

module.exports = app;

