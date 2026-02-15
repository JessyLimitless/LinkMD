'use strict';

const express = require('express');
const router = express.Router();

function getBaseUrl(req) {
  const protocol = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${protocol}://${host}`;
}

module.exports = function(shareEngine) {
  // Create document share link
  router.post('/doc/:id', async (req, res, next) => {
    try {
      const { expiresIn } = req.body;
      const link = await shareEngine.createShareLink('document', req.params.id, expiresIn, getBaseUrl(req));
      res.status(201).json({ success: true, ...link });
    } catch (e) { next(e); }
  });

  // Create project share link
  router.post('/project/:id', async (req, res, next) => {
    try {
      const { expiresIn } = req.body;
      const link = await shareEngine.createShareLink('project', req.params.id, expiresIn, getBaseUrl(req));
      res.status(201).json({ success: true, ...link });
    } catch (e) { next(e); }
  });

  // Get shared content (API)
  router.get('/shared/:token', async (req, res, next) => {
    try {
      const content = await shareEngine.getSharedContent(req.params.token);
      res.json({ success: true, ...content });
    } catch (e) { next(e); }
  });

  // Delete share link
  router.delete('/:id', async (req, res, next) => {
    try {
      await shareEngine.deleteShareLink(req.params.id);
      res.json({ success: true });
    } catch (e) { next(e); }
  });

  return router;
};
