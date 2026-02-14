'use strict';

const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs/promises');
const pandocEngine = require('./pandoc-engine');
const templateManager = require('./template-manager');
const mdProcessor = require('./md-processor');
const { createError } = require('./errors');

class ExportEngine {
  constructor(storagePath) {
    this.storagePath = storagePath;
    this.exportsDir = path.join(storagePath, 'exports');
  }

  async exportDocuments(documents, outputFormat, options = {}) {
    if (!documents || documents.length === 0) throw createError('EXPORT_NO_DOCS');

    const {
      title = 'LinkMD Document',
      author = 'LinkMD',
      date = new Date().toISOString().split('T')[0],
      toc = false,
      tocDepth = 3,
      pageBreak = true,
      headingStrategy = 'filename-first',
      highlightStyle = 'tango',
      template = 'business-report'
    } = options;

    const exportId = uuidv4();
    const exportDir = path.join(this.exportsDir, exportId);
    await fs.mkdir(exportDir, { recursive: true });

    // Write each document's content to temp MD files
    const tempFiles = [];
    for (const doc of documents) {
      const tempPath = path.join(exportDir, doc.filename);
      await fs.writeFile(tempPath, doc.content, 'utf-8');
      tempFiles.push({ filename: doc.filename, path: tempPath });
    }

    // Merge
    const mergeOptions = {
      sortOrder: 'filename',
      headingStrategy,
      pageBreak,
      title,
      author,
      date
    };
    const merged = await mdProcessor.mergeFiles(tempFiles, mergeOptions);

    // Write merged MD
    const mergedPath = path.join(exportDir, '_merged.md');
    await fs.writeFile(mergedPath, merged.content, 'utf-8');

    // Determine output extension
    const ext = outputFormat === 'pdf' ? 'pdf' : outputFormat === 'html' ? 'html' : 'docx';
    const safeTitle = title.replace(/[<>:"/\\|?*]/g, '_').substring(0, 50);
    const outputFilename = `${safeTitle}.${ext}`;
    const outputPath = path.join(exportDir, outputFilename);

    // Build Pandoc options
    const pandocOpts = { toc, tocDepth, title, author, date, highlightStyle };

    if (ext === 'docx' && template) {
      try {
        pandocOpts.template = templateManager.getTemplatePath(template, 'docx');
      } catch {}
    }
    if (ext === 'html') {
      pandocOpts.css = templateManager.getCssPath();
    }

    // Convert
    const result = await pandocEngine.convert([mergedPath], outputPath, pandocOpts);

    return {
      downloadUrl: `/api/download/${exportId}/${encodeURIComponent(outputFilename)}`,
      exportId,
      filename: outputFilename,
      stats: merged.stats,
      warnings: result.warnings || []
    };
  }

  async getExportFile(exportId, filename) {
    const filePath = path.join(this.exportsDir, exportId, filename);
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      throw createError('DOC_NOT_FOUND');
    }
  }

  async cleanupExpired(maxAgeMs = 30 * 60 * 1000) {
    const now = Date.now();
    let cleaned = 0;
    try {
      const entries = await fs.readdir(this.exportsDir);
      for (const entry of entries) {
        const entryPath = path.join(this.exportsDir, entry);
        const stat = await fs.stat(entryPath);
        if (stat.isDirectory() && (now - stat.mtimeMs) > maxAgeMs) {
          await fs.rm(entryPath, { recursive: true, force: true });
          cleaned++;
        }
      }
    } catch {}
    return cleaned;
  }
}

module.exports = ExportEngine;
