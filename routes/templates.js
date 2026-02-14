'use strict';

const express = require('express');
const router = express.Router();
const templateManager = require('../core/template-manager');

router.get('/', (req, res) => {
  const templates = templateManager.getTemplates();
  res.json({
    success: true,
    templates: templates.map(t => ({
      ...t,
      available: templateManager.exists(t.id)
    }))
  });
});

module.exports = router;
