'use strict';

const https = require('https');

const LANG_COLORS = {
  TypeScript: '#3178c6', PHP: '#8892be', JavaScript: '#f1e05a', Blade: '#94a3b8',
  Go: '#00add8', Python: '#3572A5', Vue: '#41b883', HTML: '#e34c26',
  CSS: '#563d7c', Mermaid: '#ff3670', PowerShell: '#012456', Dockerfile: '#384d54',
  Shell: '#89e051',
};

const REQUEST_TIMEOUT_MS = 10000;
const MAX_REPOS = 100;

/**
 * GitHubSyncService — fetches repository telemetry and merges it into
 * portfolio content. Owns all outbound GitHub HTTP.
 */
class GitHubSyncService {
  constructor(repository) {
    this.repository = repository;
  }

  /** Perform a JSON GET against api.github.com with a hard timeout. */
  static getJson(url, headers) {
    return new Promise((resolve, reject) => {
      const req = https.get(url, { headers, timeout: REQUEST_TIMEOUT_MS }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
          if (body.length > 5_000_000) {
            req.destroy();
            reject(new Error('GitHub response too large'));
          }
        });
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`GitHub API returned status ${res.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(new Error(`Failed to parse GitHub response: ${err.message}`));
          }
        });
      });
      req.on('timeout', () => req.destroy(new Error('GitHub API request timed out')));
      req.on('error', reject);
    });
  }

  buildHeaders(token) {
    const headers = {
      'User-Agent': 'Theology26-Portfolio-CMS',
      Accept: 'application/vnd.github.v3+json',
    };
    if (token && String(token).trim() !== '') {
      headers.Authorization = `token ${String(token).trim()}`;
    }
    return headers;
  }

  /** Fetch public repositories for a user. */
  async fetchRepos(username, token) {
    const headers = this.buildHeaders(token);
    const url = `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=${MAX_REPOS}`;
    const repos = await GitHubSyncService.getJson(url, headers);
    if (!Array.isArray(repos)) throw new Error('Unexpected GitHub response format');
    return { repos, headers };
  }

  /** Aggregate per-repository language byte counts. */
  async aggregateLanguages(repos, headers) {
    const totals = {};
    await Promise.all(
      repos.map(async (repo) => {
        if (!repo.languages_url) return;
        try {
          const langs = await GitHubSyncService.getJson(repo.languages_url, headers);
          for (const [name, bytes] of Object.entries(langs)) {
            if (typeof bytes === 'number') totals[name] = (totals[name] || 0) + bytes;
          }
        } catch {
          // A single failing language endpoint must not abort the sync.
        }
      })
    );
    return totals;
  }

  buildGithubStats(repos, langTotals) {
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

    return {
      reposCount: repos.length,
      starsCount: repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0),
      languagesCount: new Set(repos.map((r) => r.language).filter(Boolean)).size,
      languages,
      updatedAt: new Date().toISOString(),
    };
  }

  /** Merge repos into projectsList, preserving any hand-edited fields. */
  mergeProjects(existingList, repos, username) {
    const list = Array.isArray(existingList) ? [...existingList] : [];
    let addedCount = 0;
    let updatedCount = 0;

    for (const repo of repos) {
      const index = list.findIndex((item) => {
        if (item.linkUrl && repo.html_url && String(item.linkUrl).toLowerCase() === String(repo.html_url).toLowerCase()) return true;
        return item.id === `gh-${repo.id}` || item.id === String(repo.name).toLowerCase();
      });

      const stars = repo.stargazers_count || 0;
      const forks = repo.forks_count || 0;
      const lang = repo.language || 'Code';
      const year = repo.updated_at ? new Date(repo.updated_at).getFullYear().toString() : '2025';

      if (index >= 0) {
        const existing = list[index];
        list[index] = {
          ...existing,
          showInPortfolio: existing.showInPortfolio !== undefined ? existing.showInPortfolio : true,
          includeInCv: existing.includeInCv === true,
          stats: `${stars} Stars • ${forks} Forks`,
          date: existing.date || year,
          linkUrl: repo.html_url,
          description:
            existing.description && !String(existing.description).startsWith('Open-source repository engineered')
              ? existing.description
              : repo.description || existing.description || 'Open-source repository engineered by Theology26 on GitHub.',
          badge: existing.badge || (stars > 0 ? `★ ${stars} STARS` : 'GITHUB REPOSITORY'),
        };
        updatedCount++;
      } else {
        list.push({
          id: `gh-${repo.id}`,
          type: 'project',
          title: String(repo.name).replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          category: `${repo.language || 'Software'} Application`,
          issuer: `GitHub Repository // @${username}`,
          tags: `${lang}, GitHub, ${stars > 0 ? `${stars} ★` : 'Open-Source'}`,
          description: repo.description || 'Open-source repository engineered by Theology26 on GitHub.',
          linkUrl: repo.html_url,
          imageUrl: '',
          badge: stars > 0 ? `★ ${stars} STARS` : 'GITHUB REPOSITORY',
          featured: stars >= 2,
          showInPortfolio: true,
          includeInCv: false,
          stats: `${stars} Stars • ${forks} Forks`,
          date: year,
        });
        addedCount++;
      }
    }

    return { list, addedCount, updatedCount };
  }

  /**
   * The CV project list is hand-curated in the admin panel and is never touched
   * by a sync. Kept as an explicit pass-through so the intent is documented at
   * the call site rather than implied by an absent line.
   */
  syncCvProjects(cv) {
    return cv;
  }

  /**
   * Full sync: fetch repos, refresh stats, merge projects.
   * @param {string} [username] Override stored username.
   * @param {string} [token]    Override stored token (authenticated callers only).
   */
  async sync(username, token) {
    const content = await this.repository.getAll();
    const gh = content.general || {};
    const user = username || gh.githubUsername || 'Theology26';
    const ghToken = token !== undefined && token !== null ? token : gh.githubToken || '';

    const { repos, headers } = await this.fetchRepos(user, ghToken);

    await this.repository.saveGithubRepos(repos);

    const langTotals = await this.aggregateLanguages(repos, headers);
    const githubStats = this.buildGithubStats(repos, langTotals);
    await this.repository.setSection('githubStats', githubStats);

    const { list, addedCount, updatedCount } = this.mergeProjects(content.projectsList, repos, user);
    await this.repository.setSection('projectsList', list);

    // The CV list is left exactly as the admin panel has it.
    await this.repository.setSection('cvData', this.syncCvProjects(content.cvData || {}));

    return { repos, projectsList: list, githubStats, addedCount, updatedCount, totalCount: repos.length, username: user };
  }
}

module.exports = GitHubSyncService;
