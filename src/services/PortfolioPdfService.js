'use strict';

const Sanitizer = require('../security/Sanitizer');

/**
 * Only literal hex colours may reach a style attribute. Anything else (a url(),
 * a var(), an expression) falls back to the accent, so a stored value can never
 * turn into arbitrary CSS.
 */
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function safeColor(value, fallback) {
  const v = String(value || '').trim();
  return HEX_COLOR.test(v) ? v : fallback;
}

/**
 * PortfolioPdfService — renders a designed, multi-page A4 portfolio document.
 *
 * Deliberately a separate document from CvService: a CV is a terse ATS document,
 * this is a visual portfolio meant to be opened, skimmed and shared. Same
 * print-to-PDF delivery model (no PDF dependency), same escaping rules — every
 * interpolated value passes through Sanitizer.
 */
class PortfolioPdfService {
  /** Projects, split into featured and the rest, both in stored order. */
  static collectProjects(content) {
    const all = (Array.isArray(content.projectsList) ? content.projectsList : [])
      .filter((p) => p && p.type === 'project' && p.title && p.showInPortfolio !== false);
    return {
      featured: all.filter((p) => p.featured),
      rest: all.filter((p) => !p.featured),
      total: all.length,
    };
  }

  /** Contact chips; empty fields are dropped rather than rendered blank. */
  static renderContacts(cv, t, url) {
    const chips = [];
    if (cv.email) chips.push({ label: 'Email', value: cv.email, href: `mailto:${cv.email}` });
    if (cv.location) chips.push({ label: 'Location', value: cv.location, href: '' });
    if (cv.github) chips.push({ label: 'GitHub', value: cv.github, href: `https://${String(cv.github).replace(/^https?:\/\//, '')}` });
    if (cv.linkedin) chips.push({ label: 'LinkedIn', value: cv.linkedin, href: `https://${String(cv.linkedin).replace(/^https?:\/\//, '')}` });
    if (cv.instagram) chips.push({ label: 'Instagram', value: cv.instagram, href: `https://${String(cv.instagram).replace(/^https?:\/\//, '')}` });

    return chips
      .map((c) => {
        const value = t(c.value);
        return c.href
          ? `<a class="chip" href="${url(c.href)}">${value}</a>`
          : `<span class="chip">${value}</span>`;
      })
      .join('');
  }

  static renderStat(value, label) {
    if (value === null || value === undefined || value === '') return '';
    return `<div class="stat">
        <span class="stat-num">${Sanitizer.text(value)}</span>
        <span class="stat-label">${Sanitizer.text(label)}</span>
      </div>`;
  }

  /** One project card. GitHub link is rendered as an explicit, visible URL. */
  static renderProject(p, t, url, { compact = false } = {}) {
    const tags = Array.isArray(p.tags)
      ? p.tags
      : String(p.tags || '').split(',').map((s) => s.trim()).filter(Boolean);

    const tagPills = tags
      .map((tag) => `<span class="pill">${t(tag)}</span>`)
      .join('');

    const link = p.linkUrl
      ? `<a class="repo-link" href="${url(p.linkUrl)}">${t(p.linkUrl)}</a>`
      : '';

    const meta = [p.badge, p.category, p.date].filter(Boolean).map((m) => t(m)).join(' &nbsp;·&nbsp; ');

    return `<article class="project${p.featured ? ' featured' : ''}">
        <header class="project-head">
          <h3 class="project-title">${t(p.title)}</h3>
          ${p.stats ? `<span class="project-stats">${t(p.stats)}</span>` : ''}
        </header>
        ${meta ? `<p class="project-meta">${meta}</p>` : ''}
        ${p.description ? `<p class="project-desc">${t(p.description)}</p>` : ''}
        ${tagPills ? `<div class="pills">${tagPills}</div>` : ''}
        ${link ? `<div class="project-foot">${link}</div>` : ''}
      </article>`;
  }

