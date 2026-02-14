'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs/promises');
const router = express.Router();
const fileManager = require('../core/file-manager');
const pandocEngine = require('../core/pandoc-engine');
const { validateReverse } = require('../middleware/upload-validator');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 }
});

router.post('/', upload.array('files', 1), validateReverse, async (req, res, next) => {
  try {
    const session = await fileManager.createSession();
    const file = req.files[0];

    // Save uploaded file
    const inputPath = path.join(session.uploadDir, file.originalname);
    await fs.writeFile(inputPath, file.buffer);

    // Reverse convert
    const result = await pandocEngine.reverse(inputPath, session.outputDir);

    res.json({
      success: true,
      sessionId: session.sessionId,
      downloadUrl: `/api/download/${session.sessionId}`,
      filename: result.filename
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
