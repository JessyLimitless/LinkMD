'use strict';

const express = require('express');
const router = express.Router();

module.exports = function(archiveEngine) {
  const folderEngine = archiveEngine.folderEngine;

  // Create folder
  router.post('/projects/:projectId/folders', async (req, res, next) => {
    try {
      const { name, parentId } = req.body;
      const folder = await folderEngine.createFolder(req.params.projectId, name, parentId || null);
      res.status(201).json({ success: true, folder });
    } catch (e) { next(e); }
  });

  // Get project tree (folders + files)
  router.get('/projects/:projectId/tree', async (req, res, next) => {
    try {
      const tree = await folderEngine.getProjectTree(req.params.projectId);
      res.json({ success: true, tree });
    } catch (e) { next(e); }
  });

  // Get single folder
  router.get('/folders/:id', async (req, res, next) => {
    try {
      const folder = await folderEngine.getFolder(req.params.id);
      res.json({ success: true, folder });
    } catch (e) { next(e); }
  });

  // Rename folder
  router.put('/folders/:id', async (req, res, next) => {
    try {
      const { name } = req.body;
      const folder = await folderEngine.renameFolder(req.params.id, name);
      res.json({ success: true, folder });
    } catch (e) { next(e); }
  });

  // Move folder
  router.put('/folders/:id/move', async (req, res, next) => {
    try {
      const { parentId } = req.body;
      const folder = await folderEngine.moveFolder(req.params.id, parentId || null);
      res.json({ success: true, folder });
    } catch (e) { next(e); }
  });

  // Delete folder
  router.delete('/folders/:id', async (req, res, next) => {
    try {
      await folderEngine.deleteFolder(req.params.id);
      res.json({ success: true });
    } catch (e) { next(e); }
  });

  return router;
};
