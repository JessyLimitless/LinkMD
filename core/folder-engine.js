'use strict';

const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs/promises');
const { createError } = require('./errors');

const MAX_DEPTH = 10;

class FolderEngine {
  constructor(db, storagePath) {
    this.db = db;
    this.storagePath = storagePath;
  }

  async createFolder(projectId, name, parentId = null) {
    if (!name || !name.trim()) throw createError('FOLDER_NAME_EMPTY');
    name = name.trim();

    // Check parent exists
    if (parentId) {
      const parent = await this.db.get('SELECT id FROM folders WHERE id = ?', [parentId]);
      if (!parent) throw createError('FOLDER_NOT_FOUND');
      const depth = await this.calculateDepth(parentId);
      if (depth + 1 >= MAX_DEPTH) throw createError('FOLDER_DEPTH_LIMIT');
    }

    // Duplicate name check (same parent)
    const dup = await this.db.get(
      'SELECT id FROM folders WHERE project_id = ? AND parent_id IS ? AND name = ?',
      [projectId, parentId || null, name]
    );
    if (dup) throw createError('FOLDER_NAME_DUP');

    const id = uuidv4();
    const maxOrder = await this.db.get(
      'SELECT COALESCE(MAX(sort_order), 0) as max_order FROM folders WHERE project_id = ? AND parent_id IS ?',
      [projectId, parentId || null]
    );
    await this.db.run(
      'INSERT INTO folders (id, project_id, parent_id, name, sort_order) VALUES (?, ?, ?, ?, ?)',
      [id, projectId, parentId || null, name, (maxOrder?.max_order || 0) + 1]
    );

    // Create physical directory
    const folderPath = await this.getFolderPhysicalPath(id, projectId);
    await fs.mkdir(folderPath, { recursive: true });

    return await this.getFolder(id);
  }

  async getFolder(id) {
    const folder = await this.db.get('SELECT * FROM folders WHERE id = ?', [id]);
    if (!folder) throw createError('FOLDER_NOT_FOUND');
    return folder;
  }

  async getFolders(projectId) {
    return await this.db.all(
      'SELECT * FROM folders WHERE project_id = ? ORDER BY sort_order, name',
      [projectId]
    );
  }

