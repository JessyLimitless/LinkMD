'use strict';

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class DB {
  constructor(dbPath) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    this.db = new sqlite3.Database(dbPath);
    this.db.run('PRAGMA journal_mode = WAL');
    this.db.run('PRAGMA foreign_keys = ON');
  }

  async init() {
    await this._run(`CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#6366F1',
      icon TEXT DEFAULT '📁',
      doc_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await this._run(`CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      file_size INTEGER,
      line_count INTEGER,
      heading_count INTEGER,
      code_block_count INTEGER,
      table_count INTEGER,
      image_count INTEGER,
      code_languages TEXT,
      heading_tree TEXT,
      has_frontmatter INTEGER DEFAULT 0,
      ai_summary TEXT,
      ai_keywords TEXT,
      original_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )`);

    // FTS5 virtual table
    await this._run(`CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
      title,
      content,
      content=documents,
      content_rowid=rowid,
      tokenize='unicode61'
    )`);

    // FTS5 sync triggers
    await this._run(`CREATE TRIGGER IF NOT EXISTS documents_fts_insert AFTER INSERT ON documents BEGIN
      INSERT INTO documents_fts(rowid, title, content)
      VALUES (new.rowid, new.title, new.content);
    END`);

    await this._run(`CREATE TRIGGER IF NOT EXISTS documents_fts_delete AFTER DELETE ON documents BEGIN
      INSERT INTO documents_fts(documents_fts, rowid, title, content)
      VALUES('delete', old.rowid, old.title, old.content);
    END`);

    await this._run(`CREATE TRIGGER IF NOT EXISTS documents_fts_update AFTER UPDATE OF title, content ON documents BEGIN
      INSERT INTO documents_fts(documents_fts, rowid, title, content)
      VALUES('delete', old.rowid, old.title, old.content);
      INSERT INTO documents_fts(rowid, title, content)
      VALUES (new.rowid, new.title, new.content);
    END`);

    await this._run(`CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      color TEXT DEFAULT '#6B7280',
      usage_count INTEGER DEFAULT 0
    )`);

    await this._run(`CREATE TABLE IF NOT EXISTS document_tags (
      document_id TEXT,
      tag_id INTEGER,
      PRIMARY KEY (document_id, tag_id),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )`);

    await this._run(`CREATE TABLE IF NOT EXISTS shared_links (
      id TEXT PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      expires_at DATETIME,
      view_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await this._run(`CREATE TABLE IF NOT EXISTS search_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query TEXT NOT NULL,
      result_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Indexes
    await this._run('CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id)');
    await this._run('CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at)');
    await this._run('CREATE INDEX IF NOT EXISTS idx_document_tags_doc ON document_tags(document_id)');
    await this._run('CREATE INDEX IF NOT EXISTS idx_document_tags_tag ON document_tags(tag_id)');
    await this._run('CREATE INDEX IF NOT EXISTS idx_shared_links_token ON shared_links(token)');
    await this._run('CREATE INDEX IF NOT EXISTS idx_shared_links_target ON shared_links(target_type, target_id)');

    // Folders table
    await this._run(`CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      parent_id TEXT,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
    )`);
    await this._run('CREATE INDEX IF NOT EXISTS idx_folders_project ON folders(project_id)');
    await this._run('CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id)');

    // Add folder_id column to documents if not exists
    const cols = await this._all("PRAGMA table_info(documents)");
    if (!cols.find(c => c.name === 'folder_id')) {
      await this._run('ALTER TABLE documents ADD COLUMN folder_id TEXT DEFAULT NULL');
    }
    await this._run('CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents(folder_id)');

    return this;
  }

  // Promise wrappers
  _run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  _get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  _all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  run(sql, params) { return this._run(sql, params); }
  get(sql, params) { return this._get(sql, params); }
  all(sql, params) { return this._all(sql, params); }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

module.exports = DB;
