'use strict';

const express = require('express');
const router = express.Router();

module.exports = function(archiveEngine) {
  router.post('/', async (req, res, next) => {
    try {
      const { name, description, color, icon } = req.body;
      const project = await archiveEngine.createProject(name, description, color, icon);
      res.status(201).json(project);
    } catch (e) { next(e); }
  });

  router.get('/', async (req, res, next) => {
    try {
      const projects = await archiveEngine.getProjects();
      res.json({ success: true, projects });
    } catch (e) { next(e); }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const project = await archiveEngine.getProject(req.params.id);
      res.json(project);
    } catch (e) { next(e); }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const project = await archiveEngine.updateProject(req.params.id, req.body);
      res.json(project);
    } catch (e) { next(e); }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      await archiveEngine.deleteProject(req.params.id);
      res.json({ success: true });
    } catch (e) { next(e); }
  });

  return router;
};
