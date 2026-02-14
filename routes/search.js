'use strict';

const express = require('express');
const router = express.Router();

module.exports = function(searchEngine) {
  router.get('/', async (req, res, next) => {
    try {
      const { q, project, tag, from, to, limit } = req.query;
      const result = await searchEngine.search(q, {
        projectId: project || null,
        tagId: tag ? parseInt(tag) : null,
        dateFrom: from || null,
        dateTo: to || null,
        limit: parseInt(limit) || 20
      });
      res.json({ success: true, ...result });
    } catch (e) { next(e); }
  });

  router.get('/history', async (req, res, next) => {
    try {
      const history = await searchEngine.getSearchHistory(parseInt(req.query.limit) || 10);
      res.json({ success: true, history });
    } catch (e) { next(e); }
  });

  return router;
};
