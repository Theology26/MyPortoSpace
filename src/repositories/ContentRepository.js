'use strict';

const db = require('../../db');

/**
 * ContentRepository — the only module that talks to the persistence layer.
 * Routes and services depend on this interface, never on db.js directly.
 */
class ContentRepository {
  init() {
    return db.initDb();
  }

  getAll() {
    return db.getAllContent();
  }

  getSection(section) {
    return db.getAllContent().then((content) => content[section]);
  }

  setSection(section, data) {
    return db.updateSection(section, data);
  }

  updateAll(payload) {
    return db.updateAllContent(payload);
  }

  /** Delete a stored section entirely. */
  removeSection(section) {
    return db.deleteSection(section);
  }

  saveGithubRepos(repos) {
    return db.saveGithubRepos(repos);
  }

  getGithubRepos() {
    return db.getGithubRepos();
  }
}

module.exports = ContentRepository;
