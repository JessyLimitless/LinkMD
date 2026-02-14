'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const router = express.Router();
const fileManager = require('../core/file-manager');
const mdProcessor = require('../core/md-processor');
const pandocEngine = require('../core/pandoc-engine');
const templateManager = require('../core/template-manager');
const { generateStats } = require('../core/stats-generator');
const { createError } = require('../core/errors');

router.post('/', async (req, res, next) => {
  try {
    const {
      sessionId,
      outputFormat = 'docx',
      template = 'business-report',
      options = {}
    } = req.body;

    if (!sessionId) {
      return next(createError('UPLOAD_NO_FILES'));
    }
    if (!fileManager.sessionExists(sessionId)) {
      return next(createError('DOWNLOAD_NOT_FOUND'));
    }

    const startTime = Date.now();
    const { uploadDir, workspaceDir, outputDir } = fileManager.getSessionPaths(sessionId);

    // Get uploaded files
    let files = await fileManager.getUploadedFiles(sessionId);
    if (files.length === 0) {
      return next(createError('UPLOAD_NO_FILES'));
    }

    // Filter selected files if specified
    if (options.selectedFiles && options.selectedFiles.length > 0) {
      files = files.filter(f => options.selectedFiles.includes(f.filename));
    }

    // Merge files
    const mergeResult = await mdProcessor.mergeFiles(files, {
      sortOrder: options.sortOrder || 'filename',
      headingStrategy: options.headingStrategy || 'filename-first',
      pageBreak: options.pageBreak !== false,
      fileOrder: options.fileOrder || null,
      title: options.title || 'LinkMD Document',
      author: options.author || 'LinkMD',
      date: options.date || new Date().toISOString().split('T')[0]
    });

    // Write merged MD
    const mergedPath = path.join(workspaceDir, 'merged.md');
    await fs.writeFile(mergedPath, mergeResult.content, 'utf-8');

    // Prepare output filename
    const safeTitle = (options.title || 'LinkMD_Document').replace(/[^a-zA-Z0-9가-힣_\-]/g, '_');
    const dateStr = (options.date || new Date().toISOString().split('T')[0]).replace(/-/g, '');
    const outputFilename = `${safeTitle}_${dateStr}.${outputFormat}`;
    const outputPath = path.join(outputDir, outputFilename);

    // Prepare pandoc options
    const pandocOpts = {
      toc: options.toc !== false,
      tocDepth: options.tocDepth || 3,
      title: options.title,
      author: options.author,
      date: options.date,
      highlightStyle: options.highlightStyle || 'tango'
    };

    // Add template for docx/pptx
    if (['docx', 'pptx'].includes(outputFormat)) {
      try {
        pandocOpts.template = templateManager.getTemplatePath(template, outputFormat);
      } catch {
        // If template doesn't exist for format, continue without
      }
    }

    // Add CSS for HTML
    if (outputFormat === 'html') {
      pandocOpts.css = templateManager.getCssPath();
      pandocOpts.standalone = true;
    }

    // Convert
    const convertResult = await pandocEngine.convert([mergedPath], outputPath, pandocOpts);

    // Generate stats
    const stats = generateStats(mergeResult.stats, outputPath, startTime, {
      template,
      headingStrategy: options.headingStrategy || 'filename-first'
    });

    res.json({
      success: true,
      sessionId,
      downloadUrl: `/api/download/${sessionId}`,
      filename: outputFilename,
      outputFormat,
      warnings: convertResult.warnings.map(w => ({
        code: w.code || 3006,
        message: w.userMsg || w.message
      })),
      stats
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
