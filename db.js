const path = require('path');
const fs = require('fs');

// Attempt to load native sqlite3 with graceful fallback for serverless / Vercel
let sqlite3 = null;
try {
  sqlite3 = require('sqlite3').verbose();
} catch (err) {
  console.warn('[DB Engine] Native sqlite3 unavailable in serverless environment; using Zero-Config JSON/In-Memory store.');
}

const isVercel = Boolean(process.env.VERCEL);
const DB_PATH = isVercel
  ? path.join('/tmp', 'database.sqlite')
  : path.join(__dirname, 'database.sqlite');

const JSON_STORE_PATH = isVercel
  ? path.join('/tmp', 'portfolio_store.json')
  : path.join(__dirname, 'portfolio_store.json');

// Initial default content matching Theo's authentic portfolio, PDF CV, and GitHub telemetry
const DEFAULT_CONTENT = {
  general: {
    siteTitle: 'Yosia Gracetheo Boimau — Fullstack Developer, Video Editor & VJ',
    siteDescription: 'Portfolio of Yosia Gracetheo Boimau — Digital Solutions for Every Challenge. Full-stack Developer, Video Editor, and Virtual Jockey based in Malang, Indonesia.',
    brandName: 'THEOLOGY26',
    brandDomain: 'theo.dev',
    brandStatus: 'AVAILABLE',
    linktreeUrl: 'https://linktr.ee/TheHighTee',
    githubUrl: 'https://github.com/Theology26',
    instagramUrl: 'https://instagram.com/theoxcyro',
    address: 'Malang, East Java, Indonesia',
    adminPasscode: 'theology26',
    logoUrl: '/Assets/avatar_animated.png',
    githubUsername: 'Theology26',
    githubToken: '',
  },
  hero: {
    badgeText: 'FULLSTACK DEVELOPER // VIDEO & VJ',
    badgeSubtext: 'LARAVEL 11 & CREATIVE TECH',
    eyebrow: 'Digital Solutions for Every Challenge',
    titleLine1: 'Yosia Gracetheo Boimau',
    titleLine2: 'Fullstack Dev • Video Editor • VJ',
    description: 'Architecting modern web applications with Laravel 11, computer vision & OCR integration, intelligent logistics engines, and premium live visual projection mapping.',
    ctaPrimaryText: 'Explore Portfolio ↓',
    ctaPrimaryLink: '#projects',
    ctaSecondaryText: 'Download ATS CV (PDF)',
    ctaSecondaryLink: '/api/cv/download',
    ctaTertiaryText: 'Instagram (@theoxcyro)',
    ctaTertiaryLink: 'https://instagram.com/theoxcyro',
  },
  lanyard: {
    passHeader: 'SYS.ID // ACCESS PASS',
    passSubHeader: 'VERIFIED DEVELOPER',
    passStatus: 'ACTIVE',
    monogram: 'TG',
    avatarUrl: 'https://avatars.githubusercontent.com/u/180420712?v=4',
    userName: 'Yosia Gracetheo Boimau',
    userTitle: 'Fullstack Developer | Video Editor | VJ',
    userAlumnus: 'BINUS University & Creative Specialist',
    idNumber: '#THEO-MLG-2609',
    issuanceNode: '2025 // NODE-MALANG',
    coreArch: 'Laravel 11 • Python • Video • VJ Systems',
    securityProtocol: '256-BIT // AUTHORIZED',
    ribbonText: 'THEOLOGY26 // FULLSTACK // MALANG',
    hintText: 'DRAG & FLING PASS IN ANY DIRECTION // REALISTIC ELASTIC PHYSICS',
  },
  techTags: [
    'Laravel 11',
    'Python',
    'Rest API',
    'Easy OCR',
    'YOLO / AI',
    'Tailwind CSS',
    'JavaScript',
    'React',
    'Three.js',
    'MySQL',
    'Video Editing',
    'Virtual Jockey'
  ],
  projectsList: [
    {
      id: 'mbg-smart-logistics-fulldev',
      type: 'project',
      title: 'MBG Smart Logistics FullDev',
      category: 'Go Application',
      issuer: 'GitHub Repository // @Theology26',
      tags: 'Go, Backend, Microservices, 2 ★',
      description: 'High-performance distributed intelligent logistics architecture built with the Go programming language.',
      linkUrl: 'https://github.com/Theology26/MBG-Smart-Logistics-FullDev',
      badge: '★ 2 STARS',
      featured: true,
      stats: '2 Stars • 0 Forks',
      date: '2025'
    },
    {
      id: 'logieat-os',
      type: 'project',
      title: 'Logieat OS & OCR Vision',
      category: 'Python Application',
      issuer: 'GitHub Repository // @Theology26',
      tags: 'Python, EasyOCR, YOLO, Computer Vision',
      description: 'Computer vision & Korean text recognition automation system based on machine learning and deep learning pipelines.',
      linkUrl: 'https://github.com/Theology26/Logieat-OS',
      badge: 'AI / OCR ENGINE',
      featured: true,
      stats: 'Python • Computer Vision',
      date: '2025'
    },
    {
      id: 'webportofoliotheo',
      type: 'project',
      title: 'Web Portofolio Theo (Blade / Laravel)',
      category: 'Blade Application',
      issuer: 'GitHub Repository // @Theology26',
      tags: 'Blade, Laravel 11, Tailwind CSS, 1 ★',
      description: 'Full-stack interactive portfolio powered by the Laravel 11 ecosystem, Blade templating engine, and dynamic components.',
      linkUrl: 'https://github.com/Theology26/webportofoliotheo',
      badge: '★ 1 STAR',
      featured: true,
      stats: '1 Star • Laravel 11',
      date: '2025'
    },
    {
      id: 'webportofolioexpotheo',
      type: 'project',
      title: 'Web Portofolio Expo Mobile',
      category: 'TypeScript Application',
      issuer: 'GitHub Repository // @Theology26',
      tags: 'TypeScript, React Native, Expo, 1 ★',
      description: 'Responsive cross-platform native mobile portfolio application built on React Native and the Expo ecosystem.',
      linkUrl: 'https://github.com/Theology26/webportofolioexpotheo',
      badge: '★ 1 STAR',
      featured: true,
      stats: '1 Star • React Native Expo',
      date: '2025'
    },
    {
      id: 'mbg-smart-logistics',
      type: 'project',
      title: 'MBG Smart Logistics Engine',
      category: 'Go Application',
      issuer: 'GitHub Repository // @Theology26',
      tags: 'Go, REST API, Logistics, 1 ★',
      description: 'Core microservice engine for route optimization and real-time logistics dispatch synchronization.',
      linkUrl: 'https://github.com/Theology26/mbg-smart-logistics',
      badge: '★ 1 STAR',
      featured: true,
      stats: '1 Star • Go Microservices',
      date: '2025'
    },
    {
      id: 'sparkling-clean-studio',
      type: 'project',
      title: 'Sparkling Clean Studio',
      category: 'TypeScript Application',
      issuer: 'GitHub Repository // @Theology26',
      tags: 'TypeScript, Next.js, Modern UI, 1 ★',
      description: 'Commercial and residential cleaning service booking and operational web management platform.',
      linkUrl: 'https://github.com/Theology26/sparkling-clean-studio',
      badge: '★ 1 STAR',
      featured: false,
      stats: '1 Star • Commercial UMKM',
      date: '2025'
    },
    {
      id: 'nutrisafe-food-delivery',
      type: 'project',
      title: 'NutriSafe Food Delivery Agent',
      category: 'Vue Application',
      issuer: 'GitHub Repository // @Theology26',
      tags: 'Vue, JavaScript, State Management, Agent',
      description: 'Food delivery and ordering system with integrated intelligent nutritional recommendation engine.',
      linkUrl: 'https://github.com/Theology26/NutriSafeFoodDeliveryAgent',
      badge: 'VUE CLIENT',
      featured: false,
      stats: 'Vue • Intelligent Agent',
      date: '2025'
    },
    {
      id: 'portofolio-sparklingcleaners',
      type: 'project',
      title: 'Website Sparkling Cleaners Malang',
      category: 'JavaScript Application',
      issuer: 'Client Project Malang',
      tags: 'JavaScript, HTML5, CSS3, Responsive UI',
      description: 'Promotional and online booking website for local Malang commercial cleaning services with streamlined ordering.',
      linkUrl: 'https://github.com/Theology26/portofolio-sparklingcleaners',
      badge: 'CLIENT UMKM',
      featured: false,
      stats: 'Malang UMKM Client',
      date: '2025'
    }
  ],
  certificatesList: [
    {
      id: 'cert-laravel-11',
      title: 'Laravel 11 Advanced Architecture & TDD Certification',
      issuer: 'Laravel / PHP Specialist',
      imageUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=800&q=80',
      linkUrl: 'https://github.com/Theology26',
      aspectRatio: 'aspect-[4/5]',
      badge: 'OFFICIAL CERTIFICATE',
      date: '2024'
    },
    {
      id: 'cert-meta-frontend',
      title: 'Meta Front-End Developer Professional Certificate',
      issuer: 'Meta (Coursera)',
      imageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80',
      linkUrl: 'https://github.com/Theology26',
      aspectRatio: 'aspect-square',
      badge: 'PROFESSIONAL CERTIFICATE',
      date: '2024'
    },
    {
      id: 'cert-binus-cs',
      title: 'Bachelor of Computer Science Degree',
      issuer: 'BINUS University',
      imageUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80',
      linkUrl: 'https://github.com/Theology26',
      aspectRatio: 'aspect-[16/10]',
      badge: 'ACADEMIC DEGREE',
      date: '2024'
    },
    {
      id: 'cert-python-ai',
      title: 'Python Deep Learning & Computer Vision (YOLO & OCR)',
      issuer: 'Deep Learning Institute',
      imageUrl: 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?auto=format&fit=crop&w=800&q=80',
      linkUrl: 'https://github.com/Theology26/Logieat-OS',
      aspectRatio: 'aspect-[3/4]',
      badge: 'AI SPECIALIST',
      date: '2025'
    }
  ],
  projectSpotlight: {
    badge: 'ENTERPRISE ARCHITECTURE',
    title: 'COMPUTER VISION AND NEURAL NETWORK INTEGRATION IN SMART LOGISTICS FOR NUTRITIOUS FOOD DISTRIBUTION',
    projectName: 'Computer Vision & Smart Logistics Integration',
    description: 'Modern supply chain management system designed to track fleet movement and inventory with high precision. Built on Laravel backend with relational database architecture, real-time tracking analytics, and automated logistics dispatch optimization.',
    linkText: 'View Project Repo ↗',
    linkUrl: 'https://github.com/Theology26',
    metrics: [
      { label: 'FRAMEWORK', value: 'Laravel 11' },
      { label: 'FRONTEND', value: 'Tailwind + React' },
      { label: 'DATABASE', value: 'MySQL Relational' },
      { label: 'DISPATCH', value: 'Real-time Tracking' },
    ],
    terminalLines: [
      '$ php artisan serve --port=8000',
      'Starting Laravel development server: http://127.0.0.1:8000',
      '$ python app_ocr_vision.py --mode=inference',
      '✓ YOLO model weights loaded: 98.4% precision',
      '✓ EasyOCR recognition active.',
      '$ git push origin main',
      'Enumerating objects: 42, done.',
      '→ Branch main → origin/main',
      '$ echo "Distribution logistics optimized ✓"',
    ],
    githubRepoUrl: 'https://github.com/Theology26',
    liveDemoUrl: '#'
  },
  spaceConfig: {
    starsCount: 3200,
    nebulaCount: 75,
    starFlaresCount: 22,
    orbitSpeedMultiplier: 1.0,
    atmosphereIntensity: 1.0,
    showSatellites: true,
  },
  cvData: {
    fullName: 'YOSIA GRACETHEO BOIMAU',
    jobTitle: 'Fullstack Developer | Video Editor | Virtual Jockey',
    avatarUrl: 'https://avatars.githubusercontent.com/u/180420712?v=4',
    showPhoto: true,
    email: 'yosiagracetheo0@gmail.com',
    location: 'Malang, East Java, Indonesia',
    website: 'theo.dev',
    linkedin: 'linkedin.com/in/yosia-gracetheo-boimau-919340211/',
    github: 'github.com/Theology26',
    instagram: 'instagram.com/theoxcyro',
    summary: 'Digital Solutions for Every Challenge',
    experiences: [
      {
        title: 'Video Editor',
        company: 'Independent Creative Specialist',
        year: '2025 - Present',
        description: 'Post-production specialist transforming raw footage into high-impact visual storytelling and commercial brand narratives.'
      },
      {
        title: 'Content Strategist',
        company: 'Digital Media Strategy',
        year: '2025 - Present',
        description: 'Analyzing digital trends, structuring content architecture, and orchestrating multi-channel distribution pipelines.'
      },
      {
        title: 'Commercial Director',
        company: 'Commercial Advertising',
        year: '2025',
        description: 'Directing visual production and commercial advertising campaigns from pre-production to master release.'
      },
      {
        title: 'Virtual Jockey (VJ)',
        company: 'Live Stage Visuals',
        year: '2024 - Present',
        description: 'Controlling live stage visual projection mapping, MIDI timing sync, and generative visuals for concerts and events.'
      }
    ],
    selectedProjects: [
      {
        title: 'KOREAN WEBTOON OCR & AI TRANSLATION PIPELINE',
        tags: 'Python, Rest API, Easy OCR, YOLO, IO Paint',
        description: 'Development of a Korean webtoon OCR and translation pipeline to overcome language barriers and empower localized content access.'
      },
      {
        title: 'Website Sparkling Cleaners Malang',
        tags: 'HTML, js, CSS,',
        description: 'Promotional and online booking website for local Malang commercial cleaning services with streamlined ordering.'
      },
      {
        title: 'COMPUTER VISION AND NEURAL NETWORK INTEGRATION IN SMART LOGISTICS FOR NUTRITIOUS FOOD DISTRIBUTION',
        tags: 'Tailwind CSS, JavaScript, Custom CMS',
        description: 'Modern supply chain management system designed to track fleet movement and inventory with high precision. Built on Laravel backend with relational database architecture.'
      }
    ],
    technicalSkills: 'Python, Rest API, Easy OCR, YOLO, IO Paint, HTML, js, CSS, Tailwind CSS, JavaScript, Custom CMS, Laravel 11, PHP 8.3, MySQL, React, Three.js, Git'
  },
  githubStats: {
    reposCount: 9,
    starsCount: 7,
    languagesCount: 6,
    languages: [
      { name: 'TypeScript', bytes: 551635, percentage: 16.9, color: '#3178c6' },
      { name: 'PHP', bytes: 463042, percentage: 14.2, color: '#8892be' },
      { name: 'JavaScript', bytes: 458148, percentage: 14.0, color: '#f1e05a' },
      { name: 'Blade', bytes: 422622, percentage: 13.0, color: '#94a3b8' },
      { name: 'Go', bytes: 382272, percentage: 11.7, color: '#00add8' },
      { name: 'Python', bytes: 292884, percentage: 9.0, color: '#3572A5' },
      { name: 'Vue', bytes: 248990, percentage: 7.6, color: '#41b883' },
      { name: 'HTML', bytes: 239030, percentage: 7.3, color: '#e34c26' },
      { name: 'CSS', bytes: 144839, percentage: 4.4, color: '#563d7c' },
      { name: 'Mermaid', bytes: 22362, percentage: 0.7, color: '#ff3670' }
    ]
  }
};

