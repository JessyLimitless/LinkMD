'use strict';

const express = require('express');
const router = express.Router();
const fileManager = require('../core/file-manager');
const { createError } = require('../core/errors');

router.get('/:sessionId', async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    if (!fileManager.sessionExists(sessionId)) {
      return next(createError('DOWNLOAD_EXPIRED'));
    }

    const output = await fileManager.getOutputFile(sessionId);
    if (!output) {
      return next(createError('DOWNLOAD_NOT_FOUND'));
    }

    const encodedFilename = encodeURIComponent(output.filename);
    res.set('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);
    res.sendFile(output.path);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
