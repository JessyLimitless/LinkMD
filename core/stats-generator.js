'use strict';

const fs = require('fs');

function generateStats(mergeStats, outputPath, startTime, options = {}) {
  let outputSize = 0;
  try {
    outputSize = fs.statSync(outputPath).size;
  } catch { /* ignore */ }

  return {
    inputFiles: mergeStats.inputFiles,
    mergedLines: mergeStats.totalLines,
    outputSize,
    headings: mergeStats.headings,
    codeBlocks: mergeStats.codeBlocks,
    tables: mergeStats.tables,
    images: mergeStats.images,
    estimatedPages: Math.ceil(mergeStats.totalLines / 45),
    conversionTime: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
    template: options.template || null,
    headingStrategy: options.headingStrategy || null
  };
}

module.exports = { generateStats };