// ═══════════════════════════════════════════════════════
// IN-MEMORY / JSON STORE RESILIENT ADAPTER
// ═══════════════════════════════════════════════════════
let memoryStore = null;
let githubReposCache = [];

function loadStore() {
  if (memoryStore) return memoryStore;
  try {
    if (fs.existsSync(JSON_STORE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(JSON_STORE_PATH, 'utf8'));
      memoryStore = { ...DEFAULT_CONTENT, ...parsed };
      return memoryStore;
    }
  } catch (err) {
    console.warn('[DB Engine] Could not read JSON store:', err.message);
  }
  memoryStore = JSON.parse(JSON.stringify(DEFAULT_CONTENT));
  return memoryStore;
}

function persistStore(updates) {
  const current = loadStore();
  memoryStore = { ...current, ...updates };
  try {
    fs.writeFileSync(JSON_STORE_PATH, JSON.stringify(memoryStore, null, 2), 'utf8');
  } catch (err) {
    // If filesystem is read-only, memory remains updated in RAM
  }
  return memoryStore;
}

// ═══════════════════════════════════════════════════════
// SQLITE CONNECTION SETUP
// ═══════════════════════════════════════════════════════
let db = null;
let useJsonFallback = !sqlite3;

if (sqlite3) {
  try {
    if (isVercel) {
      const localSeed = path.join(__dirname, 'database.sqlite');
      if (fs.existsSync(localSeed) && !fs.existsSync(DB_PATH)) {
        try { fs.copyFileSync(localSeed, DB_PATH); } catch (e) {}
      }
    }
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.warn('[DB Engine] SQLite initialization failed, using Zero-Config JSON store:', err.message);
        useJsonFallback = true;
      }
    });
  } catch (err) {
    console.warn('[DB Engine] SQLite constructor failed, using Zero-Config JSON store:', err.message);
    useJsonFallback = true;
  }
}

