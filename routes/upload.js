'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs/promises');
const AdmZip = require('adm-zip');
const router = express.Router();
const fileManager = require('../core/file-manager');
const mdProcessor = require('../core/md-processor');
const { createError } = require('../core/errors');
const { validateUpload } = require('../middleware/upload-validator');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024,
    files: parseInt(process.env.MAX_FILE_COUNT) || 100
  }
});

router.post('/', upload.array('files', 100), validateUpload, async (req, res, next) => {
  try {
    const session = await fileManager.createSession();
    const mdFiles = [];

    for (const file of req.files) {
      const ext = path.extname(file.originalname).toLowerCase();

      if (ext === '.zip') {
        // Extract ZIP
        try {
          const zip = new AdmZip(file.buffer);
          const entries = zip.getEntries();
          let foundMd = false;

          for (const entry of entries) {
            if (entry.isDirectory) continue;
            const entryName = path.basename(entry.entryName);
            if (!entryName.endsWith('.md')) continue;
            if (entryName.startsWith('.') || entryName.startsWith('__MACOSX')) continue;

            foundMd = true;
            const destPath = path.join(session.uploadDir, entryName);
            await fs.writeFile(destPath, entry.getData());
            mdFiles.push(destPath);
          }

          if (!foundMd) {
            await fileManager.deleteSession(session.sessionId);
            return next(createError('UPLOAD_ZIP_NO_MD'));
          }
        } catch (zipErr) {
          await fileManager.deleteSession(session.sessionId);
          return next(createError('UPLOAD_ZIP_CORRUPT', { raw: zipErr.message }));
        }
      } else if (ext === '.md') {
        // Decode filename: multer on Windows may give latin1 encoded names
        let originalName = file.originalname;
        try {
          originalName = Buffer.from(file.originalname, 'latin1').toString('utf-8');
        } catch { /* keep original */ }
        const destPath = path.join(session.uploadDir, originalName);
        await fs.writeFile(destPath, file.buffer);
        mdFiles.push(destPath);
      }
    }

    if (mdFiles.length === 0) {
      await fileManager.deleteSession(session.sessionId);
      return next(createError('UPLOAD_NO_FILES'));
    }

    // Analyze each file
    const analysisResults = [];
    for (const filePath of mdFiles) {
      try {
        const info = await mdProcessor.analyzeFile(filePath);
        analysisResults.push(info);
      } catch {
        // Skip files that fail analysis (binary etc.)
      }
    }

    const totalSize = analysisResults.reduce((sum, f) => sum + f.size, 0);

    res.json({
      success: true,
      sessionId: session.sessionId,
      files: analysisResults.map(f => ({
        filename: f.filename,
        size: f.size,
        parsedTitle: f.parsedTitle,
        firstHeading: f.firstHeading,
        headingCount: f.headingCount,
        codeBlockCount: f.codeBlockCount,
        tableCount: f.tableCount,
        imageCount: f.imageCount,
        lineCount: f.lineCount,
        hasFrontmatter: f.hasFrontmatter,
        encoding: f.encoding
      })),
      totalFiles: analysisResults.length,
      totalSize
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
