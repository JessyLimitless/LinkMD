'use strict';

const express = require('express');
const router = express.Router();

module.exports = function(archiveEngine) {
  router.get('/', async (req, res, next) => {
    try {
      const tags = await archiveEngine.getTags();
      res.json({ success: true, tags });
    } catch (e) { next(e); }
  });

  router.post('/', async (req, res, next) => {
    try {
      const { name, color } = req.body;
      const tag = await archiveEngine.createTag(name, color);
      res.status(201).json(tag);
    } catch (e) { next(e); }
  });

  // Add tag to document
  router.post('/docs/:id/tags', async (req, res, next) => {
    try {
      const { tagId } = req.body;
      await archiveEngine.addTagToDocument(req.params.id, tagId);
      const tags = await archiveEngine.getDocumentTags(req.params.id);
      res.json({ success: true, tags });
    } catch (e) { next(e); }
  });

  // Remove tag from document
  router.delete('/docs/:id/tags/:tagId', async (req, res, next) => {
    try {
      await archiveEngine.removeTagFromDocument(req.params.id, parseInt(req.params.tagId));
      const tags = await archiveEngine.getDocumentTags(req.params.id);
      res.json({ success: true, tags });
    } catch (e) { next(e); }
  });

  return router;
};