// ═══════════════════════════════════════════════════════
// PUBLIC API IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════

function initDb() {
  if (useJsonFallback || !db) {
    loadStore();
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS settings (
          section TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS github_repos (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          full_name TEXT,
          description TEXT,
          html_url TEXT,
          stars INTEGER DEFAULT 0,
          forks INTEGER DEFAULT 0,
          language TEXT,
          updated_at TEXT
        )
      `);

      db.get('SELECT COUNT(*) as count FROM settings', (err, row) => {
        if (err || (row && row.count === 0)) {
          const stmt = db.prepare('INSERT OR REPLACE INTO settings (section, data) VALUES (?, ?)');
          for (const [section, data] of Object.entries(DEFAULT_CONTENT)) {
            stmt.run(section, JSON.stringify(data));
          }
          stmt.finalize(() => resolve());
        } else {
          // Automatic Migration: Ensure certificatesList exists and remove gallery
          db.get("SELECT data FROM settings WHERE section = 'certificatesList'", (cErr, cRow) => {
            if (!cRow) {
              db.run("INSERT OR REPLACE INTO settings (section, data) VALUES (?, ?)", [
                'certificatesList',
                JSON.stringify(DEFAULT_CONTENT.certificatesList)
              ]);
            }
          });
          // Remove obsolete gallery section
          db.run("DELETE FROM settings WHERE section = 'gallery'");

          // Filter projectsList to remove legacy certificates
          db.get("SELECT data FROM settings WHERE section = 'projectsList'", (pErr, pRow) => {
            if (pRow) {
              try {
                const parsed = JSON.parse(pRow.data);
                if (Array.isArray(parsed) && parsed.some(p => p.type === 'certificate')) {
                  const cleaned = parsed.filter(p => p.type !== 'certificate');
                  db.run("UPDATE settings SET data = ? WHERE section = 'projectsList'", [JSON.stringify(cleaned)]);
                }
              } catch (e) {}
            }
          });
          resolve();
        }
      });
    });
  });
}

function getAllContent() {
  if (useJsonFallback || !db) {
    return Promise.resolve(loadStore());
  }

  return new Promise((resolve) => {
    db.all('SELECT section, data FROM settings', (err, rows) => {
      if (err || !rows || rows.length === 0) {
        return resolve(loadStore());
      }
      const content = {};
      rows.forEach((r) => {
        try { content[r.section] = JSON.parse(r.data); } catch (e) { content[r.section] = r.data; }
      });
      resolve({ ...DEFAULT_CONTENT, ...content });
    });
  });
}

function updateSection(section, data) {
  persistStore({ [section]: data });

  if (useJsonFallback || !db) {
    return Promise.resolve({ section, success: true });
  }

  return new Promise((resolve) => {
    const jsonStr = JSON.stringify(data);
    db.run(
      `INSERT INTO settings (section, data, updated_at) 
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(section) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP`,
      [section, jsonStr],
      () => resolve({ section, success: true })
    );
  });
}

function updateAllContent(payload) {
  persistStore(payload);

  if (useJsonFallback || !db) {
    return Promise.resolve({ success: true });
  }

  return new Promise((resolve) => {
    db.serialize(() => {
      const stmt = db.prepare(`
        INSERT INTO settings (section, data, updated_at) 
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(section) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP
      `);
      for (const [section, data] of Object.entries(payload)) {
        stmt.run(section, JSON.stringify(data));
      }
      stmt.finalize(() => resolve({ success: true }));
    });
  });
}

function saveGithubRepos(repos) {
  githubReposCache = repos || [];

  if (useJsonFallback || !db) {
    return Promise.resolve({ count: githubReposCache.length });
  }

  return new Promise((resolve) => {
    db.serialize(() => {
      db.run('DELETE FROM github_repos');
      const stmt = db.prepare(`
        INSERT INTO github_repos (id, name, full_name, description, html_url, stars, forks, language, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      (repos || []).forEach((repo) => {
        stmt.run([
          repo.id,
          repo.name,
          repo.full_name,
          repo.description || '',
          repo.html_url,
          repo.stargazers_count || 0,
          repo.forks_count || 0,
          repo.language || 'Code',
          repo.updated_at
        ]);
      });
      stmt.finalize(() => resolve({ count: (repos || []).length }));
    });
  });
}

function getGithubRepos() {
  if (useJsonFallback || !db) {
    return Promise.resolve(githubReposCache || []);
  }

  return new Promise((resolve) => {
    db.all('SELECT * FROM github_repos ORDER BY stars DESC', (err, rows) => {
      if (err || !rows) return resolve(githubReposCache || []);
      resolve(rows);
    });
  });
}

module.exports = {
  initDb,
  getAllContent,
  updateSection,
  updateAllContent,
  saveGithubRepos,
  getGithubRepos,
  DEFAULT_CONTENT,
};