  async getProjectTree(projectId) {
    const folders = await this.db.all(
      'SELECT * FROM folders WHERE project_id = ? ORDER BY sort_order, name',
      [projectId]
    );
    const docs = await this.db.all(
      'SELECT id, filename, title, folder_id, file_size, heading_count, code_block_count, created_at FROM documents WHERE project_id = ? ORDER BY filename',
      [projectId]
    );

    // Build nested tree
    const folderMap = new Map();
    folders.forEach(f => folderMap.set(f.id, { ...f, type: 'folder', children: [] }));

    const roots = [];

    // Place folders under parents
    for (const f of folders) {
      const node = folderMap.get(f.id);
      if (f.parent_id && folderMap.has(f.parent_id)) {
        folderMap.get(f.parent_id).children.push(node);
      } else {
        roots.push(node);
      }
    }

    // Place docs under folders or root
    const rootDocs = [];
    for (const d of docs) {
      const fileNode = { ...d, type: 'file' };
      if (d.folder_id && folderMap.has(d.folder_id)) {
        folderMap.get(d.folder_id).children.push(fileNode);
      } else {
        rootDocs.push(fileNode);
      }
    }

    // Sort children: folders first (by name), then files (by filename) — Korean aware
    const sortChildren = (items) => {
      items.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        const nameA = a.type === 'folder' ? a.name : a.filename;
        const nameB = b.type === 'folder' ? b.name : b.filename;
        return nameA.localeCompare(nameB, 'ko');
      });
      items.forEach(item => {
        if (item.children) sortChildren(item.children);
      });
    };

    const tree = [...roots, ...rootDocs];
    sortChildren(tree);
    return tree;
  }

  async getFolderPhysicalPath(folderId, projectId) {
    const chain = await this._getAncestorChain(folderId);
    const parts = chain.map(f => f.name);
    return path.join(this.storagePath, 'originals', projectId, ...parts);
  }

  async _getAncestorChain(folderId) {
    const chain = [];
    let current = folderId;
    while (current) {
      const folder = await this.db.get('SELECT id, name, parent_id FROM folders WHERE id = ?', [current]);
      if (!folder) break;
      chain.unshift(folder);
      current = folder.parent_id;
    }
    return chain;
  }

  async renameFolder(id, newName) {
    if (!newName || !newName.trim()) throw createError('FOLDER_NAME_EMPTY');
    newName = newName.trim();

    const folder = await this.getFolder(id);

    // Duplicate check
    const dup = await this.db.get(
      'SELECT id FROM folders WHERE project_id = ? AND parent_id IS ? AND name = ? AND id != ?',
      [folder.project_id, folder.parent_id || null, newName, id]
    );
    if (dup) throw createError('FOLDER_NAME_DUP');

    // Rename physical directory
    const oldPath = await this.getFolderPhysicalPath(id, folder.project_id);
    await this.db.run(
      'UPDATE folders SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newName, id]
    );
    const newPath = await this.getFolderPhysicalPath(id, folder.project_id);

    try {
      const oldExists = await fs.stat(oldPath).then(() => true).catch(() => false);
      if (oldExists) await fs.rename(oldPath, newPath);
    } catch {}

    // Update original_path for docs in this folder tree
    await this._updateDocPaths(id, folder.project_id);

    return await this.getFolder(id);
  }

  async moveFolder(id, newParentId) {
    const folder = await this.getFolder(id);

    if (newParentId) {
      const parent = await this.db.get('SELECT id FROM folders WHERE id = ?', [newParentId]);
      if (!parent) throw createError('FOLDER_NOT_FOUND');

      // Circular reference check
      if (await this.isDescendant(newParentId, id)) {
        throw createError('FOLDER_CIRCULAR');
      }

      const depth = await this.calculateDepth(newParentId);
      const subtreeDepth = await this._getMaxSubtreeDepth(id);
      if (depth + 1 + subtreeDepth >= MAX_DEPTH) throw createError('FOLDER_DEPTH_LIMIT');
    }

    // Duplicate name check at target
    const dup = await this.db.get(
      'SELECT id FROM folders WHERE project_id = ? AND parent_id IS ? AND name = ? AND id != ?',
      [folder.project_id, newParentId || null, folder.name, id]
    );
    if (dup) throw createError('FOLDER_NAME_DUP');

    const oldPath = await this.getFolderPhysicalPath(id, folder.project_id);

    await this.db.run(
      'UPDATE folders SET parent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newParentId || null, id]
    );

    const newPath = await this.getFolderPhysicalPath(id, folder.project_id);
    try {
      const oldExists = await fs.stat(oldPath).then(() => true).catch(() => false);
      if (oldExists) {
        await fs.mkdir(path.dirname(newPath), { recursive: true });
        await fs.rename(oldPath, newPath);
      }
    } catch {}

    await this._updateDocPaths(id, folder.project_id);
    return await this.getFolder(id);
  }

  async deleteFolder(id) {
    const folder = await this.getFolder(id);

    // Get all descendant folder ids
    const descendants = await this._getAllDescendantIds(id);
    const allFolderIds = [id, ...descendants];

    // Delete documents in all these folders
    for (const fid of allFolderIds) {
      const docs = await this.db.all('SELECT id, original_path FROM documents WHERE folder_id = ?', [fid]);
      for (const doc of docs) {
        if (doc.original_path) {
          try { await fs.unlink(doc.original_path); } catch {}
        }
        await this.db.run('DELETE FROM documents WHERE id = ?', [doc.id]);
      }
    }

    // Delete physical folder
    const folderPath = await this.getFolderPhysicalPath(id, folder.project_id);
    try { await fs.rm(folderPath, { recursive: true, force: true }); } catch {}

    // Delete folders from DB (cascade should handle children, but be explicit)
    for (const fid of [...descendants.reverse(), id]) {
      await this.db.run('DELETE FROM folders WHERE id = ?', [fid]);
    }

    // Update project doc_count
    const count = await this.db.get(
      'SELECT COUNT(*) as cnt FROM documents WHERE project_id = ?', [folder.project_id]
    );
    await this.db.run(
      'UPDATE projects SET doc_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [count.cnt, folder.project_id]
    );
  }

  async calculateDepth(folderId) {
    let depth = 0;
    let current = folderId;
    while (current) {
      const folder = await this.db.get('SELECT parent_id FROM folders WHERE id = ?', [current]);
      if (!folder) break;
      depth++;
      current = folder.parent_id;
    }
    return depth;
  }

  async isDescendant(folderId, targetId) {
    // Check if folderId is a descendant of targetId
    let current = folderId;
    while (current) {
      if (current === targetId) return true;
      const folder = await this.db.get('SELECT parent_id FROM folders WHERE id = ?', [current]);
      if (!folder) break;
      current = folder.parent_id;
    }
    return false;
  }

  async _getMaxSubtreeDepth(folderId) {
    const children = await this.db.all('SELECT id FROM folders WHERE parent_id = ?', [folderId]);
    if (children.length === 0) return 0;
    let max = 0;
    for (const child of children) {
      const d = await this._getMaxSubtreeDepth(child.id);
      if (d + 1 > max) max = d + 1;
    }
    return max;
  }

  async _getAllDescendantIds(folderId) {
    const children = await this.db.all('SELECT id FROM folders WHERE parent_id = ?', [folderId]);
    const ids = [];
    for (const child of children) {
      ids.push(child.id);
      ids.push(...await this._getAllDescendantIds(child.id));
    }
    return ids;
  }

  async _updateDocPaths(folderId, projectId) {
    const folderPath = await this.getFolderPhysicalPath(folderId, projectId);
    const docs = await this.db.all('SELECT id, filename FROM documents WHERE folder_id = ?', [folderId]);
    for (const doc of docs) {
      const newOrigPath = path.join(folderPath, doc.filename);
      await this.db.run('UPDATE documents SET original_path = ? WHERE id = ?', [newOrigPath, doc.id]);
    }
    // Recurse into child folders
    const children = await this.db.all('SELECT id FROM folders WHERE parent_id = ?', [folderId]);
    for (const child of children) {
      await this._updateDocPaths(child.id, projectId);
    }
  }
}

module.exports = FolderEngine;
