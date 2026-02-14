'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');

const DB = require('./core/database');
const ArchiveEngine = require('./core/archive-engine');
const SearchEngine = require('./core/search-engine');
const ShareEngine = require('./core/share-engine');
const ExportEngine = require('./core/export-engine');
const pandocEngine = require('./core/pandoc-engine');
const errorHandler = require('./middleware/error-handler');

const app = express();
const PORT = process.env.PORT || 3500;
const DB_PATH = process.env.DB_PATH || './data/linkmd.db';
const STORAGE_PATH = process.env.STORAGE_PATH || './storage';
const SHARE_BASE_URL = process.env.SHARE_BASE_URL || `http://localhost:${PORT}`;

// Ensure directories
['data', 'storage/originals', 'storage/exports', 'storage/templates'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), { etag: false, maxAge: 0 }));

async function start() {
  // Initialize DB
  const db = new DB(DB_PATH);
  await db.init();
  console.log('[DB] SQLite initialized with FTS5');

  // Initialize engines
  const archiveEngine = new ArchiveEngine(db, STORAGE_PATH);
  const searchEngine = new SearchEngine(db);
  const shareEngine = new ShareEngine(db, SHARE_BASE_URL);
  const exportEngine = new ExportEngine(STORAGE_PATH);

  // Routes
  app.use('/api/projects', require('./routes/projects')(archiveEngine));
  app.use('/api', require('./routes/documents')(archiveEngine));
  app.use('/api', require('./routes/folders')(archiveEngine));
  app.use('/api/search', require('./routes/search')(searchEngine));
  app.use('/api/tags', require('./routes/tags')(archiveEngine));
  // Tags on documents (shared route)
  const tagsRouter = require('./routes/tags')(archiveEngine);
  app.post('/api/docs/:id/tags', (req, res, next) => {
    req.url = `/docs/${req.params.id}/tags`;
    tagsRouter(req, res, next);
  });
  app.delete('/api/docs/:id/tags/:tagId', (req, res, next) => {
    req.url = `/docs/${req.params.id}/tags/${req.params.tagId}`;
    tagsRouter(req, res, next);
  });

  app.use('/api/share', require('./routes/share')(shareEngine));
  // Shared content API route
  app.get('/api/shared/:token', async (req, res, next) => {
    try {
      const content = await shareEngine.getSharedContent(req.params.token);
      res.json({ success: true, ...content });
    } catch (e) { next(e); }
  });

  app.use('/api/export', require('./routes/export')(exportEngine, archiveEngine));
  // Download route
  app.get('/api/download/:exportId/:filename', async (req, res, next) => {
    try {
      const filePath = await exportEngine.getExportFile(req.params.exportId, req.params.filename);
      res.download(filePath, decodeURIComponent(req.params.filename));
    } catch (e) { next(e); }
  });

  app.use('/api/templates', require('./routes/templates'));

  // Health check
  app.get('/api/health', async (req, res) => {
    const pandocStatus = await pandocEngine.checkPandoc();
    const stats = await archiveEngine.getStats();
    res.json({
      status: 'ok',
      pandoc: pandocStatus.installed,
      pandocVersion: pandocStatus.version,
      dbPath: DB_PATH,
      docCount: stats.totalDocuments,
      projectCount: stats.totalProjects,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  // Stats
  app.get('/api/stats', async (req, res, next) => {
    try {
      const stats = await archiveEngine.getStats();
      res.json({ success: true, ...stats });
    } catch (e) { next(e); }
  });

  // Share view page
  app.get('/s/:token', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'shared.html'));
  });

  // SPA fallback
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  // Error handler (must be last)
  app.use(errorHandler);

  // Cron: cleanup exports every 30 minutes
  const interval = parseInt(process.env.CLEANUP_INTERVAL_MINUTES) || 30;
  cron.schedule(`*/${interval} * * * *`, async () => {
    const cleaned = await exportEngine.cleanupExpired();
    if (cleaned > 0) console.log(`[CRON] Cleaned ${cleaned} export(s)`);
  });

  // Check pandoc
  const pandocStatus = await pandocEngine.checkPandoc();
  if (!pandocStatus.installed) {
    console.warn('[WARN] Pandoc not found. Export will not work.');
  } else {
    console.log(`[INFO] Pandoc ${pandocStatus.version} detected`);
  }

  app.listen(PORT, () => {
    console.log(`[LinkMD v2.0] http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
