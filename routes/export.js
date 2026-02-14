'use strict';

const express = require('express');
const path = require('path');
const router = express.Router();
const { createError } = require('../core/errors');

module.exports = function(exportEngine, archiveEngine) {
  // Export selected documents
  router.post('/', async (req, res, next) => {
    try {
      const { documentIds, outputFormat = 'docx', template, options = {} } = req.body;
      if (!documentIds || documentIds.length === 0) throw createError('EXPORT_NO_DOCS');

      // Fetch documents from DB
      const documents = [];
      for (const id of documentIds) {
        const doc = await archiveEngine.getDocument(id);
        documents.push(doc);
      }

      const result = await exportEngine.exportDocuments(documents, outputFormat, {
        ...options,
        template
      });

      res.json({ success: true, ...result });
    } catch (e) { next(e); }
  });

  // Download export result
  router.get('/download/:exportId/:filename', async (req, res, next) => {
    try {
      const filePath = await exportEngine.getExportFile(req.params.exportId, req.params.filename);
      res.download(filePath, req.params.filename);
    } catch (e) { next(e); }
  });

  return router;
};
