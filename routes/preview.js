'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const { marked } = require('marked');
const router = express.Router();
const fileManager = require('../core/file-manager');
const { createError } = require('../core/errors');

router.post('/', async (req, res, next) => {
  try {
    const { sessionId, filename } = req.body;
    if (!sessionId || !filename) {
      return next(createError('UPLOAD_NO_FILES'));
    }

    if (!fileManager.sessionExists(sessionId)) {
      return next(createError('DOWNLOAD_NOT_FOUND'));
    }

    const { uploadDir } = fileManager.getSessionPaths(sessionId);
    const filePath = path.join(uploadDir, filename);

    let content;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch {
      return next(createError('DOWNLOAD_NOT_FOUND', { filename }));
    }

    const html = marked(content);

    res.json({
      success: true,
      html,
      filename
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
