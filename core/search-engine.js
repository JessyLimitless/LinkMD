'use strict';

const { createError } = require('./errors');

class SearchEngine {
  constructor(db) {
    this.db = db;
  }

  async search(query, options = {}) {
    const { projectId, tagId, dateFrom, dateTo, limit = 20 } = options;

    if (!query || !query.trim()) throw createError('SEARCH_EMPTY_QUERY');
    if (query.length > 200) throw createError('SEARCH_QUERY_TOO_LONG');

    const startTime = Date.now();
    const ftsQuery = this.buildFTSQuery(query);

    let sql = `
      SELECT d.id, d.title, d.filename, d.project_id, d.created_at, d.file_size,
             d.heading_count, d.code_block_count,
             snippet(documents_fts, 1, '<mark>', '</mark>', '...', 30) as snippet,
             bm25(documents_fts) as rank
      FROM documents_fts
      JOIN documents d ON d.rowid = documents_fts.rowid
      WHERE documents_fts MATCH ?
    `;
    const params = [ftsQuery];

    if (projectId) {
      sql += ' AND d.project_id = ?';
      params.push(projectId);
    }
    if (dateFrom) {
      sql += ' AND d.created_at >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      sql += ' AND d.created_at <= ?';
      params.push(dateTo);
    }

    sql += ' ORDER BY rank LIMIT ?';
    params.push(limit);

    let results = await this.db.all(sql, params);

    // Tag filter (post-filter since FTS JOIN is complex)
    if (tagId) {
      const taggedDocIds = await this.db.all(
        'SELECT document_id FROM document_tags WHERE tag_id = ?', [tagId]
      );
      const idSet = new Set(taggedDocIds.map(r => r.document_id));
      results = results.filter(r => idSet.has(r.id));
    }

    // Attach project name + tags
    for (const r of results) {
      const proj = await this.db.get('SELECT name FROM projects WHERE id = ?', [r.project_id]);
      r.projectName = proj ? proj.name : '';
      r.tags = await this.db.all(
        `SELECT t.id, t.name, t.color FROM tags t
         JOIN document_tags dt ON t.id = dt.tag_id
         WHERE dt.document_id = ?`, [r.id]
      );
    }

    const searchTime = `${Date.now() - startTime}ms`;

    // Save search history
    await this.db.run(
      'INSERT INTO search_history (query, result_count) VALUES (?, ?)',
      [query.trim(), results.length]
    );

    return {
      query: query.trim(),
      results,
      totalResults: results.length,
      searchTime
    };
  }

  buildFTSQuery(input) {
    const trimmed = input.trim();
    if (!trimmed) return '';

    // Check for explicit phrase search (quoted)
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed;
    }

    // Check for OR operator
    if (/\bOR\b/.test(trimmed)) {
      return trimmed.split(/\bOR\b/)
        .map(part => this._escapeToken(part.trim()))
        .filter(Boolean)
        .join(' OR ');
    }

    // Default: wrap each word in quotes for safety (implicit AND)
    const words = trimmed.split(/\s+/).filter(Boolean);
    return words.map(w => this._escapeToken(w)).join(' ');
  }

  _escapeToken(token) {
    if (!token) return '';
    // Remove FTS5 special characters
    const cleaned = token.replace(/[*:^()"\.]/g, '');
    if (!cleaned) return '';
    return `"${cleaned}"`;
  }

  async getSearchHistory(limit = 10) {
    return await this.db.all(
      `SELECT query, MAX(created_at) as last_searched, SUM(result_count) as total_results
       FROM search_history
       GROUP BY query
       ORDER BY last_searched DESC
       LIMIT ?`,
      [limit]
    );
  }
}

module.exports = SearchEngine;
