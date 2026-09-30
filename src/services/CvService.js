'use strict';

const Sanitizer = require('../security/Sanitizer');

/**
 * CvService — renders the A4 ATS CV document.
 * Every interpolated value passes through Sanitizer.
 */
class CvService {
  /** Union of CV-selected and portfolio projects, de-duplicated by title. */
  static collectProjects(content) {
    const cv = content.cvData || {};
    const map = new Map();

    const add = (p) => {
      if (!p || !p.title) return;
      const key = String(p.title).toLowerCase().trim();
      if (!map.has(key)) {
        map.set(key, {
          title: p.title,
          tags: Array.isArray(p.tags) ? p.tags.join(', ') : p.tags || '',
          description: p.description || '',
          linkUrl: p.linkUrl || '',
          date: p.date || '',
        });
      }
    };

    (Array.isArray(cv.selectedProjects) ? cv.selectedProjects : []).forEach(add);
    (Array.isArray(content.projectsList) ? content.projectsList : [])
      .filter((p) => p && p.type === 'project')
      .forEach(add);

    return Array.from(map.values());
  }

  /** Contact line, fully escaped. */
  static renderContacts(cv) {
    const items = [];
    const t = Sanitizer.text;

    if (cv.email) items.push(`<span>${t(cv.email)}</span>`);
    if (cv.location) items.push(`<span>${t(cv.location)}</span>`);

    for (const [label, raw] of [['github', cv.github], ['linkedin', cv.linkedin], ['instagram', cv.instagram]]) {
      if (!raw) continue;
      const clean = t(String(raw).replace(/^https?:\/\//, ''));
      items.push(`<span>${label}: <a href="${Sanitizer.url('https://' + clean)}" target="_blank" rel="noopener noreferrer">${clean}</a></span>`);
    }

    return items.join(' • ');
  }

  /** Full standalone HTML document. */
  static render(content) {
    const cv = content.cvData || {};
    const lanyard = content.lanyard || {};
    const t = Sanitizer.text;

    const experiences = Array.isArray(cv.experiences) ? cv.experiences : [];
    const projects = CvService.collectProjects(content);
    const avatarUrl = cv.avatarUrl || lanyard.avatarUrl || '';
    const showPhoto = cv.showPhoto !== false && Boolean(avatarUrl);

    const headerAlign = showPhoto ? 'space-between' : 'center';
    const headerTextAlign = showPhoto ? 'left' : 'center';
    const contactJustify = showPhoto ? 'flex-start' : 'center';

    const photoBlock = showPhoto
      ? `<div class="avatar-frame">
           <img src="${Sanitizer.url(avatarUrl)}" alt="${t(cv.fullName || 'Profile')}" class="avatar-img" />
         </div>`
      : '';

    const experienceBlock = experiences
      .map(
        (exp) => `<div class="item">
          <div class="item-header">
            <span class="item-title">${t(exp.title)}</span>
            <span class="item-date">${t(exp.year)}</span>
          </div>
          <div class="item-desc">${t(exp.description)}</div>
        </div>`
      )
      .join('');

    const projectBlock = projects
      .map((proj) => {
        const tags = proj.tags ? `<span class="tags">| ${t(proj.tags)}</span>` : '';
        const date = proj.date ? `<span class="item-date">${t(proj.date)}</span>` : '';
        const link = proj.linkUrl
          ? `<div class="item-link"><a href="${Sanitizer.url(proj.linkUrl)}" target="_blank" rel="noopener noreferrer">${t(proj.linkUrl)}</a></div>`
          : '';
        return `<div class="item">
          <div class="item-header">
            <span class="item-title">${t(proj.title)}</span>
            ${tags}${date}
          </div>
          <div class="item-desc">${t(proj.description)}</div>
          ${link}
        </div>`;
      })
      .join('');

    const fullName = cv.fullName || 'YOSIA GRACETHEO BOIMAU';
    const filename = `CV_${Sanitizer.filename(fullName, 'Theo')}.html`;

    return { html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">
    <title>CV - ${t(fullName)}</title>
    <style>
        @page { size: A4 portrait; margin: 12mm 16mm; }

        @media print {
            html, body {
                background: #ffffff !important; margin: 0 !important; padding: 0 !important;
                -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
            }
            .no-print { display: none !important; }
            .screen-backdrop { padding: 0 !important; background: transparent !important; display: block !important; }
            .a4-page {
                width: 100% !important; max-width: 100% !important; min-height: auto !important;
                margin: 0 !important; padding: 0 !important; box-shadow: none !important;
                border: none !important; border-radius: 0 !important;
            }
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #0f172a; line-height: 1.45; font-size: 10pt;
            background: #090d16; margin: 0; padding: 0;
        }

        .screen-backdrop {
            display: flex; flex-direction: column; align-items: center;
            padding: 20px 14px 60px; min-height: 100vh;
        }

        .top-action-bar {
            width: 210mm; max-width: 100%;
            display: flex; align-items: center; justify-content: space-between;
            margin-bottom: 16px; padding: 10px 16px;
            background: rgba(18, 24, 38, 0.9);
            border: 1px solid rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(12px);
            border-radius: 12px; color: #ffffff; font-size: 12px;
        }

        .back-link {
            display: inline-flex; align-items: center; gap: 6px;
            color: #94a3b8; text-decoration: none; font-weight: 500; transition: color 0.2s;
        }
        .back-link:hover { color: #ffffff; }

        .doc-badge {
            display: inline-flex; align-items: center; gap: 6px;
            font-family: monospace; color: #38bdf8;
            background: rgba(56, 189, 248, 0.1);
            padding: 3px 8px; border-radius: 6px; font-size: 11px;
            border: 1px solid rgba(56, 189, 248, 0.2);
        }

        .action-btns { display: flex; align-items: center; gap: 10px; }

        .print-btn-top {
            background: #0284c7; color: #ffffff; border: none;
            padding: 6px 14px; border-radius: 6px; font-weight: 600;
            font-size: 12px; cursor: pointer;
            display: inline-flex; align-items: center; gap: 6px;
            transition: all 0.2s; box-shadow: 0 2px 10px rgba(2, 132, 199, 0.35);
        }
        .print-btn-top:hover { background: #0369a1; transform: translateY(-1px); }

        .a4-page {
            width: 210mm; min-height: 297mm; max-width: 100%;
            background: #ffffff; padding: 16mm 18mm;
            box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.2);
            border-radius: 3px; position: relative;
        }

        .header {
            display: flex; align-items: center; justify-content: ${headerAlign};
            gap: 18px; margin-bottom: 20px; text-align: ${headerTextAlign};
        }
        .header-main { flex: 1; }

        .avatar-frame {
            width: 80px; height: 80px; border-radius: 14px; overflow: hidden;
            border: 2px solid #06b6d4; box-shadow: 0 4px 12px rgba(6, 182, 212, 0.2); flex-shrink: 0;
        }
        .avatar-img { width: 100%; height: 100%; object-fit: cover; display: block; }

        .name {
            font-size: 25pt; font-weight: 800; color: #0f172a;
            text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; line-height: 1.1;
        }
        .job-title { font-size: 13pt; color: #06b6d4; font-weight: 700; margin-bottom: 7px; letter-spacing: 0.3px; }

        .contact-info {
            font-size: 8.8pt; color: #475569; display: flex; flex-wrap: wrap;
            gap: 4px 10px; align-items: center; justify-content: ${contactJustify}; line-height: 1.4;
        }
        .contact-info a { color: #0284c7; text-decoration: none; }
        .contact-info a:hover { text-decoration: underline; }

        .section { margin-bottom: 15px; }

        .section-title {
            font-size: 12pt; font-weight: 800; color: #0f172a;
            text-transform: uppercase; letter-spacing: 0.8px;
            padding-bottom: 2px; margin-bottom: 6px; border-bottom: 2px solid #06b6d4;
        }

        .summary { font-size: 9.5pt; color: #334155; text-align: justify; line-height: 1.5; }

        .item { margin-bottom: 11px; break-inside: avoid; }
        .item-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; gap: 8px; }
        .item-title { font-size: 10pt; font-weight: 700; color: #0f172a; }
        .item-date { font-size: 8.8pt; font-style: italic; color: #64748b; white-space: nowrap; }
        .item-desc { font-size: 9pt; color: #334155; margin-top: 1px; line-height: 1.45; text-align: justify; }
        .item-link { font-size: 7.8pt; margin-top: 1px; }
        .item-link a { color: #0284c7; text-decoration: none; word-break: break-all; }

        .skills-container { font-size: 9.2pt; color: #334155; line-height: 1.55; }
        .skills-category { font-weight: 700; color: #0f172a; }
        .tags { font-size: 8.5pt; color: #475569; font-weight: 500; margin-left: 6px; }
    </style>
</head>
<body>
    <div class="screen-backdrop">
        <div class="top-action-bar no-print">
            <a href="/" class="back-link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                Return to Portfolio
            </a>
            <div class="doc-badge"><span>A4 PORTRAIT // 210 x 297 MM</span></div>
            <div class="action-btns">
                <a href="/admin" class="back-link" style="font-size: 11px;">Edit in Admin</a>
                <button class="print-btn-top" onclick="window.print()">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                    Print / Save as PDF
                </button>
            </div>
        </div>

        <div class="a4-page">
            <div class="header">
                ${photoBlock}
                <div class="header-main">
                    <h1 class="name">${t(fullName)}</h1>
                    <div class="job-title">${t(cv.jobTitle || 'Fullstack Developer | Video Editor | Virtual Jockey')}</div>
                    <div class="contact-info">${CvService.renderContacts(cv)}</div>
                </div>
            </div>

            <div class="section">
                <h2 class="section-title">PROFESSIONAL SUMMARY</h2>
                <div class="summary">${t(cv.summary || 'Digital Solutions for Every Problem')}</div>
            </div>

            <div class="section">
                <h2 class="section-title">EXPERIENCE</h2>
                ${experienceBlock}
            </div>

            <div class="section">
                <h2 class="section-title">SELECTED PROJECTS</h2>
                ${projectBlock}
            </div>

            <div class="section">
                <h2 class="section-title">TECHNICAL SKILLS</h2>
                <div class="skills-container">
                    <span class="skills-category">Core Technologies &amp; Tools: </span>
                    ${t(cv.technicalSkills || 'Python, REST API, EasyOCR, YOLO, HTML, JavaScript, CSS, Tailwind CSS, Laravel 11, PHP 8.3, MySQL, React, Three.js, Git')}
                </div>
            </div>
        </div>
    </div>
</body>
</html>`, filename };
  }
}

module.exports = CvService;
