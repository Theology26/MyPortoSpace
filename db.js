const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const isVercel = Boolean(process.env.VERCEL);
const DB_PATH = isVercel
  ? path.join('/tmp', 'database.sqlite')
  : path.join(__dirname, 'database.sqlite');

if (isVercel) {
  const localDb = path.join(__dirname, 'database.sqlite');
  if (fs.existsSync(localDb) && !fs.existsSync(DB_PATH)) {
    try {
      fs.copyFileSync(localDb, DB_PATH);
    } catch (e) {
      console.warn('Could not copy seed database to /tmp:', e.message);
    }
  }
}

const db = new sqlite3.Database(DB_PATH);

// Initial default content matching Theo's authentic portfolio and PDF CV
const DEFAULT_CONTENT = {
  general: {
    siteTitle: 'Yosia Gracetheo Boimau — Fullstack Developer, Video Editor & VJ',
    siteDescription: 'Portofolio Yosia Gracetheo Boimau — Solusi Digital Setiap Permasalahan Anda. Fullstack Developer, Video Editor, dan Virtual Jockey berbasis di Malang.',
    brandName: 'THEOLOGY26',
    brandDomain: 'theo.dev',
    brandStatus: 'AVAILABLE',
    linktreeUrl: 'https://linktr.ee/TheHighTee',
    githubUrl: 'https://github.com/Theology26',
    instagramUrl: 'https://instagram.com/theoxcyro',
    address: 'Jl.S.Supriadi VII No 3, Malang, Indonesia',
    adminPasscode: 'theology26',
    logoUrl: '/Assets/avatar_animated.png',
    githubUsername: 'Theology26',
    githubToken: '',
  },
  hero: {
    badgeText: 'FULLSTACK DEVELOPER // VIDEO & VJ',
    badgeSubtext: 'LARAVEL 11 & CREATIVE TECH',
    eyebrow: 'Solusi Digital Setiap Permasalahan Anda',
    titleLine1: 'Yosia Gracetheo Boimau',
    titleLine2: 'Fullstack Dev • Video Editor • VJ',
    description: 'Membangun arsitektur web modern dengan Laravel 11, integrasi computer vision/OCR, sistem logistik cerdas, serta produksi visual kreatif dan projection mapping tingkat tinggi.',
    ctaPrimaryText: 'Eksplorasi Portofolio ↓',
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
      id: 'ocr-webtoon',
      type: 'project',
      title: 'PENGEMBANGAN OCR UNTUK WEBTOON KOREA',
      category: 'AI & Computer Vision',
      issuer: 'Independent AI Research',
      tags: 'Python, Rest API, Easy OCR, YOLO, IO Paint',
      description: 'Pengembangan sistem OCR Webtoon Korea ini menunjukkan hasil yang sangat positif dalam mengatasi keterbatasan bahasa dan menekan penggunaan situs ilegal.',
      linkUrl: 'https://github.com/Theology26',
      imageUrl: '',
      badge: 'AI / OCR ENGINE',
      featured: true,
      stats: 'YOLO + EasyOCR',
      date: '2025'
    },
    {
      id: 'cert-laravel-11',
      type: 'certificate',
      title: 'Sertifikasi Laravel 11 Advanced Architecture & TDD',
      category: 'Backend Architecture',
      issuer: 'Laravel / PHP Specialist',
      tags: 'Laravel 11, Eloquent ORM, REST API, PHP 8.3, TDD',
      description: 'Penguasaan arsitektur backend enterprise Laravel 11, optimasi database query Eloquent, unit testing, dan integrasi reporting engine.',
      linkUrl: 'https://github.com/Theology26',
      imageUrl: '',
      badge: 'OFFICIAL CERTIFICATE',
      featured: true,
      stats: 'Score: 96%',
      date: '2024'
    },
    {
      id: 'sparkling-cleaners',
      type: 'project',
      title: 'Website Sparkling Cleaners Malang',
      category: 'Web & UMKM',
      issuer: 'Client Project Malang',
      tags: 'HTML, JS, CSS, Responsive UI',
      description: 'Membuatkan website untuk promosi dan pemesanan layanan kebersihan untuk UMKM Kota Malang dengan desain modern dan alur pemesanan mudah.',
      linkUrl: 'https://github.com/Theology26',
      imageUrl: '',
      badge: 'CLIENT UMKM',
      featured: false,
      stats: 'Malang UMKM',
      date: '2025'
    },
    {
      id: 'cert-meta-frontend',
      type: 'certificate',
      title: 'Meta Front-End Developer Professional Certificate',
      category: 'Frontend Engineering',
      issuer: 'Meta (Coursera)',
      tags: 'React, JavaScript ES6+, UI/UX Systems, Responsive Design',
      description: 'Spesialisasi rekayasa antarmuka web modern, arsitektur komponen React, state management, dan optimasi performa web responsif.',
      linkUrl: 'https://github.com/Theology26',
      imageUrl: '',
      badge: 'PROFESSIONAL CERTIFICATE',
      featured: false,
      stats: 'Verified Credential',
      date: '2024'
    },
    {
      id: 'logistik-cerdas',
      type: 'project',
      title: 'INTEGRASI VISI KOMPUTER & LOGISTIK CERDAS',
      category: 'Enterprise & AI',
      issuer: 'Enterprise System',
      tags: 'Tailwind CSS, JavaScript, Custom CMS, Laravel 11',
      description: 'Sistem manajemen rantai pasok (supply chain) modern yang dirancang untuk melacak pergerakan armada dan inventaris secara presisi. Fondasi backend Laravel dengan struktur database relasional tingkat tinggi dan dasbor analitik real-time.',
      linkUrl: 'https://github.com/Theology26',
      imageUrl: '',
      badge: 'ENTERPRISE SYSTEM',
      featured: true,
      stats: 'Laravel + AI Vision',
      date: '2025'
    },
    {
      id: 'cert-binus-cs',
      type: 'certificate',
      title: 'Bachelor of Computer Science Degree',
      category: 'Academic Credential',
      issuer: 'BINUS University',
      tags: 'Software Engineering, Database, Web Architecture, Algorithms',
      description: 'Gelar sarjana ilmu komputer dengan fokus pada software engineering, arsitektur sistem enterprise, database relasional, dan kecerdasan buatan.',
      linkUrl: 'https://github.com/Theology26',
      imageUrl: '',
      badge: 'ACADEMIC DEGREE',
      featured: true,
      stats: 'GPA 3.5+',
      date: '2021 — 2025'
    },
    {
      id: 'web-portofolio',
      type: 'project',
      title: 'Web Portofolio Theo (3D Space Edition)',
      category: 'Full-Stack & 3D WebGL',
      issuer: 'Theology26 Core',
      tags: 'Laravel 11, React 18, Three.js, MySQL, DomPDF Engine',
      description: 'Full-stack portfolio system dengan dynamic CMS backend, real-time GitHub sync engine, automated A4 PDF generation, dan 3D WebGL space atmosphere.',
      linkUrl: 'https://github.com/Theology26/webportofoliotheo',
      imageUrl: '',
      badge: 'FULL-STACK CMS',
      featured: true,
      stats: '3D WebGL + SQLite',
      date: '2025'
    }
  ],
  projectSpotlight: {
    label: '02 // FEATURED LOGISTICS BUILD',
    title: 'Sistem Logistik Cerdas & Visi Komputer',
    subtitle: 'Rantai pasok (supply chain) modern dengan backend Laravel dan algoritma pelacakan presisi.',
    badge: 'ENTERPRISE ARCHITECTURE',
    projectName: 'Integrasi Visi Komputer & Logistik Cerdas',
    description: 'Sistem manajemen rantai pasok modern untuk efisiensi distribusi makan bergizi. Dilengkapi arsitektur backend Laravel, dasbor analitik real-time, dan minimasi kesalahan logistik.',
    metrics: [
      { label: 'FRAMEWORK', value: 'Laravel 11' },
      { label: 'FRONTEND', value: 'Tailwind + React' },
      { label: 'DATABASE', value: 'MySQL Relational' },
      { label: 'DISPATCH', value: 'Real-time Tracking' }
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
      '$ echo "Distribution logistics optimized ✓"'
    ],
    githubRepoUrl: 'https://github.com/Theology26',
    liveDemoUrl: '#'
  },
  gallery: [
    {
      title: 'Visual Projection Mapping & VJ Live Performance',
      subtitle: 'GKJW Sukun Event Visual Stage Control',
      tags: 'VJing, Resolume, Projection Mapping',
      icon: 'VJ'
    },
    {
      title: 'Video Editing & Visual Storytelling Post-Production',
      subtitle: 'Narasi visual kampanye dan video kreatif',
      tags: 'Premiere Pro, After Effects, DaVinci',
      icon: 'EDIT'
    },
    {
      title: 'OCR Webtoon Korea & AI Translation Pipeline',
      subtitle: 'EasyOCR & YOLO Machine Learning Engine',
      tags: 'Python, YOLO, Computer Vision',
      icon: 'AI'
    },
    {
      title: 'Full-Stack Architecture & Modern CMS Console',
      subtitle: 'Laravel 11, Three.js WebGL & React Systems',
      tags: 'Laravel, Node, SQLite, Three.js',
      icon: 'DEV'
    }
  ],
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
    location: 'Jl.S.Supriadi VII No 3, Malang',
    website: 'theo.dev',
    linkedin: 'linkedin.com/in/yosia-gracetheo-boimau-919340211/',
    github: 'github.com/Theology26',
    instagram: 'instagram.com/theoxcyro',
    summary: 'Solusi Digital Setiap Permasalahan Anda',
    experiences: [
      {
        title: 'Video Editor',
        company: 'Independent Creative Specialist',
        year: '2025 - Sekarang',
        description: 'Spesialis pasca-produksi untuk meracik raw footage menjadi narasi visual premium.'
      },
      {
        title: 'Content Strategist',
        company: 'Digital Media Strategy',
        year: '2025 - Sekarang',
        description: 'Menganalisis tren dan merancang arsitektur konten digital beserta jadwal distribusinya.'
      },
      {
        title: 'Director Iklan Sekolah',
        company: 'School Campaign Project',
        year: '2025',
        description: 'Memimpin produksi visual kampanye sekolah hingga sukses menaikkan rasio pendaftaran.'
      },
      {
        title: 'Virtual Jockey (VJ) GKJW Sukun',
        company: 'GKJW Sukun',
        year: '2024 - Sekarang',
        description: 'Mengendalikan tata visual dan projection mapping secara live untuk berbagai event.'
      }
    ],
    selectedProjects: [
      {
        title: 'PENGEMBANGAN OCR UNTUK WEBTOON KOREA',
        tags: 'Python, Rest API, Easy OCR, YOLO, IO Paint',
        description: 'Pengembangan sistem OCR Webtoon Korea ini menunjukkan hasil yang sangat positif dalam mengatasi keterbatasan bahasa dan menekan penggunaan situs ilegal.'
      },
      {
        title: 'Website Sparkling Cleaners Malang',
        tags: 'HTML, js, CSS,',
        description: 'Membuatkan website untuk promosi dan pemesanan untuk UMKM Kota Malang'
      },
      {
        title: 'INTEGRASI VISI KOMPUTER DAN JARINGAN SARAF TIRUAN PADA SISTEM LOGISTIK CERDAS UNTUK EFISIENSI DISTRIBUSI MAKAN BERGIZI',
        tags: 'Tailwind CSS, JavaScript, Custom CMS',
        description: 'Sistem manajemen rantai pasok (supply chain) modern yang dirancang untuk melacak pergerakan armada dan inventaris secara presisi. Dibangun di atas fondasi backend Laravel dengan struktur database relasional tingkat tinggi. Sistem ini dilengkapi dengan dasbor analitik interaktif dan algoritma pelacakan real-time yang mampu mengurangi bottleneck distribusi, memberikan laporan instan, serta meminimalisir kesalahan input logistik secara otomatis.'
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

// Initialize schema and seed data
function initDb() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 1. Settings table for key-value json sections
      db.run(`
        CREATE TABLE IF NOT EXISTS settings (
          section TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) return reject(err);
      });

      // 2. Custom projects table
      db.run(`
        CREATE TABLE IF NOT EXISTS custom_projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          tags TEXT,
          stars INTEGER DEFAULT 0,
          forks INTEGER DEFAULT 0,
          language TEXT,
          repo_url TEXT,
          live_url TEXT,
          sort_order INTEGER DEFAULT 0
        )
      `);

      // 3. GitHub repositories cache table
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

      // Seed initial content if empty
      db.get('SELECT COUNT(*) as count FROM settings', (err, row) => {
        if (err) return reject(err);
        if (row && row.count === 0) {
          console.log('Seeding initial portfolio content into SQLite...');
          const stmt = db.prepare('INSERT INTO settings (section, data) VALUES (?, ?)');
          for (const [section, data] of Object.entries(DEFAULT_CONTENT)) {
            stmt.run(section, JSON.stringify(data));
          }
          stmt.finalize((err2) => {
            if (err2) reject(err2);
            else resolve();
          });
        } else {
          resolve();
        }
      });
    });
  });
}

// Get all site content
function getAllContent() {
  return new Promise((resolve) => {
    db.all('SELECT section, data FROM settings', (err, rows) => {
      if (err) {
        console.warn('DB read fallback to default content:', err.message);
        return resolve(DEFAULT_CONTENT);
      }
      const content = {};
      rows.forEach(r => {
        try {
          content[r.section] = JSON.parse(r.data);
        } catch (e) {
          content[r.section] = r.data;
        }
      });
      // Merge with defaults for safety
      const merged = { ...DEFAULT_CONTENT, ...content };
      resolve(merged);
    });
  });
}

// Update a specific section
function updateSection(section, data) {
  return new Promise((resolve, reject) => {
    const jsonStr = JSON.stringify(data);
    db.run(
      `INSERT INTO settings (section, data, updated_at) 
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(section) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP`,
      [section, jsonStr],
      function(err) {
        if (err) reject(err);
        else resolve({ section, success: true });
      }
    );
  });
}

// Update multiple sections in batch
function updateAllContent(payload) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      const stmt = db.prepare(`
        INSERT INTO settings (section, data, updated_at) 
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(section) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP
      `);
      
      for (const [section, data] of Object.entries(payload)) {
        stmt.run(section, JSON.stringify(data));
      }

      stmt.finalize((err) => {
        if (err) reject(err);
        else resolve({ success: true });
      });
    });
  });
}

// Save GitHub repo cache
function saveGithubRepos(repos) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('DELETE FROM github_repos');
      const stmt = db.prepare(`
        INSERT INTO github_repos (id, name, full_name, description, html_url, stars, forks, language, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      repos.forEach(repo => {
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
      stmt.finalize((err) => {
        if (err) reject(err);
        else resolve({ count: repos.length });
      });
    });
  });
}

function getGithubRepos() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM github_repos ORDER BY stars DESC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
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
