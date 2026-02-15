'use strict';

const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');
const matter = require('gray-matter');
const AdmZip = require('adm-zip');
const { createError } = require('./errors');
const mdProcessor = require('./md-processor');
const tagExtractor = require('./tag-extractor');
const FolderEngine = require('./folder-engine');

class ArchiveEngine {
  constructor(db, storagePath) {
    this.db = db;
    this.storagePath = storagePath;
    this.folderEngine = new FolderEngine(db, storagePath);
  }

  // ── Project Management ──

  async createProject(name, description = '', color = '#6366F1', icon = '📁') {
    if (!name || !name.trim()) throw createError('PROJECT_NAME_EMPTY');

    const existing = await this.db.get('SELECT id FROM projects WHERE name = ?', [name.trim()]);
    if (existing) throw createError('PROJECT_NAME_DUP');

    const id = uuidv4();
    await this.db.run(
      'INSERT INTO projects (id, name, description, color, icon) VALUES (?, ?, ?, ?, ?)',
      [id, name.trim(), description, color, icon]
    );

    return await this.db.get('SELECT * FROM projects WHERE id = ?', [id]);
  }

  async getProjects() {
    return await this.db.all('SELECT * FROM projects ORDER BY updated_at DESC');
  }

  async getProject(id) {
    const project = await this.db.get('SELECT * FROM projects WHERE id = ?', [id]);
    if (!project) throw createError('PROJECT_NOT_FOUND');
    return project;
  }

  async updateProject(id, { name, description, color, icon }) {
    const project = await this.getProject(id);

    if (name && name.trim() !== project.name) {
      const dup = await this.db.get('SELECT id FROM projects WHERE name = ? AND id != ?', [name.trim(), id]);
      if (dup) throw createError('PROJECT_NAME_DUP');
    }

    await this.db.run(
      `UPDATE projects SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        color = COALESCE(?, color),
        icon = COALESCE(?, icon),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [name || null, description !== undefined ? description : null, color || null, icon || null, id]
    );

    return await this.getProject(id);
  }

  async deleteProject(id) {
    await this.getProject(id);
    await this.db.run('DELETE FROM projects WHERE id = ?', [id]);

    // Delete storage folder
    const projDir = path.join(this.storagePath, 'originals', id);
    try { await fs.rm(projDir, { recursive: true, force: true }); } catch {}
  }

  // ── Document Management ──

  async archiveDocuments(projectId, files, folderId = null) {
    await this.getProject(projectId);

    const archived = [];
    let totalSize = 0;

    for (const file of files) {
      if (file.originalname.toLowerCase().endsWith('.zip')) {
        const zipResults = await this._processZip(projectId, file, folderId);
        archived.push(...zipResults);
        totalSize += zipResults.reduce((sum, r) => sum + (r.fileSize || 0), 0);
      } else if (file.originalname.toLowerCase().endsWith('.md')) {
        const result = await this._archiveSingleMD(projectId, file.originalname, file.buffer, folderId);
        archived.push(result);
        totalSize += result.fileSize || 0;
      }
    }

    await this._updateProjectDocCount(projectId);

    return { projectId, archived, totalFiles: archived.length, totalSize };
  }

  async _archiveSingleMD(projectId, filename, buffer, folderId = null) {
    const content = buffer.toString('utf-8');
    if (!content.trim()) throw createError('DOC_EMPTY_FILE');

    // Determine save directory
    let projDir;
    if (folderId) {
      projDir = await this.folderEngine.getFolderPhysicalPath(folderId, projectId);
    } else {
      projDir = path.join(this.storagePath, 'originals', projectId);
    }
    await fs.mkdir(projDir, { recursive: true });
    const originalPath = path.join(projDir, filename);
    await fs.writeFile(originalPath, buffer);

    // Analyze
    const analysis = this.analyzeFile(content, filename);
    const id = uuidv4();

    await this.db.run(
      `INSERT INTO documents (id, project_id, filename, title, content, file_size, line_count,
        heading_count, code_block_count, table_count, image_count, code_languages,
        heading_tree, has_frontmatter, original_path, folder_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, projectId, filename, analysis.title, content, buffer.length, analysis.lineCount,
       analysis.headingCount, analysis.codeBlockCount, analysis.tableCount, analysis.imageCount,
       JSON.stringify(analysis.codeLanguages), JSON.stringify(analysis.headingTree),
       analysis.hasFrontmatter ? 1 : 0, originalPath, folderId || null]
    );

    return {
      id, filename, title: analysis.title, fileSize: buffer.length,
      headingCount: analysis.headingCount, codeBlockCount: analysis.codeBlockCount,
      tableCount: analysis.tableCount, lineCount: analysis.lineCount
    };
  }