  static renderExperience(exp, t) {
    const title = t(exp.title);
    const company = exp.company ? ` — ${t(exp.company)}` : '';
    return `<div class="exp">
        <div class="exp-head">
          <span class="exp-title">${title}${company}</span>
          ${exp.year ? `<span class="exp-year">${t(exp.year)}</span>` : ''}
        </div>
        ${exp.description ? `<p class="exp-desc">${t(exp.description)}</p>` : ''}
      </div>`;
  }

  static renderCertificate(c, t, url) {
    const issuer = c.issuer ? `<span class="cert-issuer">${t(c.issuer)}</span>` : '';
    const date = c.date ? `<span class="cert-date">${t(c.date)}</span>` : '';
    const link = c.linkUrl ? `<a class="cert-link" href="${url(c.linkUrl)}">Verify</a>` : '';
    return `<li class="cert">
        <span class="cert-title">${t(c.title)}</span>
        ${issuer}${date}${link}
      </li>`;
  }

  /** Full standalone HTML document. */
  static render(content) {
    const cv = content.cvData || {};
    const stats = content.githubStats || {};
    const t = Sanitizer.text;
    const url = Sanitizer.url;

    const fullName = cv.fullName || 'YOSIA GRACETHEO BOIMAU';
    const jobTitle = cv.jobTitle || 'Fullstack Developer';
    const filename = `Portfolio_${Sanitizer.filename(fullName, 'Theo')}.html`;

    const avatarUrl = cv.avatarUrl || '';
    const showPhoto = cv.showPhoto !== false && Boolean(avatarUrl);
    const photo = showPhoto
      ? `<img class="avatar" src="${url(avatarUrl)}" alt="${t(fullName)}" />`
      : `<div class="avatar avatar-fallback">${t(fullName.split(' ').map((w) => w[0]).join('').slice(0, 2))}</div>`;

    const statBlock = [
      PortfolioPdfService.renderStat(stats.reposCount, 'Repositories'),
      PortfolioPdfService.renderStat(stats.starsCount, 'Stars'),
      PortfolioPdfService.renderStat(stats.languagesCount, 'Languages'),
      PortfolioPdfService.renderStat((cv.experiences || []).length, 'Experiences'),
    ].join('');

    const languages = (Array.isArray(stats.languages) ? stats.languages : [])
      .slice(0, 8)
      .map((l) => {
        const pct = Math.max(2, Math.min(100, Number(l.percentage) || 0));
        const color = safeColor(l.color, '#0ea5e9');
        return `<li class="lang">
          <span class="lang-dot" style="background:${color}"></span>
          <span class="lang-name">${t(l.name)}</span>
          <span class="lang-bar"><span class="lang-fill" style="width:${pct}%;background:${color}"></span></span>
          <span class="lang-pct">${t(Number(l.percentage || 0).toFixed(1))}%</span>
        </li>`;
      })
      .join('');

    const techPills = (Array.isArray(content.techTags) ? content.techTags : [])
      .map((tag) => `<span class="pill pill-lg">${t(tag)}</span>`)
      .join('');

    const experiences = (Array.isArray(cv.experiences) ? cv.experiences : [])
      .map((e) => PortfolioPdfService.renderExperience(e, t))
      .join('');

    const { featured, rest, total } = PortfolioPdfService.collectProjects(content);
    const featuredBlock = featured.map((p) => PortfolioPdfService.renderProject(p, t, url, { compact: false })).join('');
    const restBlock = rest.map((p) => PortfolioPdfService.renderProject(p, t, url, { compact: true })).join('');

    const certificates = (Array.isArray(content.certificatesList) ? content.certificatesList : [])
      .map((c) => PortfolioPdfService.renderCertificate(c, t, url))
      .join('');

    return { html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Portfolio — ${t(fullName)}</title>
<style>
    @page { size: A4 portrait; margin: 14mm 14mm 16mm; }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --ink: #0f172a;
      --body: #334155;
      --muted: #64748b;
      --line: #e2e8f0;
      --accent: #0369a1;
      --accent-soft: #e0f2fe;
      --chip: #f1f5f9;
    }

    body {
      font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", Arial, sans-serif;
      color: var(--body);
      font-size: 9.1pt;
      line-height: 1.45;
      background: #eef2f7;
    }

    /* ---------- screen chrome ---------- */
    .toolbar {
      width: 210mm; max-width: 100%; margin: 0 auto 14px;
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 10px 14px; background: #0f172a; color: #f8fafc;
      border-radius: 10px; font-size: 11px;
    }
    .toolbar a { color: #94a3b8; text-decoration: none; font-weight: 600; }
    .toolbar a:hover { color: #fff; }
    .print-btn {
      background: var(--accent); color: #fff; border: 0; cursor: pointer;
      padding: 8px 16px; border-radius: 7px; font-weight: 700; font-size: 11px;
    }
    .print-btn:hover { background: #075985; }

    /* ---------- page ---------- */
    .page {
      width: 210mm; min-height: 296mm; max-width: 100%;
      margin: 0 auto 14px; background: #fff; padding: 16mm 15mm;
      box-shadow: 0 12px 34px rgba(15, 23, 42, .16);
      display: flex; flex-direction: column;
      position: relative;
    }
    .page-inner { flex: 1; }

    .page-foot {
      margin-top: 10mm; padding-top: 3mm; border-top: 1px solid var(--line);
      display: flex; justify-content: space-between;
      font-size: 7.6pt; color: var(--muted); letter-spacing: .2px;
    }
    /* Footers only make sense while previewing pages on screen. */
    @media print { .page-foot { display: none !important; } }

    /* ---------- cover ---------- */
    .cover-head { display: flex; gap: 16px; align-items: center; }
    .avatar {
      width: 62px; height: 62px; border-radius: 12px; object-fit: cover;
      border: 2px solid var(--accent); flex-shrink: 0; background: #f8fafc;
    }
    .avatar-fallback {
      display: flex; align-items: center; justify-content: center;
      font-size: 20pt; font-weight: 800; color: var(--accent); letter-spacing: 1px;
    }
    .name {
      font-size: 19.5pt; font-weight: 800; color: var(--ink);
      text-transform: uppercase; letter-spacing: 1.1px; line-height: 1.1;
    }
    .role { font-size: 10.5pt; font-weight: 700; color: var(--accent); margin-top: 2px; }
    .chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }
    .chip {
      font-size: 7.4pt; color: var(--body); background: var(--chip);
      border: 1px solid var(--line); border-radius: 999px;
      padding: 2px 8px; text-decoration: none;
    }
    .chip:hover { border-color: var(--accent); color: var(--accent); }

    .rule { height: 2.5px; background: var(--accent); width: 44px; margin: 6mm 0 3mm; }

    h2.section {
      font-size: 10pt; font-weight: 800; color: var(--ink);
      text-transform: uppercase; letter-spacing: 1px; margin-bottom: 3px;
      padding-bottom: 2.5px; border-bottom: 1px solid var(--line);
    }
    .section-block { margin-bottom: 5mm; break-inside: avoid; }

    .summary { text-align: justify; font-size: 9.1pt; }

    .stats { display: flex; gap: 6px; margin-top: 3.5mm; }
    .stat {
      flex: 1; border: 1px solid var(--line); border-radius: 8px;
      padding: 5px 7px; background: #fbfdff;
    }
    .stat-num { display: block; font-size: 13.5pt; font-weight: 800; color: var(--accent); line-height: 1.1; }
    .stat-label {
      display: block; font-size: 6.9pt; color: var(--muted);
      text-transform: uppercase; letter-spacing: .6px; margin-top: 1px;
    }

    .langs { list-style: none; display: flex; flex-direction: column; gap: 2.5px; margin-top: 1mm; }
    .lang { display: grid; grid-template-columns: 9px 74px 1fr 34px; align-items: center; gap: 7px; }
    .lang-dot { width: 7px; height: 7px; border-radius: 99px; display: block; }
    .lang-name { font-size: 8.3pt; color: var(--body); font-weight: 600; }
    .lang-bar { height: 5px; background: var(--line); border-radius: 99px; overflow: hidden; }
    .lang-fill { display: block; height: 100%; border-radius: 99px; }
    .lang-pct { font-size: 7.7pt; color: var(--muted); text-align: right; font-variant-numeric: tabular-nums; }

    .pills { display: flex; flex-wrap: wrap; gap: 3.5px; margin-top: 2px; }
    .pill {
      font-size: 7.1pt; color: var(--accent); background: var(--accent-soft);
      border: 1px solid #bae6fd; border-radius: 999px; padding: 1.5px 7px; font-weight: 600;
    }
    .pill-lg { font-size: 7.8pt; padding: 2.5px 9px; }

    .exp { margin-bottom: 3mm; break-inside: avoid; }
    .exp-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
    .exp-title { font-size: 9.5pt; font-weight: 700; color: var(--ink); }
    .exp-year { font-size: 7.9pt; color: var(--muted); font-style: italic; white-space: nowrap; }
    .exp-desc { font-size: 8.8pt; margin-top: 1px; text-align: justify; }

    /* ---------- projects ---------- */
    .project {
      border: 1px solid var(--line); border-left: 3px solid #cbd5e1;
      border-radius: 8px; padding: 3mm 3.5mm; margin-bottom: 3mm;
      break-inside: avoid;
    }
    .project.featured { border-left-color: var(--accent); background: #fbfdff; }
    .project-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
    .project-title { font-size: 10.2pt; font-weight: 700; color: var(--ink); }
    .project-stats {
      font-size: 7.2pt; color: var(--muted); white-space: nowrap;
      background: var(--chip); border-radius: 999px; padding: 1.2px 7px;
    }
    .project-meta {
      font-size: 7.2pt; color: var(--accent); font-weight: 700;
      text-transform: uppercase; letter-spacing: .5px; margin-top: 1.5px;
    }
    .project-desc { font-size: 8.7pt; margin-top: 2px; text-align: justify; }
    .project-foot { margin-top: 2.5px; border-top: 1px dashed var(--line); padding-top: 2px; }
    .repo-link {
      font-family: Consolas, "SF Mono", Menlo, monospace; font-size: 7.2pt;
      color: var(--accent); text-decoration: none;
      /* break-word keeps URLs readable; break-all orphaned single characters. */
      overflow-wrap: break-word; word-break: normal;
    }
    .repo-link:hover { text-decoration: underline; }

    /* Non-featured repositories read better two-up — keeps the sheet count down
       and stops a long list from running over several pages. */
    .project-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; align-items: start;
    }
    .project-grid .project { margin-bottom: 0; }
    @media print { .project-grid { break-inside: auto; } }

    /* ---------- credentials ---------- */
    .certs { list-style: none; }
    .cert {
      display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;
      padding: 2mm 0; border-bottom: 1px solid var(--line); break-inside: avoid;
    }
    .cert:last-child { border-bottom: 0; }
    .cert-title { font-size: 9.2pt; font-weight: 700; color: var(--ink); }
    .cert-issuer { font-size: 8.1pt; color: var(--body); }
    .cert-date { font-size: 7.7pt; color: var(--muted); font-style: italic; }
    .cert-link { font-size: 7.5pt; color: var(--accent); text-decoration: none; margin-left: auto; }
    .cert-link:hover { text-decoration: underline; }

    .empty { font-size: 9pt; color: var(--muted); font-style: italic; }

    /* ---------- print ----------
       Only the cover forces a page break. Projects and credentials flow
       naturally, so a long project list spans extra sheets instead of being
       clipped or pushed onto a near-empty one. */
    @media print {
      html, body {
        background: #fff !important; margin: 0 !important; padding: 0 !important;
        -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
      }
      .toolbar { display: none !important; }
      .page {
        width: auto !important; min-height: 0 !important; max-width: none !important;
        margin: 0 !important; padding: 0 !important; box-shadow: none !important;
        break-inside: auto;
      }
      .page--cover { break-after: page; page-break-after: always; }
      .sheet-label { display: none !important; }
      .section-block, .project, .exp, .cert { break-inside: avoid; }
      h2.section { break-after: avoid; page-break-after: avoid; }
    }
</style>
</head>
<body>
    <div class="toolbar">
      <a href="/">&larr; Return to Portfolio</a>
      <button class="print-btn" onclick="window.print()">Save as PDF / Print</button>
    </div>

    <!-- ============ COVER / PROFILE ============ -->
    <section class="page page--cover">
      <div class="page-inner">
        <header class="cover-head">
          ${photo}
          <div>
            <h1 class="name">${t(fullName)}</h1>
            <div class="role">${t(jobTitle)}</div>
            <div class="chips">${PortfolioPdfService.renderContacts(cv, t, url)}</div>
          </div>
        </header>

        <div class="rule"></div>

        <div class="section-block">
          <h2 class="section">Profile</h2>
          <p class="summary">${t(cv.summary || '')}</p>
        </div>

        ${statBlock ? `<div class="section-block">
          <h2 class="section">At a Glance</h2>
          <div class="stats">${statBlock}</div>
        </div>` : ''}

        ${languages ? `<div class="section-block">
          <h2 class="section">Language Telemetry</h2>
          <ul class="langs">${languages}</ul>
        </div>` : ''}

        ${techPills ? `<div class="section-block">
          <h2 class="section">Technology Stack</h2>
          <div class="pills">${techPills}</div>
        </div>` : ''}

        ${experiences ? `<div class="section-block">
          <h2 class="section">Experience</h2>
          ${experiences}
        </div>` : ''}
      </div>
      <footer class="page-foot">
        <span>${t(fullName)} — Portfolio</span>
        <span>Profile</span>
      </footer>
    </section>

    <!-- ============ PROJECTS ============ -->
    <section class="page">
      <div class="page-inner">
        <h2 class="section">Selected Projects &amp; Repositories</h2>
        <p class="summary" style="margin:2.5mm 0 4mm;color:var(--muted);font-size:8.7pt;">
          ${total} project${total === 1 ? '' : 's'} sourced from the portfolio content store.
          Every entry links to its public repository.
        </p>

        ${featuredBlock ? `<h2 class="section" style="margin-top:2mm;">Featured</h2>${featuredBlock}` : ''}
        ${restBlock ? `<h2 class="section" style="margin-top:2mm;">All Repositories</h2><div class="project-grid">${restBlock}</div>` : ''}
        ${!featuredBlock && !restBlock ? '<p class="empty">No projects published yet.</p>' : ''}
      </div>
      <footer class="page-foot">
        <span>${t(fullName)} — Portfolio</span>
        <span>Projects &amp; Repositories</span>
      </footer>
    </section>

    <!-- ============ CREDENTIALS ============ -->
    <section class="page">
      <div class="page-inner">
        <h2 class="section">Credentials &amp; Certifications</h2>
        ${certificates ? `<ul class="certs">${certificates}</ul>` : '<p class="empty">No credentials published yet.</p>'}

        ${cv.technicalSkills ? `<div class="section-block" style="margin-top:5mm;">
          <h2 class="section">Technical Skills</h2>
          <p style="text-align:justify;">${t(cv.technicalSkills)}</p>
        </div>` : ''}

        <div class="section-block" style="margin-top:5mm;">
          <h2 class="section">Contact</h2>
          <div class="chips">${PortfolioPdfService.renderContacts(cv, t, url)}</div>
        </div>
      </div>
      <footer class="page-foot">
        <span>${t(fullName)} — Portfolio</span>
        <span>Credentials</span>
      </footer>
    </section>
</body>
</html>`, filename };
  }
}

module.exports = PortfolioPdfService;