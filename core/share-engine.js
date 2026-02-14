'use strict';

const { v4: uuidv4 } = require('uuid');
const { createError } = require('./errors');

const DURATION_MAP = {
  '1h':  60 * 60 * 1000,
  '1d':  24 * 60 * 60 * 1000,
  '7d':  7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

class ShareEngine {
  constructor(db, baseUrl) {
    this.db = db;
    this.baseUrl = baseUrl || 'http://localhost:3500';
  }

  async createShareLink(targetType, targetId, expiresIn = null) {
    const id = uuidv4();
    const token = uuidv4().replace(/-/g, '').substring(0, 12);

    let expiresAt = null;
    if (expiresIn && DURATION_MAP[expiresIn]) {
      expiresAt = new Date(Date.now() + DURATION_MAP[expiresIn]).toISOString();
    }

    await this.db.run(
      'INSERT INTO shared_links (id, token, target_type, target_id, expires_at) VALUES (?, ?, ?, ?, ?)',
      [id, token, targetType, targetId, expiresAt]
    );

    return {
      id,
      token,
      shareUrl: `${this.baseUrl}/s/${token}`,
      expiresAt
    };
  }

  async getSharedContent(token) {
    const link = await this.db.get('SELECT * FROM shared_links WHERE token = ?', [token]);
    if (!link) throw createError('SHARE_NOT_FOUND');

    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      throw createError('SHARE_EXPIRED');
    }

    // Increment view count
    await this.db.run('UPDATE shared_links SET view_count = view_count + 1 WHERE id = ?', [link.id]);

    if (link.target_type === 'document') {
      const doc = await this.db.get('SELECT * FROM documents WHERE id = ?', [link.target_id]);
      if (!doc) throw createError('DOC_NOT_FOUND');
      const project = await this.db.get('SELECT name FROM projects WHERE id = ?', [doc.project_id]);
      const tags = await this.db.all(
        `SELECT t.name, t.color FROM tags t
         JOIN document_tags dt ON t.id = dt.tag_id
         WHERE dt.document_id = ?`, [doc.id]
      );
      return {
        type: 'document',
        data: { ...doc, projectName: project ? project.name : '', tags }
      };
    }

    if (link.target_type === 'project') {
      const project = await this.db.get('SELECT * FROM projects WHERE id = ?', [link.target_id]);
      if (!project) throw createError('PROJECT_NOT_FOUND');
      const documents = await this.db.all(
        'SELECT id, filename, title, file_size, heading_count, code_block_count, created_at FROM documents WHERE project_id = ? ORDER BY filename',
        [link.target_id]
      );
      return {
        type: 'project',
        data: { ...project, documents }
      };
    }

    throw createError('SHARE_NOT_FOUND');
  }

  async deleteShareLink(id) {
    await this.db.run('DELETE FROM shared_links WHERE id = ?', [id]);
  }

  async getShareLinks(targetType, targetId) {
    return await this.db.all(
      'SELECT * FROM shared_links WHERE target_type = ? AND target_id = ? ORDER BY created_at DESC',
      [targetType, targetId]
    );
  }
}

module.exports = ShareEngine;