  async _processZip(projectId, file, folderId = null) {
    let zip;
    try {
      zip = new AdmZip(file.buffer);
    } catch {
      throw createError('UPLOAD_ZIP_CORRUPT');
    }

    const entries = zip.getEntries().filter(e =>
      !e.isDirectory && e.entryName.toLowerCase().endsWith('.md') && !e.entryName.startsWith('__MACOSX')
    );

    if (entries.length === 0) throw createError('UPLOAD_ZIP_NO_MD');

    const results = [];
    for (const entry of entries) {
      const buffer = entry.getData();
      const filename = path.basename(entry.entryName);
      const result = await this._archiveSingleMD(projectId, filename, buffer, folderId);
      results.push(result);
    }
    return results;
  }

  analyzeFile(content, filename) {
    const { data: frontmatterData, content: body } = matter(content);
    const headingTree = mdProcessor.buildHeadingTree(body);
    const elements = mdProcessor.countElements(body);
    const firstHeading = mdProcessor.extractFirstHeading(body);
    const parsedTitle = mdProcessor.parseFilename(filename);
    const codeLanguages = mdProcessor.extractCodeLanguages(body);

    return {
      title: firstHeading || parsedTitle,
      headingCount: headingTree.length,
      headingTree,
      codeBlockCount: elements.codeBlocks,
      codeLanguages,
      tableCount: elements.tables,
      imageCount: elements.images,
      lineCount: content.split('\n').length,
      hasFrontmatter: Object.keys(frontmatterData).length > 0
    };
  }

  // ── Document Queries ──

  async getDocuments(projectId, options = {}) {
    const { sortBy = 'filename', sortOrder = 'asc', tag, folderId, limit = 100, offset = 0 } = options;

    const validSorts = ['filename', 'title', 'created_at', 'file_size', 'heading_count'];
    const col = validSorts.includes(sortBy) ? sortBy : 'filename';
    const order = sortOrder === 'desc' ? 'DESC' : 'ASC';

    let sql, params;

    if (tag) {
      sql = `SELECT d.* FROM documents d
        JOIN document_tags dt ON d.id = dt.document_id
        JOIN tags t ON dt.tag_id = t.id
        WHERE d.project_id = ? AND t.name = ?
        ORDER BY d.${col} ${order} LIMIT ? OFFSET ?`;
      params = [projectId, tag, limit, offset];
    } else if (folderId !== undefined) {
      sql = `SELECT * FROM documents WHERE project_id = ? AND folder_id IS ?
        ORDER BY ${col} ${order} LIMIT ? OFFSET ?`;
      params = [projectId, folderId || null, limit, offset];
    } else {
      sql = `SELECT * FROM documents WHERE project_id = ?
        ORDER BY ${col} ${order} LIMIT ? OFFSET ?`;
      params = [projectId, limit, offset];
    }

    const documents = await this.db.all(sql, params);

    // Attach tags to each document
    for (const doc of documents) {
      doc.tags = await this.getDocumentTags(doc.id);
    }

    return documents;
  }

  async getDocument(id) {
    const doc = await this.db.get('SELECT * FROM documents WHERE id = ?', [id]);
    if (!doc) throw createError('DOC_NOT_FOUND');
    doc.tags = await this.getDocumentTags(id);
    return doc;
  }

  async getDocumentRaw(id) {
    const doc = await this.db.get('SELECT content, filename FROM documents WHERE id = ?', [id]);
    if (!doc) throw createError('DOC_NOT_FOUND');
    return doc;
  }

