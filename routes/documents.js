'use strict';

const express = require('express');
const multer = require('multer');
const router = express.Router();
const { createError } = require('../core/errors');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 100 }
});

module.exports = function(archiveEngine) {
  // Upload MD files to project (optionally into a folder)
  router.post('/projects/:id/upload', upload.array('files', 100), async (req, res, next) => {
    try {
      if (!req.files || req.files.length === 0) throw createError('UPLOAD_NO_FILES');
      const folderId = req.query.folderId || req.body.folderId || null;
      const result = await archiveEngine.archiveDocuments(req.params.id, req.files, folderId);
      res.status(201).json({ success: true, ...result });
    } catch (e) { next(e); }
  });

  // Create empty document
  router.post('/projects/:id/docs', async (req, res, next) => {
    try {
      const { filename, folderId, content } = req.body;
      const result = await archiveEngine.createDocument(req.params.id, filename, folderId || null, content || '');
      res.status(201).json({ success: true, document: result });
    } catch (e) { next(e); }
  });

  // Get project documents
  router.get('/projects/:id/docs', async (req, res, next) => {
    try {
      const { sort, order, tag, limit, offset } = req.query;
      const documents = await archiveEngine.getDocuments(req.params.id, {
        sortBy: sort, sortOrder: order, tag,
        limit: parseInt(limit) || 100, offset: parseInt(offset) || 0
      });
      res.json({ success: true, documents });
    } catch (e) { next(e); }
  });

  // Get document detail
  router.get('/docs/:id', async (req, res, next) => {
    try {
      const doc = await archiveEngine.getDocument(req.params.id);
      res.json(doc);
    } catch (e) { next(e); }
  });

  // Get document raw MD
  router.get('/docs/:id/raw', async (req, res, next) => {
    try {
      const doc = await archiveEngine.getDocumentRaw(req.params.id);
      res.type('text/markdown').send(doc.content);
    } catch (e) { next(e); }
  });

  // Update document
  router.put('/docs/:id', async (req, res, next) => {
    try {
      const doc = await archiveEngine.updateDocument(req.params.id, req.body);
      res.json(doc);
    } catch (e) { next(e); }
  });

  // Move document
  router.put('/docs/:id/move', async (req, res, next) => {
    try {
      const { folderId, projectId } = req.body;
      const doc = await archiveEngine.moveDocument(req.params.id, folderId || null, projectId || null);
      res.json({ success: true, document: doc });
    } catch (e) { next(e); }
  });

  // Copy document
  router.post('/docs/:id/copy', async (req, res, next) => {
    try {
      const { folderId, projectId } = req.body;
      const doc = await archiveEngine.copyDocument(req.params.id, folderId || null, projectId || null);
      res.status(201).json({ success: true, document: doc });
    } catch (e) { next(e); }
  });

  // Rename document
  router.put('/docs/:id/rename', async (req, res, next) => {
    try {
      const { filename } = req.body;
      const doc = await archiveEngine.renameDocument(req.params.id, filename);
      res.json({ success: true, document: doc });
    } catch (e) { next(e); }
  });

  // Delete document
  router.delete('/docs/:id', async (req, res, next) => {
    try {
      await archiveEngine.deleteDocument(req.params.id);
      res.json({ success: true });
    } catch (e) { next(e); }
  });

  // Get heading stats for split
  router.get('/docs/:id/headings', async (req, res, next) => {
    try {
      const result = await archiveEngine.getHeadingStats(req.params.id);
      res.json({ success: true, ...result });
    } catch (e) { next(e); }
  });

  // Split document by heading level
  router.post('/docs/:id/split', async (req, res, next) => {
    try {
      const { level, keepOriginal } = req.body;
      const result = await archiveEngine.splitDocument(
        req.params.id,
        parseInt(level) || 2,
        keepOriginal !== false
      );
      res.status(201).json({ success: true, ...result });
    } catch (e) { next(e); }
  });

  // Suggest tags for document
  router.get('/docs/:id/suggest-tags', async (req, res, next) => {
    try {
      const suggestions = await archiveEngine.suggestTags(req.params.id);
      res.json({ success: true, suggestions });
    } catch (e) { next(e); }
  });

  // Apply tags to document
  router.post('/docs/:id/apply-tags', async (req, res, next) => {
    try {
      const { tags } = req.body;
      const result = await archiveEngine.applyTags(req.params.id, tags || []);
      res.json({ success: true, ...result });
    } catch (e) { next(e); }
  });

  return router;
};
