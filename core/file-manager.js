'use strict';

const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const STORAGE_DIR = path.join(__dirname, '..', 'storage');

async function ensureStorageDirs() {
  const dirs = [
    path.join(STORAGE_DIR, 'uploads'),
    path.join(STORAGE_DIR, 'workspace'),
    path.join(STORAGE_DIR, 'output')
  ];
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
}

async function createSession() {
  const sessionId = uuidv4();
  const uploadDir = path.join(STORAGE_DIR, 'uploads', sessionId);
  const workspaceDir = path.join(STORAGE_DIR, 'workspace', sessionId);
  const outputDir = path.join(STORAGE_DIR, 'output', sessionId);

  await fs.mkdir(uploadDir, { recursive: true });
  await fs.mkdir(workspaceDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });

  return { sessionId, uploadDir, workspaceDir, outputDir };
}

async function deleteSession(sessionId) {
  const dirs = [
    path.join(STORAGE_DIR, 'uploads', sessionId),
    path.join(STORAGE_DIR, 'workspace', sessionId),
    path.join(STORAGE_DIR, 'output', sessionId)
  ];
  for (const dir of dirs) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch { /* ignore */ }
  }
}

async function cleanupExpired() {
  const maxAge = (parseInt(process.env.CLEANUP_INTERVAL_MINUTES) || 30) * 60 * 1000;
  const now = Date.now();
  let cleaned = 0;

  for (const subdir of ['uploads', 'workspace', 'output']) {
    const baseDir = path.join(STORAGE_DIR, subdir);
    try {
      const entries = await fs.readdir(baseDir);
      for (const entry of entries) {
        if (entry === '.gitkeep') continue;
        const entryPath = path.join(baseDir, entry);
        try {
          const stat = await fs.stat(entryPath);
          if (now - stat.mtimeMs > maxAge) {
            await fs.rm(entryPath, { recursive: true, force: true });
            cleaned++;
          }
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }
  return cleaned;
}

function getSessionPaths(sessionId) {
  return {
    uploadDir: path.join(STORAGE_DIR, 'uploads', sessionId),
    workspaceDir: path.join(STORAGE_DIR, 'workspace', sessionId),
    outputDir: path.join(STORAGE_DIR, 'output', sessionId)
  };
}

async function getOutputFile(sessionId) {
  const outputDir = path.join(STORAGE_DIR, 'output', sessionId);
  try {
    const files = await fs.readdir(outputDir);
    const resultFile = files.find(f => !f.startsWith('.'));
    if (resultFile) {
      return {
        path: path.join(outputDir, resultFile),
        filename: resultFile
      };
    }
  } catch { /* ignore */ }
  return null;
}

function sessionExists(sessionId) {
  return fsSync.existsSync(path.join(STORAGE_DIR, 'uploads', sessionId));
}

async function getUploadedFiles(sessionId) {
  const uploadDir = path.join(STORAGE_DIR, 'uploads', sessionId);
  try {
    const files = await fs.readdir(uploadDir);
    return files
      .filter(f => f.endsWith('.md'))
      .map(f => ({
        filename: f,
        path: path.join(uploadDir, f)
      }));
  } catch {
    return [];
  }
}

module.exports = {
  ensureStorageDirs,
  createSession,
  deleteSession,
  cleanupExpired,
  getSessionPaths,
  getOutputFile,
  sessionExists,
  getUploadedFiles,
  STORAGE_DIR
};
