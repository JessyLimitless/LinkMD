'use strict';

const fs = require('fs/promises');
const path = require('path');
const matter = require('gray-matter');
const stringSimilarity = require('string-similarity');

// §4.1 — Filename parsing patterns (applied in order)
const FILENAME_PATTERNS = [
  { regex: /\.md$/i, replace: '' },                                         // 5. extension
  { regex: /^[A-Z0-9]+[_\-](PHASE|phase|Phase)[_\-]?\d+[_\-]?/i, replace: '' }, // 3. PROJECT_PHASE##_
  { regex: /^(PHASE|phase|Phase)[_\-]?\d+[_\-]?/i, replace: '' },          // 2. PHASE##_
  { regex: /^\d+[_\-.\s]+/, replace: '' },                                  // 1. leading number
  { regex: /[_\-]?\d{8}$/, replace: '' },                                   // 4. trailing date YYYYMMDD
];

function parseFilename(filename) {
  let result = filename;
  // Remove extension first
  result = result.replace(/\.md$/i, '');
  // Apply patterns in priority order
  // 3. PROJECT_PHASE pattern (must be before PHASE pattern)
  result = result.replace(/^[A-Z0-9]+[_\-](PHASE|phase|Phase)[_\-]?\d+[_\-]?/i, '');
  // 2. PHASE prefix
  result = result.replace(/^(PHASE|phase|Phase)[_\-]?\d+[_\-]?/i, '');
  // 1. Leading numbers
  result = result.replace(/^\d+[_\-.\s]+/, '');
  // 4. Trailing date (YYYYMMDD)
  result = result.replace(/[_\-]?\d{8}$/, '');
  // Cleanup: underscores/hyphens → spaces
  result = result.replace(/[_\-]/g, ' ');
  // Collapse multiple spaces, trim
  result = result.replace(/\s+/g, ' ').trim();
  return result || filename.replace(/\.md$/i, '');
}

// §4.2 — Natural sort for filenames
function naturalSort(a, b) {
  const regex = /(\d+)|(\D+)/g;
  const aParts = a.match(regex) || [];
  const bParts = b.match(regex) || [];
  const len = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < len; i++) {
    const aPart = aParts[i] || '';
    const bPart = bParts[i] || '';
    const aNum = parseInt(aPart, 10);
    const bNum = parseInt(bPart, 10);

    if (!isNaN(aNum) && !isNaN(bNum)) {
      if (aNum !== bNum) return aNum - bNum;
    } else {
      const cmp = aPart.localeCompare(bPart, 'ko');
      if (cmp !== 0) return cmp;
    }
  }
  return 0;
}

function sortFiles(files, strategy = 'filename', customOrder = null) {
  const sorted = [...files];
  switch (strategy) {
    case 'filename':
      sorted.sort((a, b) => naturalSort(a.filename, b.filename));
      break;
    case 'modified':
      sorted.sort((a, b) => (a.modifiedAt || 0) - (b.modifiedAt || 0));
      break;
    case 'custom':
      if (customOrder && customOrder.length > 0) {
        sorted.sort((a, b) => {
          const ai = customOrder.indexOf(a.filename);
          const bi = customOrder.indexOf(b.filename);
          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        });
      }
      break;
  }
  return sorted;
}

// §4.5 — Heading demotion
function demoteHeadings(markdown, levels = 1) {
  return markdown.replace(/^(#{1,6})\s/gm, (match, hashes) => {
    const newLevel = Math.min(hashes.length + levels, 6);
    return '#'.repeat(newLevel) + ' ';
  });
}

// §4.6 — Similarity check
function isSimilar(str1, str2, threshold = 0.7) {
  const normalize = (s) => s.replace(/[\s_\-\d.]/g, '').toLowerCase();
  const a = normalize(str1);
  const b = normalize(str2);

  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;

  const similarity = stringSimilarity.compareTwoStrings(a, b);
  return similarity >= threshold;
}

// Extract first heading from markdown
function extractFirstHeading(markdown) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