  async updateDocument(id, { title, content }) {
    const doc = await this.getDocument(id);
    if (title !== undefined) {
      await this.db.run(
        'UPDATE documents SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [title, id]
      );
    }
    if (content !== undefined) {
      await this.updateDocumentContent(id, content);
    }
    return await this.getDocument(id);
  }

  async createDocument(projectId, filename, folderId = null, content = '') {
    if (!filename || !filename.trim()) throw createError('DOC_FILENAME_INVALID');
    filename = filename.trim();
    if (!filename.toLowerCase().endsWith('.md')) filename += '.md';

    await this.getProject(projectId);

    // Duplicate filename check in same folder
    const dup = await this.db.get(
      'SELECT id FROM documents WHERE project_id = ? AND folder_id IS ? AND filename = ?',
      [projectId, folderId || null, filename]
    );
    if (dup) throw createError('DOC_FILENAME_DUP');

    const buffer = Buffer.from(content || `# ${filename.replace(/\.md$/i, '')}\n`, 'utf-8');
    const result = await this._archiveSingleMD(projectId, filename, buffer, folderId);
    await this._updateProjectDocCount(projectId);
    return result;
  }

  async updateDocumentContent(id, content) {
    const doc = await this.db.get('SELECT * FROM documents WHERE id = ?', [id]);
    if (!doc) throw createError('DOC_NOT_FOUND');

    const analysis = this.analyzeFile(content, doc.filename);
    const buffer = Buffer.from(content, 'utf-8');

    await this.db.run(
      `UPDATE documents SET content = ?, file_size = ?, title = ?, line_count = ?,
        heading_count = ?, code_block_count = ?, table_count = ?, image_count = ?,
        code_languages = ?, heading_tree = ?, has_frontmatter = ?,
        updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [content, buffer.length, analysis.title, analysis.lineCount,
       analysis.headingCount, analysis.codeBlockCount, analysis.tableCount, analysis.imageCount,
       JSON.stringify(analysis.codeLanguages), JSON.stringify(analysis.headingTree),
       analysis.hasFrontmatter ? 1 : 0, id]
    );

    // Update physical file
    if (doc.original_path) {
      try {
        await fs.mkdir(path.dirname(doc.original_path), { recursive: true });
        await fs.writeFile(doc.original_path, buffer);
      } catch {}
    }

    return await this.getDocument(id);
  }

  async renameDocument(id, newFilename) {
    if (!newFilename || !newFilename.trim()) throw createError('DOC_FILENAME_INVALID');
    newFilename = newFilename.trim();
    if (!newFilename.toLowerCase().endsWith('.md')) newFilename += '.md';

    const doc = await this.getDocument(id);

    // Duplicate check in same folder
    const dup = await this.db.get(
      'SELECT id FROM documents WHERE project_id = ? AND folder_id IS ? AND filename = ? AND id != ?',
      [doc.project_id, doc.folder_id || null, newFilename, id]
    );
    if (dup) throw createError('DOC_FILENAME_DUP');

    const oldPath = doc.original_path;
    const newPath = oldPath ? path.join(path.dirname(oldPath), newFilename) : null;

    await this.db.run(
      'UPDATE documents SET filename = ?, original_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newFilename, newPath, id]
    );

    if (oldPath && newPath) {
      try { await fs.rename(oldPath, newPath); } catch {}
    }

    return await this.getDocument(id);
  }

  async moveDocument(id, folderId, projectId) {
    const doc = await this.getDocument(id);
    const targetProjectId = projectId || doc.project_id;

    // Determine target directory
    let targetDir;
    if (folderId) {
      await this.folderEngine.getFolder(folderId);
      targetDir = await this.folderEngine.getFolderPhysicalPath(folderId, targetProjectId);
    } else {
      targetDir = path.join(this.storagePath, 'originals', targetProjectId);
    }

    // Duplicate check at target
    const dup = await this.db.get(
      'SELECT id FROM documents WHERE project_id = ? AND folder_id IS ? AND filename = ? AND id != ?',
      [targetProjectId, folderId || null, doc.filename, id]
    );
    if (dup) throw createError('DOC_FILENAME_DUP');

    const oldPath = doc.original_path;
    const newPath = path.join(targetDir, doc.filename);

    await this.db.run(
      'UPDATE documents SET folder_id = ?, project_id = ?, original_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [folderId || null, targetProjectId, newPath, id]
    );

    if (oldPath) {
      try {
        await fs.mkdir(targetDir, { recursive: true });
        await fs.rename(oldPath, newPath);
      } catch {}
    }

    // Update doc counts
    await this._updateProjectDocCount(doc.project_id);
    if (targetProjectId !== doc.project_id) {
      await this._updateProjectDocCount(targetProjectId);
    }

    return await this.getDocument(id);
  }

  async copyDocument(id, folderId = null, projectId = null) {
    const doc = await this.getDocument(id);
    const targetProjectId = projectId || doc.project_id;

    // Generate unique filename
    let newFilename = doc.filename;
    const baseName = newFilename.replace(/\.md$/i, '');
    let counter = 1;
    while (true) {
      const dup = await this.db.get(
        'SELECT id FROM documents WHERE project_id = ? AND folder_id IS ? AND filename = ?',
        [targetProjectId, folderId || null, newFilename]
      );
      if (!dup) break;
      newFilename = `${baseName} (${counter}).md`;
      counter++;
    }

    const buffer = Buffer.from(doc.content, 'utf-8');
    const result = await this._archiveSingleMD(targetProjectId, newFilename, buffer, folderId);

    // Copy tags
    const tags = await this.getDocumentTags(id);
    for (const tag of tags) {
      await this.addTagToDocument(result.id, tag.id);
    }

    await this._updateProjectDocCount(targetProjectId);
    return result;
  }

  async _updateProjectDocCount(projectId) {
    const count = await this.db.get(
      'SELECT COUNT(*) as cnt FROM documents WHERE project_id = ?', [projectId]
    );
    await this.db.run(
      'UPDATE projects SET doc_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [count.cnt, projectId]
    );
  }

  async deleteDocument(id) {
    const doc = await this.getDocument(id);

    await this.db.run('DELETE FROM documents WHERE id = ?', [id]);

    // Delete original file
    if (doc.original_path) {
      try { await fs.unlink(doc.original_path); } catch {}
    }

    await this._updateProjectDocCount(doc.project_id);
  }

  // ── Tag Management ──

  async getTags() {
    return await this.db.all('SELECT * FROM tags ORDER BY usage_count DESC, name ASC');
  }

  async createTag(name, color = '#6B7280') {
    if (!name || !name.trim()) throw createError('PROJECT_NAME_EMPTY');

    const existing = await this.db.get('SELECT * FROM tags WHERE name = ?', [name.trim()]);
    if (existing) return existing;

    await this.db.run('INSERT INTO tags (name, color) VALUES (?, ?)', [name.trim(), color]);
    return await this.db.get('SELECT * FROM tags WHERE name = ?', [name.trim()]);
  }

  async addTagToDocument(docId, tagId) {
    await this.getDocument(docId);
    try {
      await this.db.run('INSERT INTO document_tags (document_id, tag_id) VALUES (?, ?)', [docId, tagId]);
      await this.db.run('UPDATE tags SET usage_count = usage_count + 1 WHERE id = ?', [tagId]);
    } catch (e) {
      if (e.message && e.message.includes('UNIQUE')) return; // already linked
      throw e;
    }
  }

  async removeTagFromDocument(docId, tagId) {
    const result = await this.db.run('DELETE FROM document_tags WHERE document_id = ? AND tag_id = ?', [docId, tagId]);
    if (result.changes > 0) {
      await this.db.run('UPDATE tags SET usage_count = MAX(0, usage_count - 1) WHERE id = ?', [tagId]);
    }
  }

  async getDocumentTags(docId) {
    return await this.db.all(
      `SELECT t.id, t.name, t.color FROM tags t
       JOIN document_tags dt ON t.id = dt.tag_id
       WHERE dt.document_id = ?
       ORDER BY t.name`,
      [docId]
    );
  }

  // ── Document Split & Auto-Tag ──

  async getHeadingStats(docId) {
    const doc = await this.getDocument(docId);
    let headingTree;
    try {
      headingTree = JSON.parse(doc.heading_tree || '[]');
    } catch {
      headingTree = [];
    }

    const stats = {};
    for (let level = 1; level <= 6; level++) {
      const count = headingTree.filter(h => h.level === level).length;
      if (count > 0) stats[level] = count;
    }
    return { docId, title: doc.title, stats };
  }

  async splitDocument(docId, level, keepOriginal = true) {
    const doc = await this.getDocument(docId);
    const chunks = mdProcessor.splitByHeading(doc.content, level);

    if (chunks.length === 0) throw createError('DOC_SPLIT_NO_HEADINGS');
    if (chunks.length < 2) throw createError('DOC_SPLIT_TOO_FEW');

    const originalTags = await this.getDocumentTags(docId);
    const created = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      // Build content with the heading restored
      const mdContent = chunk.title === '서문'
        ? chunk.content
        : `${'#'.repeat(level)} ${chunk.title}\n\n${chunk.content}`;

      // Generate filename
      const baseName = doc.filename.replace(/\.md$/i, '');
      const safeTitle = chunk.title.replace(/[<>:"/\\|?*]/g, '_').slice(0, 50).trim();
      let filename = `${baseName}_${String(i + 1).padStart(2, '0')}_${safeTitle}.md`;

      // Ensure unique filename
      let counter = 1;
      while (true) {
        const dup = await this.db.get(
          'SELECT id FROM documents WHERE project_id = ? AND folder_id IS ? AND filename = ?',
          [doc.project_id, doc.folder_id || null, filename]
        );
        if (!dup) break;
        filename = `${baseName}_${String(i + 1).padStart(2, '0')}_${safeTitle} (${counter}).md`;
        counter++;
      }

      const buffer = Buffer.from(mdContent, 'utf-8');
      const result = await this._archiveSingleMD(doc.project_id, filename, buffer, doc.folder_id || null);

      // Copy original tags
      for (const tag of originalTags) {
        await this.addTagToDocument(result.id, tag.id);
      }

      created.push(result);
    }

    if (!keepOriginal) {
      await this.deleteDocument(docId);
    }

    await this._updateProjectDocCount(doc.project_id);

    return { originalId: docId, kept: keepOriginal, created };
  }

  async suggestTags(docId) {
    const doc = await this.getDocument(docId);
    const suggestions = tagExtractor.extractTags(doc.content, doc.filename);
    const existingTags = await this.getDocumentTags(docId);
    const existingNames = new Set(existingTags.map(t => t.name.toLowerCase()));

    return suggestions.map(s => ({
      ...s,
      alreadyApplied: existingNames.has(s.name.toLowerCase())
    }));
  }

  async applyTags(docId, tags) {
    await this.getDocument(docId);
    const applied = [];

    for (const { name, color } of tags) {
      const tag = await this.createTag(name, color || '#6B7280');
      await this.addTagToDocument(docId, tag.id);
      applied.push(tag);
    }

    // Update ai_keywords column
    const allTags = await this.getDocumentTags(docId);
    const keywords = allTags.map(t => t.name).join(', ');
    await this.db.run(
      'UPDATE documents SET ai_keywords = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [keywords, docId]
    );

    return { docId, applied, totalTags: allTags.length };
  }

  // ── Stats ──

  async getStats() {
    const totalProjects = (await this.db.get('SELECT COUNT(*) as cnt FROM projects')).cnt;
    const totalDocuments = (await this.db.get('SELECT COUNT(*) as cnt FROM documents')).cnt;
    const totalTags = (await this.db.get('SELECT COUNT(*) as cnt FROM tags')).cnt;
    const totalSearches = (await this.db.get('SELECT COUNT(*) as cnt FROM search_history')).cnt;

    const recentProjects = await this.db.all(
      'SELECT id, name, doc_count, updated_at FROM projects ORDER BY updated_at DESC LIMIT 5'
    );
    const topTags = await this.db.all(
      'SELECT id, name, color, usage_count FROM tags ORDER BY usage_count DESC LIMIT 10'
    );

    return { totalProjects, totalDocuments, totalTags, totalSearches, recentProjects, topTags };
  }
}

module.exports = ArchiveEngine;