// Count headings, code blocks, tables, images
function countElements(markdown) {
  const headings = (markdown.match(/^#{1,6}\s+.+$/gm) || []).length;
  const codeBlocks = (markdown.match(/^```/gm) || []).length / 2;
  const tables = (markdown.match(/^\|.+\|$/gm) || [])
    .filter((line, i, arr) => i === 0 || !/^[\|\s\-:]+$/.test(line)).length;
  // Simplified: count rows that start table sections
  const tableMatches = markdown.match(/(?:^|\n)\|[^\n]+\|\n\|[\s\-:]+\|/g) || [];
  const images = (markdown.match(/!\[.*?\]\(.+?\)/g) || []).length;
  return {
    headings,
    codeBlocks: Math.floor(codeBlocks),
    tables: tableMatches.length,
    images
  };
}

// Build heading tree
function buildHeadingTree(markdown) {
  const lines = markdown.split('\n');
  const tree = [];
  lines.forEach((line, idx) => {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      tree.push({
        level: match[1].length,
        text: match[2].trim(),
        line: idx + 1
      });
    }
  });
  return tree;
}

// Extract code languages
function extractCodeLanguages(markdown) {
  const langs = new Set();
  const matches = markdown.matchAll(/^```(\w+)?/gm);
  for (const m of matches) {
    if (m[1]) langs.add(m[1].toLowerCase());
  }
  return [...langs];
}

// Extract image references
function extractImageRefs(markdown) {
  const refs = [];
  const matches = markdown.matchAll(/!\[.*?\]\((.+?)\)/g);
  for (const m of matches) {
    refs.push(m[1]);
  }
  return refs;
}

// §3.1.1 — Analyze single file
async function analyzeFile(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  const stat = await fs.stat(filePath);
  const filename = path.basename(filePath);
  const { data: frontmatterData, content: body } = matter(content);

  const headingTree = buildHeadingTree(body);
  const elements = countElements(body);
  const firstHeading = extractFirstHeading(body);

  return {
    filename,
    path: filePath,
    size: stat.size,
    modifiedAt: stat.mtimeMs,
    parsedTitle: parseFilename(filename),
    firstHeading: firstHeading || null,
    headingCount: headingTree.length,
    headingTree,
    codeBlockCount: elements.codeBlocks,
    codeLanguages: extractCodeLanguages(body),
    tableCount: elements.tables,
    imageCount: elements.images,
    imageRefs: extractImageRefs(body),
    lineCount: content.split('\n').length,
    hasFrontmatter: Object.keys(frontmatterData).length > 0,
    encoding: 'utf-8'
  };
}

// §4.4 — Main merge function
async function mergeFiles(files, options = {}) {
  const {
    sortOrder = 'filename',
    headingStrategy = 'filename-first',
    pageBreak = true,
    fileOrder = null,
    title = 'LinkMD Document',
    author = 'LinkMD',
    date = new Date().toISOString().split('T')[0]
  } = options;

  // Step 1: Sort
  const sorted = sortFiles(files, sortOrder, fileOrder);

  // Step 2: Process each file
  const chunks = [];

  for (const file of sorted) {
    const filePath = file.path || file;
    const filename = file.filename || path.basename(filePath);
    const content = await fs.readFile(filePath, 'utf-8');
    const { content: body } = matter(content);

    const chapterTitle = parseFilename(filename);

    let processedBody;
    switch (headingStrategy) {
      case 'filename-first':
        processedBody = demoteHeadings(body.trim(), 1);
        chunks.push(`# ${chapterTitle}\n\n${processedBody}`);
        break;
      case 'content-first':
        chunks.push(body.trim());
        break;
      case 'smart-merge': {
        const firstHeading = extractFirstHeading(body);
        if (firstHeading && isSimilar(chapterTitle, firstHeading)) {
          chunks.push(body.trim());
        } else {
          processedBody = demoteHeadings(body.trim(), 1);
          chunks.push(`# ${chapterTitle}\n\n${processedBody}`);
        }
        break;
      }
      default:
        processedBody = demoteHeadings(body.trim(), 1);
        chunks.push(`# ${chapterTitle}\n\n${processedBody}`);
    }
  }

  // Step 3: Page break separator
  const separator = pageBreak
    ? '\n\n\\newpage\n\n'
    : '\n\n---\n\n';

  // Step 4: YAML frontmatter
  const frontmatterBlock = [
    '---',
    `title: "${title}"`,
    `author: "${author}"`,
    `date: "${date}"`,
    '---',
  ].join('\n');

  // Step 5: Final merge
  const merged = frontmatterBlock + '\n\n' + chunks.join(separator);
  const mergedElements = countElements(merged);

  return {
    content: merged,
    stats: {
      inputFiles: files.length,
      totalLines: merged.split('\n').length,
      headings: mergedElements.headings,
      codeBlocks: mergedElements.codeBlocks,
      tables: mergedElements.tables,
      images: mergedElements.images
    }
  };
}

module.exports = {
  parseFilename,
  sortFiles,
  demoteHeadings,
  isSimilar,
  extractFirstHeading,
  analyzeFile,
  mergeFiles,
  naturalSort,
  countElements,
  buildHeadingTree,
  extractCodeLanguages,
  extractImageRefs
};
